import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  AlumniRecord,
  DataSourceType,
  FailedProfile,
  FollowerSnapshot,
  LeaderboardEntry,
  LogLevel,
  ScrapingJob,
  ScrapingLog,
  StoreSchema,
} from './types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'alumni_store.json');

const DEFAULT_FEATURED_USERNAMES = ['aoient', 'moosa', 'saifullahkhan', '4hmaadd'];

function createInitialStore(): StoreSchema {
  return {
    version: 1,
    sitemapTotalDiscovered: 0,
    lastSuccessfulSyncAt: null,
    robotsAllowed: true,
    featuredUsernames: [...DEFAULT_FEATURED_USERNAMES],
    alumni: [],
    snapshots: [],
    jobs: [],
    logs: [],
    failedProfiles: [],
    adminUsers: [
      {
        id: 'admin-1',
        username: process.env.ADMIN_USERNAME || 'admin',
        role: 'superadmin',
        lastLoginAt: null,
      },
    ],
  };
}

class StoreManager {
  private data: StoreSchema;
  private writePending = false;

  constructor() {
    this.data = this.loadFromDisk();
  }

  private loadFromDisk(): StoreSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as StoreSchema;
        if (parsed && Array.isArray(parsed.alumni)) {
          if (
            !Array.isArray(parsed.featuredUsernames) ||
            parsed.featuredUsernames.length === 0 ||
            JSON.stringify(parsed.featuredUsernames) ===
              JSON.stringify(['moosa', 'saifullahkhan', 'aoient', '4hmaadd'])
          ) {
            parsed.featuredUsernames = [...DEFAULT_FEATURED_USERNAMES];
          }
          return parsed;
        }
      }
    } catch (err) {
      console.error('[store] Failed to load store from disk, initializing fresh store:', err);
    }
    const fresh = createInitialStore();
    this.saveToDisk(fresh);
    return fresh;
  }

  private saveToDisk(target: StoreSchema = this.data): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tempPath = `${STORE_PATH}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(target, null, 2), 'utf-8');
      fs.renameSync(tempPath, STORE_PATH);
    } catch (err) {
      console.error('[store] Failed to persist store:', err);
    }
  }

  public persist(): void {
    if (this.writePending) return;
    this.writePending = true;
    setImmediate(() => {
      this.writePending = false;
      this.saveToDisk();
    });
  }

  public persistSync(): void {
    this.writePending = false;
    this.saveToDisk();
  }

  public getState(): StoreSchema {
    return this.data;
  }

  public setSitemapTotal(count: number): void {
    this.data.sitemapTotalDiscovered = count;
    this.persist();
  }

  public setRobotsAllowed(allowed: boolean): void {
    this.data.robotsAllowed = allowed;
    this.persist();
  }

  public setLastSuccessfulSync(isoTime: string): void {
    this.data.lastSuccessfulSyncAt = isoTime;
    this.persist();
  }

  public addLog(level: LogLevel, message: string, jobId: string | null = null, targetUrl: string | null = null): ScrapingLog {
    const entry: ScrapingLog = {
      id: crypto.randomUUID(),
      jobId,
      level,
      message,
      targetUrl,
      timestamp: new Date().toISOString(),
    };
    this.data.logs.unshift(entry);
    if (this.data.logs.length > 500) {
      this.data.logs = this.data.logs.slice(0, 500);
    }
    this.persist();
    return entry;
  }

  public recordFailure(username: string, profileUrl: string, reason: string): void {
    const normalized = username.toLowerCase().trim();
    const existing = this.data.failedProfiles.find((f) => f.username.toLowerCase() === normalized);
    const now = new Date().toISOString();
    if (existing) {
      existing.reason = reason;
      existing.attempts += 1;
      existing.lastFailedAt = now;
    } else {
      this.data.failedProfiles.unshift({
        username,
        profileUrl,
        reason,
        attempts: 1,
        lastFailedAt: now,
      });
    }
    if (this.data.failedProfiles.length > 300) {
      this.data.failedProfiles = this.data.failedProfiles.slice(0, 300);
    }
    this.persist();
  }

  public clearFailure(username: string): void {
    const normalized = username.toLowerCase().trim();
    this.data.failedProfiles = this.data.failedProfiles.filter(
      (f) => f.username.toLowerCase() !== normalized
    );
    this.persist();
  }

  public upsertAlumni(input: {
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
    source: DataSourceType;
    jobId?: string | null;
  }): { record: AlumniRecord; created: boolean } {
    const normalized = input.username.toLowerCase().trim();
    const now = new Date().toISOString();
    const existingIndex = this.data.alumni.findIndex(
      (a) =>
        a.username.toLowerCase().trim() === normalized ||
        a.profileUrl.toLowerCase().replace(/\/+$/, '') === input.profileUrl.toLowerCase().replace(/\/+$/, '')
    );

    let record: AlumniRecord;
    let created = false;

    if (existingIndex >= 0) {
      const existing = this.data.alumni[existingIndex];
      record = {
        ...existing,
        username: input.username.trim(),
        fullName: input.fullName.trim() || existing.fullName,
        avatarUrl: input.avatarUrl ?? existing.avatarUrl,
        profileUrl: input.profileUrl,
        followers: input.followers,
        following: input.following !== null ? input.following : existing.following,
        verified: input.verified,
        role: input.role || existing.role,
        bio: input.bio ?? existing.bio,
        location: input.location ?? existing.location,
        skills: input.skills.length > 0 ? input.skills : existing.skills,
        source: input.source,
        lastUpdatedAt: now,
        lastSyncJobId: input.jobId ?? existing.lastSyncJobId,
      };
      this.data.alumni[existingIndex] = record;
    } else {
      created = true;
      record = {
        id: crypto.randomUUID(),
        username: input.username.trim(),
        fullName: input.fullName.trim() || input.username.trim(),
        avatarUrl: input.avatarUrl,
        profileUrl: input.profileUrl,
        followers: input.followers,
        following: input.following,
        verified: input.verified,
        role: input.role || 'alumni',
        bio: input.bio,
        location: input.location,
        skills: input.skills,
        source: input.source,
        discoveredAt: now,
        lastUpdatedAt: now,
        lastSyncJobId: input.jobId ?? null,
      };
      this.data.alumni.push(record);
    }

    this.clearFailure(input.username);
    this.persist();
    return { record, created };
  }

  /**
   * Computes current sorted ranks and records a snapshot for each updated or batch-synced profile
   * only when the follower count changed or more than 10 minutes elapsed since the last snapshot.
   */
  public recordSnapshotsForBatch(usernames: string[], jobId: string | null): void {
    const sorted = [...this.data.alumni].sort((a, b) => {
      if (b.followers !== a.followers) return b.followers - a.followers;
      return a.fullName.localeCompare(b.fullName);
    });
    const rankMap = new Map<string, number>();
    sorted.forEach((item, idx) => rankMap.set(item.username.toLowerCase(), idx + 1));

    const now = new Date();
    const nowIso = now.toISOString();
    const targetSet = new Set(usernames.map((u) => u.toLowerCase()));

    for (const alumni of this.data.alumni) {
      const key = alumni.username.toLowerCase();
      if (!targetSet.has(key)) continue;

      const userSnapshots = this.data.snapshots.filter((s) => s.username.toLowerCase() === key);
      const latest = userSnapshots[userSnapshots.length - 1];
      const rank = rankMap.get(key) ?? sorted.length;

      if (!latest) {
        this.data.snapshots.push({
          id: crypto.randomUUID(),
          alumniId: alumni.id,
          username: alumni.username,
          followers: alumni.followers,
          following: alumni.following,
          rankAtSnapshot: rank,
          recordedAt: nowIso,
          jobId,
        });
      } else {
        const elapsedMs = now.getTime() - new Date(latest.recordedAt).getTime();
        if (latest.followers !== alumni.followers || latest.rankAtSnapshot !== rank || elapsedMs > 10 * 60 * 1000) {
          this.data.snapshots.push({
            id: crypto.randomUUID(),
            alumniId: alumni.id,
            username: alumni.username,
            followers: alumni.followers,
            following: alumni.following,
            rankAtSnapshot: rank,
            recordedAt: nowIso,
            jobId,
          });
        }
      }
    }

    // Keep snapshot history bounded nicely per store
    if (this.data.snapshots.length > 25000) {
      this.data.snapshots = this.data.snapshots.slice(-25000);
    }
    this.persistSync();
  }

  public getLeaderboard(): LeaderboardEntry[] {
    const sorted = [...this.data.alumni].sort((a, b) => {
      if (b.followers !== a.followers) return b.followers - a.followers;
      if ((b.following ?? 0) !== (a.following ?? 0)) return (b.following ?? 0) - (a.following ?? 0);
      return a.fullName.localeCompare(b.fullName);
    });

    // Group snapshots by username
    const snapsByUser = new Map<string, FollowerSnapshot[]>();
    for (const s of this.data.snapshots) {
      const k = s.username.toLowerCase();
      const arr = snapsByUser.get(k);
      if (arr) arr.push(s);
      else snapsByUser.set(k, [s]);
    }

    return sorted.map((alumni, idx) => {
      const rank = idx + 1;
      const history = snapsByUser.get(alumni.username.toLowerCase()) ?? [];
      let previousRank: number | null = null;
      let rankChange: number | null = null;
      let followerDelta: number | null = null;

      if (history.length >= 2) {
        const prev = history[history.length - 2];
        previousRank = prev.rankAtSnapshot;
        rankChange = prev.rankAtSnapshot - rank; // positive means improved rank (e.g. 5 -> 3 = +2)
        followerDelta = alumni.followers - prev.followers;
      } else if (history.length === 1) {
        previousRank = history[0].rankAtSnapshot;
        rankChange = history[0].rankAtSnapshot - rank;
        followerDelta = alumni.followers - history[0].followers;
      }

      return {
        ...alumni,
        rank,
        previousRank,
        rankChange,
        followerDelta,
      };
    });
  }

  public getFeaturedProfiles(): LeaderboardEntry[] {
    const leaderboard = this.getLeaderboard();
    const byUsername = new Map(leaderboard.map((e) => [e.username.toLowerCase(), e]));
    const results: LeaderboardEntry[] = [];
    for (const uname of this.data.featuredUsernames || DEFAULT_FEATURED_USERNAMES) {
      const entry = byUsername.get(uname.toLowerCase().trim());
      if (entry) results.push(entry);
    }
    return results;
  }

  public addFeaturedUsername(rawUsername: string): string[] {
    const clean = rawUsername.replace(/^@/, '').trim().toLowerCase();
    if (!clean) return this.data.featuredUsernames;
    const exists = this.data.featuredUsernames.some((u) => u.toLowerCase() === clean);
    if (!exists) {
      this.data.featuredUsernames.push(clean);
      this.persistSync();
    }
    return this.data.featuredUsernames;
  }

  public removeFeaturedUsername(rawUsername: string): string[] {
    const clean = rawUsername.replace(/^@/, '').trim().toLowerCase();
    this.data.featuredUsernames = this.data.featuredUsernames.filter((u) => u.toLowerCase() !== clean);
    this.persistSync();
    return this.data.featuredUsernames;
  }

  public getProfileWithHistory(username: string): {
    profile: LeaderboardEntry | null;
    history: FollowerSnapshot[];
  } {
    const normalized = username.toLowerCase().trim();
    const leaderboard = this.getLeaderboard();
    const profile = leaderboard.find((a) => a.username.toLowerCase() === normalized) ?? null;
    const history = this.data.snapshots
      .filter((s) => s.username.toLowerCase() === normalized)
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

    return { profile, history };
  }

  public deduplicateRecords(): { removedCount: number; remainingCount: number } {
    const seen = new Map<string, AlumniRecord>();
    let removedCount = 0;

    for (const record of this.data.alumni) {
      const key = record.username.toLowerCase().trim();
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, record);
      } else {
        removedCount += 1;
        // Keep the most recently updated or higher follower verified record
        const existingTime = new Date(existing.lastUpdatedAt).getTime();
        const candidateTime = new Date(record.lastUpdatedAt).getTime();
        if (candidateTime > existingTime) {
          seen.set(key, record);
        }
      }
    }

    if (removedCount > 0) {
      this.data.alumni = Array.from(seen.values());
      this.addLog('info', `Removed ${removedCount} duplicate alumni profile record(s).`);
      this.persistSync();
    }

    return { removedCount, remainingCount: this.data.alumni.length };
  }

  public exportLeaderboardCsv(): string {
    const entries = this.getLeaderboard();
    const headers = [
      'Rank',
      'Full Name',
      'Username',
      'AlumniLink Followers',
      'AlumniLink Following',
      'Rank Change',
      'Verified',
      'Role',
      'Source',
      'Profile URL',
      'Last Updated',
    ];

    const escapeCsv = (val: string | number | boolean | null | undefined): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [headers.join(',')];
    for (const e of entries) {
      lines.push(
        [
          e.rank,
          e.fullName,
          e.username,
          e.followers,
          e.following ?? '',
          e.rankChange ?? '',
          e.verified,
          e.role,
          e.source,
          e.profileUrl,
          e.lastUpdatedAt,
        ]
          .map(escapeCsv)
          .join(',')
      );
    }
    return lines.join('\n');
  }

  public getAnalytics() {
    const leaderboard = this.getLeaderboard();
    const totalAlumni = leaderboard.length;
    const totalFollowers = leaderboard.reduce((acc, a) => acc + a.followers, 0);
    const averageFollowers = totalAlumni > 0 ? Math.round((totalFollowers / totalAlumni) * 10) / 10 : 0;
    const highest = leaderboard[0] ?? null;
    const verifiedCount = leaderboard.filter((a) => a.verified).length;
    const unverifiedOrManualCount = leaderboard.filter((a) => a.source === 'manual_entry').length;

    const latestUpdated =
      [...leaderboard].sort(
        (a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime()
      )[0] ?? null;

    const recentlyDiscovered = [...leaderboard]
      .sort((a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime())
      .slice(0, 8);

    const top10 = leaderboard.slice(0, 10).map((a) => ({
      username: a.username,
      fullName: a.fullName,
      followers: a.followers,
      following: a.following ?? 0,
      rank: a.rank,
      verified: a.verified,
    }));

    // Follower distribution buckets
    const buckets = [
      { label: '0', min: 0, max: 0, count: 0 },
      { label: '1–5', min: 1, max: 5, count: 0 },
      { label: '6–20', min: 6, max: 20, count: 0 },
      { label: '21–50', min: 21, max: 50, count: 0 },
      { label: '51–100', min: 51, max: 100, count: 0 },
      { label: '100+', min: 101, max: Number.MAX_SAFE_INTEGER, count: 0 },
    ];
    for (const a of leaderboard) {
      const b = buckets.find((x) => a.followers >= x.min && a.followers <= x.max);
      if (b) b.count += 1;
    }

    // Historical trend across snapshot timestamps (grouped by hour/sync batch)
    const trendByBucket = new Map<
      string,
      { time: string; timestamp: number; totalFollowers: number; profilesTracked: number; topFollowers: number }
    >();

    // Group snapshots by jobId or 15-minute window
    const sortedSnapshots = [...this.data.snapshots].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );

    const latestPerUser = new Map<string, number>();
    for (const snap of sortedSnapshots) {
      latestPerUser.set(snap.username.toLowerCase(), snap.followers);
      const d = new Date(snap.recordedAt);
      const bucketTime = new Date(Math.floor(d.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000));
      const key = bucketTime.toISOString();
      let sum = 0;
      let maxF = 0;
      for (const val of latestPerUser.values()) {
        sum += val;
        if (val > maxF) maxF = val;
      }
      trendByBucket.set(key, {
        time: bucketTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        timestamp: bucketTime.getTime(),
        totalFollowers: sum,
        profilesTracked: latestPerUser.size,
        topFollowers: maxF,
      });
    }

    const snapshotTimeline = Array.from(trendByBucket.values()).slice(-24);

    // Top movers (profiles with non-zero rank changes)
    const rankMovers = leaderboard
      .filter((a) => a.rankChange !== null && a.rankChange !== 0)
      .sort((a, b) => Math.abs(b.rankChange ?? 0) - Math.abs(a.rankChange ?? 0))
      .slice(0, 8);

    return {
      kpis: {
        totalDiscoveredAlumni: totalAlumni,
        sitemapTotalUrls: this.data.sitemapTotalDiscovered,
        totalFollowers,
        averageFollowers,
        highestFollowerCount: highest?.followers ?? 0,
        highestLeaderName: highest?.fullName ?? null,
        highestLeaderUsername: highest?.username ?? null,
        latestUpdatedProfile: latestUpdated
          ? {
              username: latestUpdated.username,
              fullName: latestUpdated.fullName,
              lastUpdatedAt: latestUpdated.lastUpdatedAt,
            }
          : null,
        verifiedProfilesCount: verifiedCount,
        manualOrUnverifiedCount: unverifiedOrManualCount,
        lastSuccessfulSyncAt: this.data.lastSuccessfulSyncAt,
      },
      top10,
      followerDistribution: buckets.map(({ label, count }) => ({ bucket: label, count })),
      snapshotTimeline,
      rankMovers,
      recentlyDiscovered,
    };
  }
}

export const store = new StoreManager();
