import crypto from 'node:crypto';
import { store } from './store.ts';
import type { AlumniRecord, ScrapingJob } from './types.ts';

const BASE_URL = (process.env.ALUMNILINK_BASE_URL || 'https://alumni.saylaniit.com').replace(/\/+$/, '');
const USER_AGENT = 'SaylaniAlumniLeaderboard/1.0 (+https://alumni.saylaniit.com/robots.txt)';
const DEFAULT_THROTTLE_MS = Math.max(150, Number(process.env.SCRAPE_DELAY_MS || 250));

const EXCLUDED_SLUGS = new Set([
  'feed',
  'admin',
  'settings',
  'messages',
  'notifications',
  'bookmarks',
  'dashboard',
  'search',
  'jobs',
  'launchpad',
  'profile',
  'login',
  'register',
  'verify-otp',
  'verify-smit',
  'forgot-password',
  'invite',
  'onboarding',
  'sitemap.xml',
  'robots.txt',
]);

export interface ParsedPublicProfile {
  username: string;
  fullName: string;
  avatarUrl: string | null;
  profileUrl: string;
  followers: number;
  following: number | null;
  verified: boolean;
  role: string;
  bio: string | null;
  location: string | null;
  skills: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function unescapeRscString(raw: string): string {
  return raw
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function decodeUnicodeEscapes(raw: string): string {
  return raw.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export async function fetchText(url: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function checkRobotsTxt(): Promise<{ allowed: boolean; raw: string }> {
  try {
    const raw = await fetchText(`${BASE_URL}/robots.txt`, 10000);
    // Check if root or wildcard disallow blocks public scraping
    const lines = raw.split(/\r?\n/).map((l) => l.trim());
    let inWildcard = false;
    let allowed = true;
    for (const line of lines) {
      if (line.toLowerCase().startsWith('user-agent:')) {
        const agent = line.split(':')[1]?.trim();
        inWildcard = agent === '*';
      } else if (inWildcard && line.toLowerCase().startsWith('disallow:')) {
        const path = line.split(':')[1]?.trim();
        if (path === '/') {
          allowed = false;
        }
      }
    }
    store.setRobotsAllowed(allowed);
    return { allowed, raw };
  } catch (err) {
    store.addLog('warning', `Could not verify robots.txt: ${(err as Error).message}`);
    return { allowed: true, raw: '' };
  }
}

export async function discoverSitemapUsernames(): Promise<string[]> {
  const xml = await fetchText(`${BASE_URL}/sitemap.xml`, 20000);
  const matches = xml.matchAll(/<loc>(.*?)<\/loc>/g);
  const usernames: string[] = [];
  const seen = new Set<string>();

  for (const m of matches) {
    const loc = m[1]?.trim();
    if (!loc) continue;
    let parts: string[] = [];
    try {
      parts = new URL(loc).pathname.split('/').filter(Boolean);
    } catch {
      continue;
    }
    // Only single-segment root paths (/<username>) are public user profiles; /post/<id> are feed posts
    if (parts.length !== 1) continue;
    const slug = parts[0].trim();
    const lower = slug.toLowerCase();
    if (!slug || EXCLUDED_SLUGS.has(lower) || seen.has(lower)) continue;
    seen.add(lower);
    usernames.push(slug);
  }

  store.setSitemapTotal(usernames.length);
  return usernames;
}

/**
 * Extracts active alumni profiles directly embedded inside the public homepage feed RSC payload.
 * Returns full profile objects without extra per-user requests!
 */
export async function extractFeedProfiles(): Promise<ParsedPublicProfile[]> {
  const html = await fetchText(`${BASE_URL}/`, 15000);
  const unescaped = html.replace(/\\"/g, '"');
  const profiles: ParsedPublicProfile[] = [];
  const seen = new Set<string>();

  const userMatches = unescaped.matchAll(/"name":"([^"]*)","username":"([a-zA-Z0-9_.-]+)"/g);
  for (const m of userMatches) {
    const rawName = m[1];
    const username = m[2];
    const lower = username.toLowerCase();
    if (!username || EXCLUDED_SLUGS.has(lower) || seen.has(lower)) continue;

    const start = Math.max(0, (m.index ?? 0) - 250);
    const end = Math.min(unescaped.length, (m.index ?? 0) + 4500);
    const chunk = unescaped.slice(start, end);

    const folMatch = chunk.match(/"followers":(\d+)/);
    if (!folMatch) continue;

    const fingMatch = chunk.match(/"following":(\d+)/);
    const avMatch = chunk.match(/"avatar":"([^"]+)"/);
    const verMatch = chunk.match(/"verified":(true|false)/);
    const roleMatch = chunk.match(/"role":"([^"]+)"/);
    const locMatch = chunk.match(/"location":"([^"]*)"/);
    const bioMatch = chunk.match(/"bio":"([^"]*)"/);

    const skills: string[] = [];
    const skillsBlock = chunk.match(/"skills":\[(.*?)\]/);
    if (skillsBlock?.[1]) {
      for (const sm of skillsBlock[1].matchAll(/"label":"([^"]+)"/g)) {
        if (sm[1]) skills.push(decodeUnicodeEscapes(sm[1]));
      }
    }

    seen.add(lower);
    profiles.push({
      username,
      fullName: decodeUnicodeEscapes(unescapeRscString(rawName || username)),
      avatarUrl: avMatch?.[1] && avMatch[1] !== '$undefined' && avMatch[1].startsWith('http') ? avMatch[1] : null,
      profileUrl: `${BASE_URL}/${username}`,
      followers: parseInt(folMatch[1], 10),
      following: fingMatch ? parseInt(fingMatch[1], 10) : null,
      verified: verMatch ? verMatch[1] === 'true' : false,
      role: roleMatch?.[1] || 'alumni',
      bio: bioMatch?.[1] ? decodeUnicodeEscapes(unescapeRscString(bioMatch[1])).slice(0, 500) : null,
      location: locMatch?.[1] ? decodeUnicodeEscapes(unescapeRscString(locMatch[1])) : null,
      skills: skills.slice(0, 12),
    });
  }

  return profiles;
}

export function parseProfileHtml(username: string, html: string): ParsedPublicProfile | null {
  const unescaped = html.replace(/\\"/g, '"');
  const escapedUser = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const initialProfileIdx = unescaped.indexOf('"initialProfile":{');
  const userRegex = new RegExp(`"username":"${escapedUser}"`, 'i');
  const match =
    initialProfileIdx >= 0
      ? { index: initialProfileIdx }
      : userRegex.exec(unescaped);

  let followers: number | null = null;
  let following: number | null = null;
  let fullName = username;
  let avatarUrl: string | null = null;
  let verified = false;
  let role = 'alumni';
  let bio: string | null = null;
  let location: string | null = null;
  const skills: string[] = [];

  if (match) {
    const start = Math.max(0, match.index - 100);
    const end = Math.min(unescaped.length, match.index + 6500);
    const chunk = unescaped.slice(start, end);

    const nameRegex = new RegExp(`"name":"([^"]*)","username":"${escapedUser}"`, 'i');
    const nameMatch = chunk.match(nameRegex);
    if (nameMatch?.[1]?.trim()) {
      fullName = decodeUnicodeEscapes(unescapeRscString(nameMatch[1].trim()));
    }

    const folMatch = chunk.match(/"followers":(\d+)/);
    if (folMatch) followers = parseInt(folMatch[1], 10);

    const fingMatch = chunk.match(/"following":(\d+)/);
    if (fingMatch) following = parseInt(fingMatch[1], 10);

    const avMatch = chunk.match(/"avatar":"([^"]+)"/);
    if (avMatch?.[1] && avMatch[1] !== '$undefined' && avMatch[1].startsWith('http')) {
      avatarUrl = avMatch[1];
    }

    const verMatch = chunk.match(/"verified":(true|false)/);
    if (verMatch) verified = verMatch[1] === 'true';

    const roleMatch = chunk.match(/"role":"([^"]+)"/);
    if (roleMatch?.[1]) role = roleMatch[1];

    const locMatch = chunk.match(/"location":"([^"]*)"/);
    if (locMatch?.[1]?.trim()) location = decodeUnicodeEscapes(unescapeRscString(locMatch[1].trim()));

    const bioMatch = chunk.match(/"bio":"([^"]*)"/);
    if (bioMatch?.[1]?.trim()) {
      bio = decodeUnicodeEscapes(unescapeRscString(bioMatch[1].trim())).slice(0, 600);
    }

    const skillsBlock = chunk.match(/"skills":\[(.*?)\]/);
    if (skillsBlock?.[1]) {
      for (const sm of skillsBlock[1].matchAll(/"label":"([^"]+)"/g)) {
        if (sm[1]) skills.push(decodeUnicodeEscapes(sm[1]));
      }
    }
  }

  // Fallback to rendered HTML DOM counts if RSC JSON was split across chunks
  if (followers === null) {
    const domFol = html.match(/>(\d+)\s*<\/span>\s*(?:<!--.*?-->)?\s*followers/i);
    if (domFol) followers = parseInt(domFol[1], 10);
  }
  if (following === null) {
    const domFing = html.match(/>(\d+)\s*<\/span>\s*(?:<!--.*?-->)?\s*following/i);
    if (domFing) following = parseInt(domFing[1], 10);
  }

  if (followers === null) {
    return null;
  }

  return {
    username,
    fullName,
    avatarUrl,
    profileUrl: `${BASE_URL}/${username}`,
    followers,
    following,
    verified,
    role,
    bio,
    location,
    skills: skills.slice(0, 12),
  };
}

export async function fetchAndStoreSingleProfile(
  rawInput: string,
  jobId: string | null = null
): Promise<AlumniRecord> {
  let username = rawInput.trim();
  if (username.startsWith('http')) {
    try {
      const u = new URL(username);
      username = u.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] || '';
    } catch {
      throw new Error('Invalid AlumniLink profile URL');
    }
  }
  username = username.replace(/^@/, '').trim();
  if (!username || EXCLUDED_SLUGS.has(username.toLowerCase())) {
    throw new Error('Invalid or disallowed AlumniLink username');
  }

  const profileUrl = `${BASE_URL}/${username}`;
  try {
    const html = await fetchText(profileUrl, 15000);
    const parsed = parseProfileHtml(username, html);
    if (!parsed) {
      throw new Error('Public follower count was not found on this profile page');
    }
    const { record } = store.upsertAlumni({
      ...parsed,
      source: 'verified_scrape',
      jobId,
    });
    store.recordSnapshotsForBatch([record.username], jobId);
    store.setLastSuccessfulSync(new Date().toISOString());
    store.addLog('success', `Updated @${record.username} (${record.followers} followers)`, jobId, profileUrl);
    return record;
  } catch (err) {
    const reason = (err as Error).message || 'Fetch error';
    store.recordFailure(username, profileUrl, reason);
    store.addLog('error', `Failed @${username}: ${reason}`, jobId, profileUrl);
    throw err;
  }
}

class CollectorRunner {
  private activeJob: ScrapingJob | null = null;
  private isPaused = false;
  private isCancelled = false;
  private resumeResolver: (() => void) | null = null;

  public getActiveJob(): ScrapingJob | null {
    return this.activeJob;
  }

  public pauseJob(): ScrapingJob | null {
    if (!this.activeJob || this.activeJob.status !== 'running') return this.activeJob;
    this.isPaused = true;
    this.activeJob.status = 'paused';
    store.addLog('warning', `Collection job paused at ${this.activeJob.processedCount}/${this.activeJob.totalTargets}.`, this.activeJob.id);
    store.persist();
    return this.activeJob;
  }

  public resumeJob(): ScrapingJob | null {
    if (!this.activeJob || this.activeJob.status !== 'paused') return this.activeJob;
    this.isPaused = false;
    this.activeJob.status = 'running';
    store.addLog('info', `Resumed collection job.`, this.activeJob.id);
    if (this.resumeResolver) {
      this.resumeResolver();
      this.resumeResolver = null;
    }
    store.persist();
    return this.activeJob;
  }

  public cancelJob(): ScrapingJob | null {
    if (!this.activeJob) return null;
    this.isCancelled = true;
    this.isPaused = false;
    if (this.resumeResolver) {
      this.resumeResolver();
      this.resumeResolver = null;
    }
    return this.activeJob;
  }

  public async startJob(options: {
    mode: 'discover' | 'update_all';
    limit?: number;
    throttleMs?: number;
  }): Promise<ScrapingJob> {
    if (this.activeJob && (this.activeJob.status === 'running' || this.activeJob.status === 'paused')) {
      throw new Error('A collection job is already active. Pause or cancel it first.');
    }

    const robots = await checkRobotsTxt();
    if (!robots.allowed) {
      throw new Error('robots.txt disallows automated access to public profiles.');
    }

    const throttleMs = Math.max(100, Math.min(5000, options.throttleMs ?? DEFAULT_THROTTLE_MS));
    const jobId = crypto.randomUUID();
    this.isPaused = false;
    this.isCancelled = false;

    let targets: string[] = [];

    if (options.mode === 'update_all') {
      targets = store
        .getState()
        .alumni.filter((a) => a.source !== 'manual_entry')
        .map((a) => a.username);
      if (options.limit && options.limit > 0) {
        targets = targets.slice(0, options.limit);
      }
    } else {
      store.addLog('info', 'Inspecting public feed and sitemap.xml on alumni.saylaniit.com...', jobId, `${BASE_URL}/sitemap.xml`);
      const [feedProfiles, sitemapUsernames] = await Promise.all([
        extractFeedProfiles().catch(() => [] as ParsedPublicProfile[]),
        discoverSitemapUsernames(),
      ]);

      // Immediately store live feed profiles discovered on root
      if (feedProfiles.length > 0) {
        const feedUsernames: string[] = [];
        for (const fp of feedProfiles) {
          store.upsertAlumni({ ...fp, source: 'verified_scrape', jobId });
          feedUsernames.push(fp.username);
        }
        store.recordSnapshotsForBatch(feedUsernames, jobId);
        store.addLog('success', `Extracted ${feedProfiles.length} active profiles from AlumniLink public feed.`, jobId, `${BASE_URL}/`);
      }

      // Prioritize undiscovered sitemap users first; limit=0 means all undiscovered
      const existingSet = new Set(store.getState().alumni.map((a) => a.username.toLowerCase()));
      const undiscovered = sitemapUsernames.filter((u) => !existingSet.has(u.toLowerCase()));
      const alreadyKnown = sitemapUsernames.filter((u) => existingSet.has(u.toLowerCase()));
      const combined = undiscovered.length > 0 ? undiscovered : alreadyKnown;

      if (options.limit === 0) {
        targets = combined;
      } else {
        const limit = options.limit && options.limit > 0 ? options.limit : 100;
        targets = combined.slice(0, limit);
      }
    }

    const job: ScrapingJob = {
      id: jobId,
      mode: options.mode,
      status: 'running',
      totalTargets: targets.length,
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      throttleMs,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      currentTarget: null,
      errorMessage: null,
    };

    this.activeJob = job;
    store.getState().jobs.unshift(job);
    if (store.getState().jobs.length > 50) {
      store.getState().jobs = store.getState().jobs.slice(0, 50);
    }
    store.addLog(
      'info',
      `Started ${options.mode === 'discover' ? 'public profile discovery' : 'full profile refresh'} for ${targets.length.toLocaleString()} profile(s) with ${throttleMs}ms wave throttling.`,
      jobId
    );
    store.persistSync();

    // Run in background without blocking API response
    void this.executeBatch(job, targets);
    return job;
  }

  private async executeBatch(job: ScrapingJob, targets: string[]): Promise<void> {
    const updatedUsernames: string[] = [];
    const concurrency = 8;

    try {
      for (let i = 0; i < targets.length; i += concurrency) {
        if (this.isCancelled) {
          job.status = 'cancelled';
          job.finishedAt = new Date().toISOString();
          job.currentTarget = null;
          store.addLog('warning', `Job cancelled after ${job.processedCount} profile(s).`, job.id);
          break;
        }

        while (this.isPaused && !this.isCancelled) {
          await new Promise<void>((resolve) => {
            this.resumeResolver = resolve;
          });
        }
        if (this.isCancelled) {
          job.status = 'cancelled';
          job.finishedAt = new Date().toISOString();
          job.currentTarget = null;
          store.addLog('warning', `Job cancelled after ${job.processedCount} profile(s).`, job.id);
          break;
        }

        const wave = targets.slice(i, i + concurrency);
        job.currentTarget = wave[0] ?? null;

        await Promise.all(
          wave.map(async (username) => {
            const profileUrl = `${BASE_URL}/${username}`;
            try {
              const html = await fetchText(profileUrl, 12000);
              const parsed = parseProfileHtml(username, html);
              if (parsed) {
                store.upsertAlumni({
                  ...parsed,
                  source: 'verified_scrape',
                  jobId: job.id,
                });
                updatedUsernames.push(parsed.username);
                job.successCount += 1;
              } else {
                job.skippedCount += 1;
                store.recordFailure(username, profileUrl, 'Follower count unavailable in public SSR payload');
              }
            } catch (err) {
              job.failedCount += 1;
              const msg = (err as Error).message || 'Network error';
              store.recordFailure(username, profileUrl, msg);
              store.addLog('error', `Failed @${username}: ${msg}`, job.id, profileUrl);
            }
            job.processedCount += 1;
          })
        );

        // Periodically commit snapshots and logs every ~40 profiles
        if (updatedUsernames.length >= 40) {
          const batchNames = updatedUsernames.splice(0, updatedUsernames.length);
          store.recordSnapshotsForBatch(batchNames, job.id);
          store.setLastSuccessfulSync(new Date().toISOString());
          store.addLog(
            'success',
            `Synced ${job.successCount.toLocaleString()} / ${job.totalTargets.toLocaleString()} profiles...`,
            job.id
          );
        }

        if (i + concurrency < targets.length) {
          await sleep(job.throttleMs);
        }
      }

      if (updatedUsernames.length > 0) {
        store.recordSnapshotsForBatch(updatedUsernames, job.id);
        store.setLastSuccessfulSync(new Date().toISOString());
      }

      if (job.status === 'running') {
        job.status = 'completed';
        job.finishedAt = new Date().toISOString();
        job.currentTarget = null;
        store.addLog(
          'success',
          `Completed job: ${job.successCount.toLocaleString()} succeeded, ${job.failedCount} failed, ${job.skippedCount} skipped.`,
          job.id
        );
      }
    } catch (err) {
      job.status = 'failed';
      job.errorMessage = (err as Error).message;
      job.finishedAt = new Date().toISOString();
      job.currentTarget = null;
      store.addLog('error', `Job failed: ${job.errorMessage}`, job.id);
    } finally {
      store.persistSync();
      this.activeJob = null;
    }
  }
}

export const collector = new CollectorRunner();

/**
 * Ensures initial real public data is discovered immediately on startup, then automatically
 * continues syncing all remaining undiscovered public profiles from sitemap.xml in the background.
 */
export async function ensureInitialRealSync(): Promise<void> {
  try {
    const robots = await checkRobotsTxt();
    if (!robots.allowed) {
      store.addLog('error', 'robots.txt disallowed initial discovery.');
      return;
    }

    const sitemapUsers = await discoverSitemapUsernames().catch(() => []);

    // If store is completely empty, bootstrap first ~55 profiles before returning so initial view is populated
    if (store.getState().alumni.length === 0) {
      console.log('[collector] Empty store detected — discovering initial real public AlumniLink profiles...');
      const feedProfiles = await extractFeedProfiles().catch(() => []);
      const seen = new Set<string>();
      const syncedNames: string[] = [];

      for (const fp of feedProfiles) {
        store.upsertAlumni({ ...fp, source: 'verified_scrape', jobId: 'initial-sync' });
        seen.add(fp.username.toLowerCase());
        syncedNames.push(fp.username);
      }

      const batchTargets = sitemapUsers.filter((u) => !seen.has(u.toLowerCase())).slice(0, 48);
      const concurrency = 8;
      for (let i = 0; i < batchTargets.length; i += concurrency) {
        const slice = batchTargets.slice(i, i + concurrency);
        await Promise.all(
          slice.map(async (username) => {
            try {
              const html = await fetchText(`${BASE_URL}/${username}`, 12000);
              const parsed = parseProfileHtml(username, html);
              if (parsed) {
                store.upsertAlumni({ ...parsed, source: 'verified_scrape', jobId: 'initial-sync' });
                syncedNames.push(parsed.username);
              }
            } catch {
              // Skip transient errors during initial bootstrap
            }
          })
        );
        await sleep(120);
      }

      if (syncedNames.length > 0) {
        store.recordSnapshotsForBatch(syncedNames, 'initial-sync');
        store.setLastSuccessfulSync(new Date().toISOString());
        store.addLog(
          'success',
          `Initial bootstrap synced ${syncedNames.length} profiles; continuing background discovery for remaining public profiles.`,
          'initial-sync',
          `${BASE_URL}/sitemap.xml`
        );
      }
    }

    // Ensure all featured profiles are immediately synced if missing
    const existingPreFeatured = new Set(store.getState().alumni.map((a) => a.username.toLowerCase()));
    const missingFeatured = store
      .getState()
      .featuredUsernames.filter((u) => !existingPreFeatured.has(u.toLowerCase()));
    if (missingFeatured.length > 0) {
      await Promise.all(
        missingFeatured.map((uname) => fetchAndStoreSingleProfile(uname, 'initial-sync').catch(() => null))
      );
    }

    // Automatically discover remaining undiscovered profiles from sitemap.xml in background
    const existingSet = new Set(store.getState().alumni.map((a) => a.username.toLowerCase()));
    const missingCount = sitemapUsers.filter((u) => !existingSet.has(u.toLowerCase())).length;
    if (missingCount > 0 && !collector.getActiveJob()) {
      console.log(`[collector] ${missingCount} undiscovered public profiles found in sitemap.xml — starting background sync...`);
      void collector.startJob({ mode: 'discover', limit: 0, throttleMs: 120 }).catch((err) => {
        console.error('[collector] Background full discovery failed to start:', err);
      });
    }
  } catch (err) {
    console.error('[collector] Initial sync encountered an error:', err);
    store.addLog('error', `Initial discovery failed: ${(err as Error).message}`);
  }
}
