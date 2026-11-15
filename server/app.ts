import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { collector, fetchAndStoreSingleProfile } from './collector.ts';
import { store } from './store.ts';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'saylani-admin-change-me';
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'saylani-alumnilink-session-key';

const profileRefreshCooldown = new Map<string, number>();

// Stateless HMAC-signed token so auth survives across serverless invocations too
function signToken(username: string): string {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const payload = `${username}:${expiresAt}:${crypto.randomBytes(12).toString('hex')}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyBearer(req: Request): { username: string } | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return null;
    const [username, expiresRaw, nonce, sig] = parts;
    const payload = `${username}:${expiresRaw}:${nonce}`;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }
    if (Date.now() > Number(expiresRaw)) {
      return null;
    }
    return { username };
  } catch {
    return null;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = verifyBearer(req);
  if (!user) {
    res.status(401).json({ error: 'Admin authentication required.' });
    return;
  }
  next();
}

export function createApiApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    const state = store.getState();
    res.json({
      ok: true,
      alumniCount: state.alumni.length,
      lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
      sitemapTotalDiscovered: state.sitemapTotalDiscovered,
    });
  });

  app.get('/api/leaderboard', (req, res) => {
    const allEntries = store.getLeaderboard();
    const podium = allEntries.slice(0, 3);

    const tier = String(req.query.tier || 'all');
    const search = String(req.query.search || '').trim().toLowerCase();
    const verifiedFilter = String(req.query.verified || 'all');
    const roleFilter = String(req.query.role || 'all').toLowerCase();
    const sortBy = String(req.query.sort || 'followers');
    const order = String(req.query.order || 'desc');
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(5, Number(req.query.pageSize || 20)));

    let filtered = allEntries;
    if (tier === 'top10') filtered = allEntries.slice(0, 10);
    else if (tier === 'top50') filtered = allEntries.slice(0, 50);
    else if (tier === 'top100') filtered = allEntries.slice(0, 100);

    if (search) {
      filtered = filtered.filter(
        (a) =>
          a.fullName.toLowerCase().includes(search) ||
          a.username.toLowerCase().includes(search) ||
          a.role.toLowerCase().includes(search) ||
          (a.bio && a.bio.toLowerCase().includes(search))
      );
    }

    if (verifiedFilter === 'verified') {
      filtered = filtered.filter((a) => a.verified);
    } else if (verifiedFilter === 'unverified') {
      filtered = filtered.filter((a) => !a.verified);
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter((a) => a.role.toLowerCase() === roleFilter);
    }

    const dir = order === 'asc' ? 1 : -1;
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'following':
          return ((a.following ?? -1) - (b.following ?? -1)) * dir;
        case 'name':
          return a.fullName.localeCompare(b.fullName) * dir;
        case 'updated':
          return (new Date(a.lastUpdatedAt).getTime() - new Date(b.lastUpdatedAt).getTime()) * dir;
        case 'followers':
        default:
          return (a.followers - b.followers) * dir || a.rank - b.rank;
      }
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const items = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

    const roles = Array.from(new Set(allEntries.map((a) => a.role.toLowerCase()))).sort();
    const state = store.getState();

    res.json({
      items,
      podium,
      featured: store.getFeaturedProfiles(),
      total,
      totalAllTracked: allEntries.length,
      page: safePage,
      pageSize,
      totalPages,
      roles,
      meta: {
        lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
        sitemapTotalDiscovered: state.sitemapTotalDiscovered,
        robotsAllowed: state.robotsAllowed,
        activeJob: collector.getActiveJob(),
      },
    });
  });

  app.get('/api/featured', async (_req, res) => {
    const state = store.getState();
    const existingSet = new Set(state.alumni.map((a) => a.username.toLowerCase()));
    const missing = (state.featuredUsernames || []).filter((u) => !existingSet.has(u.toLowerCase()));
    if (missing.length > 0) {
      await Promise.all(missing.map((u) => fetchAndStoreSingleProfile(u, null).catch(() => null)));
    }
    res.json({
      items: store.getFeaturedProfiles(),
      usernames: store.getState().featuredUsernames,
    });
  });

  app.get('/api/analytics', (_req, res) => {
    res.json(store.getAnalytics());
  });

  app.get('/api/alumni/:username', (req, res) => {
    const { profile, history } = store.getProfileWithHistory(req.params.username);
    if (!profile) {
      res.status(404).json({ error: 'Alumni profile not found.' });
      return;
    }
    res.json({
      profile,
      history,
      totalTracked: store.getState().alumni.length,
    });
  });

  app.post('/api/alumni/:username/refresh', async (req, res) => {
    const uname = req.params.username.toLowerCase().trim();
    const lastHit = profileRefreshCooldown.get(uname) ?? 0;
    const elapsed = Date.now() - lastHit;
    if (elapsed < 15000 && !verifyBearer(req)) {
      res.status(429).json({
        error: `Please wait ${Math.ceil((15000 - elapsed) / 1000)}s before refreshing this profile again.`,
      });
      return;
    }
    profileRefreshCooldown.set(uname, Date.now());
    try {
      await fetchAndStoreSingleProfile(req.params.username, null);
      const result = store.getProfileWithHistory(req.params.username);
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message || 'Failed to refresh profile from AlumniLink.' });
    }
  });

  app.get('/api/export/csv', (_req, res) => {
    const csv = store.exportLeaderboardCsv();
    const dateSlug = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="saylani-alumnilink-leaderboard-${dateSlug}.csv"`);
    res.send(csv);
  });

  app.post('/api/admin/login', (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      res.status(401).json({ error: 'Invalid admin username or password.' });
      return;
    }

    const token = signToken(username);
    const admin = store.getState().adminUsers.find((u) => u.username === username);
    if (admin) {
      admin.lastLoginAt = new Date().toISOString();
      store.persist();
    }
    res.json({ token, username, role: 'superadmin' });
  });

  app.get('/api/admin/session', (req, res) => {
    const user = verifyBearer(req);
    if (!user) {
      res.json({ authenticated: false });
      return;
    }
    res.json({ authenticated: true, username: user.username, role: 'superadmin' });
  });

  app.post('/api/admin/logout', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/admin/status', requireAdmin, (_req, res) => {
    const state = store.getState();
    res.json({
      activeJob: collector.getActiveJob(),
      jobs: state.jobs.slice(0, 20),
      logs: state.logs.slice(0, 150),
      failedProfiles: state.failedProfiles,
      stats: {
        totalTracked: state.alumni.length,
        totalSnapshots: state.snapshots.length,
        sitemapTotalDiscovered: state.sitemapTotalDiscovered,
        lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
        robotsAllowed: state.robotsAllowed,
      },
    });
  });

  app.post('/api/admin/collect/start', requireAdmin, async (req, res) => {
    try {
      const mode = req.body?.mode === 'update_all' ? 'update_all' : 'discover';
      const limit = req.body?.limit !== undefined ? Number(req.body.limit) : 100;
      const throttleMs = req.body?.throttleMs !== undefined ? Number(req.body.throttleMs) : 200;
      const job = await collector.startJob({ mode, limit, throttleMs });
      res.json({ job });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/collect/pause', requireAdmin, (_req, res) => {
    const job = collector.pauseJob();
    res.json({ job });
  });

  app.post('/api/admin/collect/resume', requireAdmin, (_req, res) => {
    const job = collector.resumeJob();
    res.json({ job });
  });

  app.post('/api/admin/collect/cancel', requireAdmin, (_req, res) => {
    const job = collector.cancelJob();
    res.json({ job });
  });

  app.post('/api/admin/profile/refresh', requireAdmin, async (req, res) => {
    const target = String(req.body?.username || '').trim();
    if (!target) {
      res.status(400).json({ error: 'Username or AlumniLink URL is required.' });
      return;
    }
    try {
      const record = await fetchAndStoreSingleProfile(target, null);
      res.json({ record });
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/profile/manual', requireAdmin, async (req, res) => {
    const mode = String(req.body?.mode || 'fetch');
    const usernameOrUrl = String(req.body?.usernameOrUrl || '').trim();

    if (!usernameOrUrl) {
      res.status(400).json({ error: 'Username or AlumniLink URL is required.' });
      return;
    }

    if (mode === 'fetch') {
      try {
        const record = await fetchAndStoreSingleProfile(usernameOrUrl, null);
        res.json({ record, created: true });
      } catch (err) {
        res.status(502).json({ error: (err as Error).message });
      }
      return;
    }

    const cleanUsername = usernameOrUrl
      .replace(/^https?:\/\/[^/]+\//i, '')
      .replace(/^@/, '')
      .replace(/\/+$/, '')
      .trim();

    if (!cleanUsername) {
      res.status(400).json({ error: 'Valid username is required.' });
      return;
    }

    const fullName = String(req.body?.fullName || cleanUsername).trim();
    const followers = Math.max(0, Number(req.body?.followers || 0));
    const followingRaw = req.body?.following;
    const following =
      followingRaw !== '' && followingRaw !== null && followingRaw !== undefined
        ? Math.max(0, Number(followingRaw))
        : null;
    const avatarUrl = req.body?.avatarUrl ? String(req.body.avatarUrl).trim() : null;
    const role = String(req.body?.role || 'alumni').trim();

    const { record, created } = store.upsertAlumni({
      username: cleanUsername,
      fullName,
      avatarUrl,
      profileUrl: `https://alumni.saylaniit.com/${cleanUsername}`,
      followers,
      following,
      verified: false,
      role,
      bio: req.body?.bio ? String(req.body.bio).trim() : null,
      location: req.body?.location ? String(req.body.location).trim() : null,
      skills: [],
      source: 'manual_entry',
      jobId: null,
    });
    store.recordSnapshotsForBatch([record.username], null);
    store.addLog('info', `Manually ${created ? 'added' : 'updated'} @${record.username} (marked manual entry).`);
    res.json({ record, created });
  });

  app.post('/api/admin/deduplicate', requireAdmin, (_req, res) => {
    const result = store.deduplicateRecords();
    res.json(result);
  });

  app.delete('/api/admin/logs', requireAdmin, (_req, res) => {
    store.getState().logs = [];
    store.persistSync();
    res.json({ ok: true });
  });

  app.delete('/api/admin/failed/:username', requireAdmin, (req, res) => {
    store.clearFailure(req.params.username);
    res.json({ ok: true });
  });

  app.post('/api/admin/featured', requireAdmin, async (req, res) => {
    const action = req.body?.action === 'remove' ? 'remove' : 'add';
    let username = String(req.body?.username || '').trim();
    if (username.startsWith('http')) {
      try {
        username = new URL(username).pathname.replace(/^\/+|\/+$/g, '').split('/')[0] || '';
      } catch {
        res.status(400).json({ error: 'Invalid AlumniLink URL.' });
        return;
      }
    }
    username = username.replace(/^@/, '').trim();
    if (!username) {
      res.status(400).json({ error: 'Username is required.' });
      return;
    }

    if (action === 'remove') {
      store.removeFeaturedUsername(username);
      res.json({ items: store.getFeaturedProfiles(), usernames: store.getState().featuredUsernames });
      return;
    }

    const exists = store.getState().alumni.some((a) => a.username.toLowerCase() === username.toLowerCase());
    if (!exists) {
      try {
        await fetchAndStoreSingleProfile(username, null);
      } catch (err) {
        res.status(502).json({ error: (err as Error).message || 'Could not fetch profile from AlumniLink.' });
        return;
      }
    }
    store.addFeaturedUsername(username);
    res.json({ items: store.getFeaturedProfiles(), usernames: store.getState().featuredUsernames });
  });

  return app;
}
