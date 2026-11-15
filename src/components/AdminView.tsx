import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Download,
  Lock,
  LogOut,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Square,
  Star,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  addManualProfileAdmin,
  adminLogin,
  adminLogout,
  cancelAdminCollection,
  checkAdminSession,
  clearAdminLogs,
  deduplicateAdmin,
  dismissFailedProfile,
  fetchAdminStatus,
  fetchFeatured,
  pauseAdminCollection,
  refreshSingleProfileAdmin,
  resumeAdminCollection,
  startAdminCollection,
  updateFeaturedAdmin,
} from '../api';
import type { AdminStatusResponse, LeaderboardEntry } from '../types';

interface AdminViewProps {
  onDataChanged: () => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function AdminView({ onDataChanged, onNotify }: AdminViewProps) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [adminUsername, setAdminUsername] = useState<string>('');
  const [loginUser, setLoginUser] = useState('admin');
  const [loginPass, setLoginPass] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const [status, setStatus] = useState<AdminStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [activeTab, setActiveTab] = useState<'logs' | 'failed' | 'jobs'>('logs');

  const [batchLimit, setBatchLimit] = useState(0); // 0 = All Undiscovered
  const [throttleMs, setThrottleMs] = useState(150);
  const [singleTarget, setSingleTarget] = useState('');
  const [singleBusy, setSingleBusy] = useState(false);

  const [manualMode, setManualMode] = useState<'fetch' | 'manual'>('fetch');
  const [manualInput, setManualInput] = useState('');
  const [manualFullName, setManualFullName] = useState('');
  const [manualFollowers, setManualFollowers] = useState('0');
  const [manualFollowing, setManualFollowing] = useState('');
  const [manualRole, setManualRole] = useState('alumni');
  const [manualBusy, setManualBusy] = useState(false);

  const [featuredItems, setFeaturedItems] = useState<LeaderboardEntry[]>([]);
  const [featuredInput, setFeaturedInput] = useState('');
  const [featuredBusy, setFeaturedBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const [data, feat] = await Promise.all([fetchAdminStatus(), fetchFeatured()]);
      setStatus(data);
      setFeaturedItems(feat.items);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('401') || msg.toLowerCase().includes('authentication')) {
        setAuthenticated(false);
      } else {
        onNotify('error', msg);
      }
    } finally {
      setLoadingStatus(false);
    }
  }, [onNotify]);

  useEffect(() => {
    checkAdminSession()
      .then((res) => {
        setAuthenticated(res.authenticated);
        if (res.username) setAdminUsername(res.username);
        if (res.authenticated) {
          void loadStatus();
        }
      })
      .catch(() => setAuthenticated(false));
  }, [loadStatus]);

  useEffect(() => {
    if (!authenticated) return;
    const active = status?.activeJob;
    if (!active || (active.status !== 'running' && active.status !== 'paused')) return;
    const timer = setInterval(() => {
      void loadStatus();
      onDataChanged();
    }, 2000);
    return () => clearInterval(timer);
  }, [authenticated, status?.activeJob, loadStatus, onDataChanged]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginBusy(true);
    try {
      const res = await adminLogin(loginUser, loginPass);
      setAuthenticated(true);
      setAdminUsername(res.username);
      setLoginPass('');
      onNotify('success', 'Signed in to Admin Console.');
      await loadStatus();
    } catch (err) {
      onNotify('error', (err as Error).message);
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    setAuthenticated(false);
    setStatus(null);
    onNotify('info', 'Signed out of Admin Console.');
  };

  const handleStart = async (mode: 'discover' | 'update_all') => {
    try {
      await startAdminCollection({ mode, limit: batchLimit, throttleMs });
      onNotify('success', mode === 'discover' ? 'Started public profile discovery.' : 'Started profile refresh job.');
      await loadStatus();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handlePause = async () => {
    await pauseAdminCollection();
    onNotify('info', 'Collection paused.');
    await loadStatus();
  };

  const handleResume = async () => {
    await resumeAdminCollection();
    onNotify('info', 'Collection resumed.');
    await loadStatus();
  };

  const handleCancel = async () => {
    await cancelAdminCollection();
    onNotify('info', 'Cancellation requested.');
    await loadStatus();
    onDataChanged();
  };

  const handleSingleRefresh = async (e: FormEvent) => {
    e.preventDefault();
    if (!singleTarget.trim()) return;
    setSingleBusy(true);
    try {
      await refreshSingleProfileAdmin(singleTarget.trim());
      onNotify('success', `Synced @${singleTarget.trim()} from AlumniLink.`);
      setSingleTarget('');
      await loadStatus();
      onDataChanged();
    } catch (err) {
      onNotify('error', (err as Error).message);
    } finally {
      setSingleBusy(false);
    }
  };

  const handleDeduplicate = async () => {
    try {
      const res = await deduplicateAdmin();
      onNotify('success', `Deduplication complete: ${res.removedCount} duplicate(s) removed.`);
      await loadStatus();
      onDataChanged();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    setManualBusy(true);
    try {
      await addManualProfileAdmin({
        mode: manualMode,
        usernameOrUrl: manualInput.trim(),
        fullName: manualFullName.trim() || undefined,
        followers: Number(manualFollowers || 0),
        following: manualFollowing !== '' ? Number(manualFollowing) : null,
        role: manualRole,
      });
      onNotify(
        'success',
        manualMode === 'fetch'
          ? 'Profile fetched and verified from AlumniLink.'
          : 'Manual profile record added.'
      );
      setManualInput('');
      setManualFullName('');
      setManualFollowers('0');
      setManualFollowing('');
      await loadStatus();
      onDataChanged();
    } catch (err) {
      onNotify('error', (err as Error).message);
    } finally {
      setManualBusy(false);
    }
  };

  if (authenticated === null) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center text-sm text-zinc-500">
        Verifying admin session...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto my-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 space-y-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-black dark:text-white">
            <Lock className="w-4 h-4" /> Protected Operations
          </div>
          <h2 className="font-display text-xl font-bold text-black dark:text-white">Admin Console Sign In</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Authenticate to start or pause AlumniLink collection jobs, inspect failed scrapes, deduplicate records, or manually import profiles.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="admin-user" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Admin Username
            </label>
            <input
              id="admin-user"
              type="text"
              required
              value={loginUser}
              onChange={(e) => setLoginUser(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="admin-pass" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Admin Password
            </label>
            <input
              id="admin-pass"
              type="password"
              required
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              placeholder="Configured via ADMIN_PASSWORD"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
          </div>

          <button
            type="submit"
            disabled={loginBusy}
            className="w-full py-2.5 px-4 text-xs font-semibold rounded-lg bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {loginBusy ? 'Signing In...' : 'Sign In to Admin Console'}
          </button>
        </form>

        <p className="text-xs text-zinc-400 dark:text-zinc-500 border-t border-zinc-100 dark:border-zinc-800 pt-4">
          Default development credentials are defined in <code className="font-mono">.env.example</code> (username:{' '}
          <code className="font-mono">admin</code>, password: <code className="font-mono">saylani-admin-change-me</code>).
        </p>
      </div>
    );
  }

  const activeJob = status?.activeJob ?? null;
  const isJobRunning = activeJob?.status === 'running';
  const isJobPaused = activeJob?.status === 'paused';
  const progressPct =
    activeJob && activeJob.totalTargets > 0
      ? Math.round((activeJob.processedCount / activeJob.totalTargets) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            Signed in as {adminUsername} · robots.txt:{' '}
            {status?.stats.robotsAllowed ? 'Permitted' : 'Restricted'}
          </div>
          <h2 className="font-display text-lg font-bold text-black dark:text-white mt-0.5">
            Data Collection & Maintenance Console
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="/api/export/csv"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </a>
          <button
            type="button"
            onClick={handleDeduplicate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
          >
            <UserCheck className="w-3.5 h-3.5" /> Remove Duplicates
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>

      {/* Collection Controls + Manual Profile Add */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-5">
          <div>
            <h3 className="font-display text-base font-semibold text-black dark:text-white">
              Automated Public Discovery & Refresh
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Discovers public profiles via <code className="font-mono">sitemap.xml</code> and feed SSR with polite wave throttling.
              {status?.stats.sitemapTotalDiscovered
                ? ` (${status.stats.totalTracked.toLocaleString()} / ${status.stats.sitemapTotalDiscovered.toLocaleString()} synced)`
                : ''}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="batch-limit" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Batch Size
              </label>
              <select
                id="batch-limit"
                value={batchLimit}
                onChange={(e) => setBatchLimit(Number(e.target.value))}
                disabled={isJobRunning || isJobPaused}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-white"
              >
                <option value={0}>All Remaining Profiles</option>
                <option value={50}>50 profiles</option>
                <option value={150}>150 profiles</option>
                <option value={500}>500 profiles</option>
                <option value={1000}>1,000 profiles</option>
              </select>
            </div>

            <div>
              <label htmlFor="throttle-ms" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Wave Throttle
              </label>
              <select
                id="throttle-ms"
                value={throttleMs}
                onChange={(e) => setThrottleMs(Number(e.target.value))}
                disabled={isJobRunning || isJobPaused}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-white"
              >
                <option value={120}>120 ms</option>
                <option value={250}>250 ms</option>
                <option value={500}>500 ms</option>
                <option value={1000}>1,000 ms</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!isJobRunning && !isJobPaused ? (
              <>
                <button
                  type="button"
                  onClick={() => handleStart('discover')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" /> Start Discovery
                </button>
                <button
                  type="button"
                  onClick={() => handleStart('update_all')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-black dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Update All Tracked
                </button>
              </>
            ) : (
              <>
                {isJobRunning ? (
                  <button
                    type="button"
                    onClick={handlePause}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black transition-colors"
                  >
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleResume}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" /> Resume
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Square className="w-3.5 h-3.5" /> Stop Job
                </button>
              </>
            )}
          </div>

          {activeJob && (
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-800 dark:text-zinc-200">
                  Status: {activeJob.status} {activeJob.currentTarget ? `(@${activeJob.currentTarget})` : ''}
                </span>
                <span className="tabular-nums text-zinc-500">
                  {activeJob.processedCount.toLocaleString()} / {activeJob.totalTargets.toLocaleString()} ({progressPct}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-black dark:bg-white transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                Success: {activeJob.successCount.toLocaleString()} · Failed: {activeJob.failedCount} · Skipped: {activeJob.skippedCount}
              </div>
            </div>
          )}

          <form onSubmit={handleSingleRefresh} className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
            <label htmlFor="single-refresh" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Update Individual Profile
            </label>
            <div className="flex items-center gap-2">
              <input
                id="single-refresh"
                type="text"
                value={singleTarget}
                onChange={(e) => setSingleTarget(e.target.value)}
                placeholder="Username or https://alumni.saylaniit.com/..."
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
              <button
                type="submit"
                disabled={singleBusy || !singleTarget.trim()}
                className="px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 whitespace-nowrap"
              >
                {singleBusy ? 'Updating...' : 'Sync Profile'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-semibold text-black dark:text-white">
                Add Alumni Profile
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Auto-fetch verified data or add a manual entry fallback
              </p>
            </div>

            <div className="inline-flex p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setManualMode('fetch')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  manualMode === 'fetch'
                    ? 'bg-black dark:bg-white text-white dark:text-black'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                Live Fetch
              </button>
              <button
                type="button"
                onClick={() => setManualMode('manual')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  manualMode === 'manual'
                    ? 'bg-black dark:bg-white text-white dark:text-black'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                Manual Entry
              </button>
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                AlumniLink Username or Profile URL
              </label>
              <input
                type="text"
                required
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="e.g. moosa or https://alumni.saylaniit.com/moosa"
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
            </div>

            {manualMode === 'manual' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={manualFullName}
                    onChange={(e) => setManualFullName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Role
                  </label>
                  <input
                    type="text"
                    value={manualRole}
                    onChange={(e) => setManualRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    AlumniLink Followers
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={manualFollowers}
                    onChange={(e) => setManualFollowers(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Following (optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={manualFollowing}
                    onChange={(e) => setManualFollowing(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-white"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={manualBusy || !manualInput.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {manualBusy
                ? 'Processing...'
                : manualMode === 'fetch'
                  ? 'Fetch & Verify Profile'
                  : 'Save Manual Entry'}
            </button>
          </form>
        </section>
      </div>

      {/* Featured Profiles Manager */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-black dark:text-white flex items-center gap-2">
              <Star className="w-4 h-4 fill-black dark:fill-white" aria-hidden="true" />
              Featured Profiles
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Curate profiles highlighted in the Featured showcase (e.g. aoient, moosa, saifullahkhan, 4hmaadd)
            </p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!featuredInput.trim()) return;
              setFeaturedBusy(true);
              try {
                const res = await updateFeaturedAdmin('add', featuredInput.trim());
                setFeaturedItems(res.items);
                setFeaturedInput('');
                onNotify('success', 'Added profile to Featured.');
                onDataChanged();
              } catch (err) {
                onNotify('error', (err as Error).message);
              } finally {
                setFeaturedBusy(false);
              }
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={featuredInput}
              onChange={(e) => setFeaturedInput(e.target.value)}
              placeholder="@username or URL"
              className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
            <button
              type="submit"
              disabled={featuredBusy || !featuredInput.trim()}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black disabled:opacity-50 whitespace-nowrap"
            >
              {featuredBusy ? 'Adding...' : 'Add Featured'}
            </button>
          </form>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {featuredItems.map((item) => (
            <div key={item.username} className="py-2.5 flex items-center justify-between gap-4 text-xs">
              <div className="min-w-0">
                <span className="font-medium text-black dark:text-white">{item.fullName}</span>{' '}
                <span className="font-mono text-zinc-500">@{item.username}</span>
                <span className="text-zinc-400 mx-1.5">·</span>
                <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                  {item.followers.toLocaleString()} followers (Rank #{item.rank})
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const res = await updateFeaturedAdmin('remove', item.username);
                  setFeaturedItems(res.items);
                  onNotify('info', `Removed @${item.username} from Featured.`);
                  onDataChanged();
                }}
                aria-label={`Remove ${item.username} from featured`}
                className="inline-flex items-center gap-1 text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Logs, Failed Profiles, and Job History */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'logs'
                  ? 'bg-black dark:bg-white text-white dark:text-black'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Collection Logs ({status?.logs.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('failed')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'failed'
                  ? 'bg-black dark:bg-white text-white dark:text-black'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Failed Profiles ({status?.failedProfiles.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('jobs')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'jobs'
                  ? 'bg-black dark:bg-white text-white dark:text-black'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Sync Jobs ({status?.jobs.length ?? 0})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadStatus}
              disabled={loadingStatus}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} /> Refresh
            </button>
            {activeTab === 'logs' && (status?.logs.length ?? 0) > 0 && (
              <button
                type="button"
                onClick={async () => {
                  await clearAdminLogs();
                  await loadStatus();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Logs
              </button>
            )}
          </div>
        </div>

        {activeTab === 'logs' && (
          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="py-2.5 px-3 w-40">Timestamp</th>
                  <th className="py-2.5 px-3 w-24">Level</th>
                  <th className="py-2.5 px-3">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                {(status?.logs.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-zinc-400">
                      No collection logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  status?.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30">
                      <td className="py-2 px-3 font-mono tabular-nums text-zinc-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3 font-mono font-medium">
                        <span
                          className={
                            log.level === 'error'
                              ? 'text-zinc-950 dark:text-white underline'
                              : log.level === 'warning'
                                ? 'text-zinc-700 dark:text-zinc-300'
                                : 'text-zinc-600 dark:text-zinc-400'
                          }
                        >
                          {log.level}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300">{log.message}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'failed' && (
          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="py-2.5 px-3">Username</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3 text-right">Attempts</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                {(status?.failedProfiles.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-zinc-400">
                      No failed profiles recorded.
                    </td>
                  </tr>
                ) : (
                  status?.failedProfiles.map((fp) => (
                    <tr key={fp.username}>
                      <td className="py-2 px-3 font-mono text-black dark:text-white">@{fp.username}</td>
                      <td className="py-2 px-3 text-zinc-600 dark:text-zinc-400">{fp.reason}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{fp.attempts}</td>
                      <td className="py-2 px-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await refreshSingleProfileAdmin(fp.username);
                              onNotify('success', `Retried @${fp.username} successfully.`);
                              await loadStatus();
                              onDataChanged();
                            } catch (err) {
                              onNotify('error', (err as Error).message);
                            }
                          }}
                          className="inline-flex items-center gap-1 text-black dark:text-white hover:underline font-medium"
                        >
                          <RotateCcw className="w-3 h-3" /> Retry
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await dismissFailedProfile(fp.username);
                            await loadStatus();
                          }}
                          className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        >
                          Dismiss
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="py-2.5 px-3">Started</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Processed</th>
                  <th className="py-2.5 px-3 text-right">Succeeded</th>
                  <th className="py-2.5 px-3 text-right">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70 font-mono tabular-nums">
                {(status?.jobs.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-400 font-sans">
                      No background jobs run yet in this session.
                    </td>
                  </tr>
                ) : (
                  status?.jobs.map((job) => (
                    <tr key={job.id}>
                      <td className="py-2 px-3 text-zinc-500">{new Date(job.startedAt).toLocaleString()}</td>
                      <td className="py-2 px-3 text-zinc-900 dark:text-zinc-200">{job.mode}</td>
                      <td className="py-2 px-3">{job.status}</td>
                      <td className="py-2 px-3 text-right">
                        {job.processedCount}/{job.totalTargets}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-black dark:text-white">
                        {job.successCount}
                      </td>
                      <td className="py-2 px-3 text-right text-zinc-500">{job.failedCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
