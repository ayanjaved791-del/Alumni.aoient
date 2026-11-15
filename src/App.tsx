import { useCallback, useEffect, useState } from 'react';
import { Moon, Sun, X } from 'lucide-react';
import {
  fetchAlumniProfile,
  fetchAnalytics,
  fetchFeatured,
  fetchLeaderboard,
  refreshAlumniProfile,
} from './api';
import { AdminView } from './components/AdminView';
import { AnalyticsView } from './components/AnalyticsView';
import { FeaturedSection } from './components/FeaturedSection';
import { LeaderboardView, type LeaderboardFilterState } from './components/LeaderboardView';
import { ProfileDetailView } from './components/ProfileDetailView';
import type {
  AnalyticsResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  ProfileDetailResponse,
} from './types';

type ActiveRoute =
  | { page: 'leaderboard' }
  | { page: 'featured' }
  | { page: 'analytics' }
  | { page: 'admin' }
  | { page: 'profile'; username: string };

function parseHashRoute(): ActiveRoute {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash.startsWith('/alumni/')) {
    const username = decodeURIComponent(hash.slice('/alumni/'.length).trim());
    if (username) return { page: 'profile', username };
  }
  if (hash === '/featured') return { page: 'featured' };
  if (hash === '/analytics') return { page: 'analytics' };
  if (hash === '/admin') return { page: 'admin' };
  return { page: 'leaderboard' };
}

export default function App() {
  const [route, setRoute] = useState<ActiveRoute>(() => parseHashRoute());
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('saylani_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const [filters, setFilters] = useState<LeaderboardFilterState>({
    tier: 'all',
    search: '',
    verified: 'all',
    role: 'all',
    sort: 'followers',
    order: 'desc',
    page: 1,
    pageSize: 20,
  });
  const [lbData, setLbData] = useState<LeaderboardResponse | null>(null);
  const [lbLoading, setLbLoading] = useState(true);
  const [lbError, setLbError] = useState<string | null>(null);

  const [featuredItems, setFeaturedItems] = useState<LeaderboardEntry[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(false);

  const [analyticsData, setAnalyticsData] = useState<AnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [profileData, setProfileData] = useState<ProfileDetailResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileRefreshing, setProfileRefreshing] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const notify = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem('saylani_theme', isDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDark]);

  useEffect(() => {
    const onHash = () => setRoute(parseHashRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigateTo = useCallback((next: ActiveRoute) => {
    let targetHash = '#/';
    if (next.page === 'featured') targetHash = '#/featured';
    else if (next.page === 'analytics') targetHash = '#/analytics';
    else if (next.page === 'admin') targetHash = '#/admin';
    else if (next.page === 'profile') targetHash = `#/alumni/${encodeURIComponent(next.username)}`;
    window.location.hash = targetHash;
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const loadLeaderboard = useCallback(async (silent = false) => {
    if (!silent) setLbLoading(true);
    setLbError(null);
    try {
      const res = await fetchLeaderboard(filters);
      setLbData(res);
      if (res.featured) {
        setFeaturedItems(res.featured);
      }
    } catch (err) {
      setLbError((err as Error).message || 'Failed to load leaderboard.');
    } finally {
      if (!silent) setLbLoading(false);
    }
  }, [filters]);

  const loadFeatured = useCallback(async () => {
    setFeaturedLoading(true);
    try {
      const res = await fetchFeatured();
      setFeaturedItems(res.items);
    } catch (err) {
      notify('error', (err as Error).message || 'Failed to load featured profiles.');
    } finally {
      setFeaturedLoading(false);
    }
  }, [notify]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetchAnalytics();
      setAnalyticsData(res);
    } catch (err) {
      notify('error', (err as Error).message || 'Failed to load analytics.');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [notify]);

  const loadProfile = useCallback(async (username: string) => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const res = await fetchAlumniProfile(username);
      setProfileData(res);
    } catch (err) {
      setProfileError((err as Error).message || 'Profile not found.');
      setProfileData(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (route.page === 'leaderboard') {
      void loadLeaderboard();
    } else if (route.page === 'featured') {
      void loadFeatured();
      if (!lbData) void loadLeaderboard(true);
    } else if (route.page === 'analytics') {
      void loadAnalytics();
    } else if (route.page === 'profile') {
      void loadProfile(route.username);
    }
  }, [route, loadLeaderboard, loadFeatured, loadAnalytics, loadProfile, lbData]);

  useEffect(() => {
    const active = lbData?.meta.activeJob;
    if (!active || active.status !== 'running') return;
    if (route.page !== 'leaderboard' && route.page !== 'featured' && route.page !== 'analytics') return;
    const timer = setInterval(() => {
      void loadLeaderboard(true);
      if (route.page === 'featured') void loadFeatured();
      if (route.page === 'analytics') void loadAnalytics();
    }, 3500);
    return () => clearInterval(timer);
  }, [lbData?.meta.activeJob, route.page, loadLeaderboard, loadFeatured, loadAnalytics]);

  const handleRefreshProfile = async (username: string) => {
    setProfileRefreshing(true);
    try {
      const updated = await refreshAlumniProfile(username);
      setProfileData(updated);
      notify('success', `Synced latest count for @${username}.`);
      void loadLeaderboard(true);
    } catch (err) {
      notify('error', (err as Error).message);
    } finally {
      setProfileRefreshing(false);
    }
  };

  const handleDataChanged = useCallback(() => {
    void loadLeaderboard(true);
    if (route.page === 'featured') void loadFeatured();
    if (route.page === 'analytics') void loadAnalytics();
  }, [loadLeaderboard, loadFeatured, loadAnalytics, route.page]);

  const lastSyncFormatted = lbData?.meta.lastSuccessfulSyncAt
    ? new Date(lbData.meta.lastSuccessfulSyncAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Awaiting initial sync';

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-100 flex flex-col">
      {/* 3-Zone Top Bar Contract (80% White / 20% Black) */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              navigateTo({ page: 'leaderboard' });
            }}
            className="font-display text-lg font-bold tracking-tight text-black dark:text-white whitespace-nowrap shrink-0"
          >
            AlumniLink Rank
          </a>

          <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-7 text-sm font-medium">
            {(
              [
                { id: 'leaderboard', label: 'Leaderboard' },
                { id: 'featured', label: 'Featured' },
                { id: 'analytics', label: 'Analytics' },
                { id: 'admin', label: 'Admin' },
              ] as const
            ).map((item) => {
              const active =
                route.page === item.id || (route.page === 'profile' && item.id === 'leaderboard');
              return (
                <a
                  key={item.id}
                  href={`#/${item.id === 'leaderboard' ? '' : item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo({ page: item.id });
                  }}
                  className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    active
                      ? 'border-black dark:border-white text-black dark:text-white'
                      : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="shrink-0">
            <a
              href="/api/export/csv"
              className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors whitespace-nowrap shrink-0"
            >
              Export CSV
            </a>
          </div>
        </div>

        {/* Mobile Sub-nav */}
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden border-t border-zinc-100 dark:border-zinc-800 px-4 py-2 flex items-center gap-5 overflow-x-auto text-xs font-medium"
        >
          {(
            [
              { id: 'leaderboard', label: 'Leaderboard' },
              { id: 'featured', label: 'Featured' },
              { id: 'analytics', label: 'Analytics' },
              { id: 'admin', label: 'Admin' },
            ] as const
          ).map((item) => {
            const active = route.page === item.id;
            return (
              <a
                key={item.id}
                href={`#/${item.id === 'leaderboard' ? '' : item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo({ page: item.id });
                }}
                className={`whitespace-nowrap shrink-0 py-1 ${
                  active ? 'text-black dark:text-white font-semibold underline' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {route.page !== 'profile' && (
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
            <div className="space-y-1.5 max-w-2xl">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-black dark:text-white [text-wrap:balance]">
                {route.page === 'leaderboard' && 'Saylani AlumniLink Followers Leaderboard'}
                {route.page === 'featured' && 'Featured AlumniLink Profiles'}
                {route.page === 'analytics' && 'Community Follower Analytics'}
                {route.page === 'admin' && 'Collector & Admin Operations'}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span>Source: alumni.saylaniit.com</span>
                <span aria-hidden="true">·</span>
                <span>Platform followers only</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">Last sync: {lastSyncFormatted}</span>
                {lbData?.meta.sitemapTotalDiscovered ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-200 font-medium">
                      {lbData.totalAllTracked.toLocaleString()} of {lbData.meta.sitemapTotalDiscovered.toLocaleString()} public profiles synced
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {lbData?.meta.activeJob && lbData.meta.activeJob.status === 'running' && (
                <span className="text-xs font-mono text-black dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-black dark:bg-white animate-pulse" aria-hidden="true" />
                  Syncing {lbData.meta.activeJob.processedCount.toLocaleString()}/{lbData.meta.activeJob.totalTargets.toLocaleString()}
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsDark((prev) => !prev)}
                aria-label={isDark ? 'Switch to white theme' : 'Switch to dark theme'}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
              >
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{isDark ? 'White Theme' : 'Dark Theme'}</span>
              </button>
            </div>
          </div>
        )}

        {route.page === 'leaderboard' && (
          <LeaderboardView
            items={lbData?.items ?? []}
            podium={lbData?.podium ?? []}
            featured={lbData?.featured ?? featuredItems}
            total={lbData?.total ?? 0}
            totalAllTracked={lbData?.totalAllTracked ?? 0}
            page={lbData?.page ?? 1}
            totalPages={lbData?.totalPages ?? 1}
            roles={lbData?.roles ?? []}
            loading={lbLoading}
            error={lbError}
            filters={filters}
            showPodium={true}
            showFeatured={true}
            onFilterChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
            onSelectAlumni={(username) => navigateTo({ page: 'profile', username })}
            onRetry={() => loadLeaderboard(false)}
          />
        )}

        {route.page === 'featured' && (
          <div className="space-y-6">
            <FeaturedSection
              items={featuredItems}
              loading={featuredLoading}
              title="Featured Alumni"
              onSelectAlumni={(username) => navigateTo({ page: 'profile', username })}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigateTo({ page: 'leaderboard' })}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                View Full Leaderboard
              </button>
            </div>
          </div>
        )}

        {route.page === 'analytics' && (
          <AnalyticsView
            data={analyticsData}
            loading={analyticsLoading}
            isDark={isDark}
            onSelectAlumni={(username) => navigateTo({ page: 'profile', username })}
          />
        )}

        {route.page === 'profile' && (
          <ProfileDetailView
            data={profileData}
            loading={profileLoading}
            refreshing={profileRefreshing}
            error={profileError}
            isDark={isDark}
            onBack={() => navigateTo({ page: 'leaderboard' })}
            onRefresh={handleRefreshProfile}
          />
        )}

        {route.page === 'admin' && (
          <AdminView onDataChanged={handleDataChanged} onNotify={notify} />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <div>
            Saylani AlumniLink Followers Leaderboard · Publicly accessible follower metrics from{' '}
            <a
              href="https://alumni.saylaniit.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-black dark:text-white font-medium hover:underline"
            >
              alumni.saylaniit.com
            </a>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigateTo({ page: 'featured' })}
              className="hover:text-black dark:hover:text-white transition-colors"
            >
              Featured
            </button>
            <button
              type="button"
              onClick={() => navigateTo({ page: 'analytics' })}
              className="hover:text-black dark:hover:text-white transition-colors"
            >
              Analytics
            </button>
            <button
              type="button"
              onClick={() => navigateTo({ page: 'admin' })}
              className="hover:text-black dark:hover:text-white transition-colors"
            >
              Admin Console
            </button>
          </div>
        </div>
      </footer>

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border px-4 py-3 text-xs font-medium shadow-lg flex items-center gap-3 ${
            toast.type === 'error'
              ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
              : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
          }`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="opacity-70 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
