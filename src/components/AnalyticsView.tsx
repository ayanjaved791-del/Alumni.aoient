import { BadgeCheck } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsResponse } from '../types';
import { Avatar } from './Avatar';

interface AnalyticsViewProps {
  data: AnalyticsResponse | null;
  loading: boolean;
  isDark: boolean;
  onSelectAlumni: (username: string) => void;
}

export function AnalyticsView({ data, loading, isDark, onSelectAlumni }: AnalyticsViewProps) {
  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" />
          <div className="h-80 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Analytics data is not available yet. Run a collection sync from the Admin Console.
      </div>
    );
  }

  const { kpis, top10, followerDistribution, snapshotTimeline, recentlyDiscovered } = data;
  const gridStroke = isDark ? '#27272a' : '#e4e4e7';
  const tickColor = isDark ? '#a1a1aa' : '#52525b';
  const primaryChartFill = isDark ? '#ffffff' : '#09090b';
  const secondaryChartFill = isDark ? '#a1a1aa' : '#3f3f46';
  const tooltipStyle = {
    backgroundColor: isDark ? '#09090b' : '#ffffff',
    borderColor: isDark ? '#27272a' : '#e4e4e7',
    borderRadius: '0.5rem',
    color: isDark ? '#fafafa' : '#09090b',
    fontSize: '12px',
  };

  const kpiCards = [
    {
      label: 'Discovered Alumni',
      value: kpis.totalDiscoveredAlumni.toLocaleString(),
      detail:
        kpis.sitemapTotalUrls > 0
          ? `${kpis.sitemapTotalUrls.toLocaleString()} public profiles in sitemap`
          : 'Synced from AlumniLink',
    },
    {
      label: 'Total AlumniLink Followers',
      value: kpis.totalFollowers.toLocaleString(),
      detail: 'Platform-only follower sum',
    },
    {
      label: 'Average Followers',
      value: kpis.averageFollowers.toFixed(1),
      detail: 'Mean followers per profile',
    },
    {
      label: 'Highest Follower Count',
      value: kpis.highestFollowerCount.toLocaleString(),
      detail: kpis.highestLeaderName ? `${kpis.highestLeaderName} (@${kpis.highestLeaderUsername})` : 'No leader yet',
      actionUsername: kpis.highestLeaderUsername,
    },
    {
      label: 'Verified Profiles',
      value: kpis.verifiedProfilesCount.toLocaleString(),
      detail: `${kpis.totalDiscoveredAlumni > 0 ? Math.round((kpis.verifiedProfilesCount / kpis.totalDiscoveredAlumni) * 100) : 0}% verified on AlumniLink`,
    },
    {
      label: 'Latest Updated Profile',
      value: kpis.latestUpdatedProfile ? kpis.latestUpdatedProfile.fullName : '—',
      detail: kpis.latestUpdatedProfile
        ? `@${kpis.latestUpdatedProfile.username} · ${new Date(kpis.latestUpdatedProfile.lastUpdatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
        : 'Not synced yet',
      actionUsername: kpis.latestUpdatedProfile?.username ?? null,
      isTextValue: true,
    },
  ];

  return (
    <div className="space-y-8">
      {/* KPI Grid */}
      <section aria-label="Platform Statistics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col justify-between gap-2"
          >
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{card.label}</div>
            {card.actionUsername ? (
              <button
                type="button"
                onClick={() => onSelectAlumni(card.actionUsername!)}
                className={`text-left font-display font-bold text-black dark:text-white hover:underline transition-colors truncate ${
                  card.isTextValue ? 'text-xl' : 'text-3xl font-mono tabular-nums'
                }`}
              >
                {card.value}
              </button>
            ) : (
              <div
                className={`font-display font-bold text-black dark:text-white truncate ${
                  card.isTextValue ? 'text-xl' : 'text-3xl font-mono tabular-nums'
                }`}
              >
                {card.value}
              </div>
            )}
            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{card.detail}</div>
          </div>
        ))}
      </section>

      {/* Primary Charts Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
          <div>
            <h3 className="font-display text-base font-semibold text-black dark:text-white">
              Top 10 Alumni by Followers
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Verified AlumniLink follower counts across highest-ranked profiles
            </p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                <XAxis type="number" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="username"
                  width={110}
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="followers" name="Followers" fill={primaryChartFill} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
          <div>
            <h3 className="font-display text-base font-semibold text-black dark:text-white">
              Follower Distribution
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Number of discovered profiles grouped by AlumniLink follower tiers
            </p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={followerDistribution} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="bucket" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Alumni Count" fill={secondaryChartFill} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Snapshot Trend Over Time */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
        <div>
          <h3 className="font-display text-base font-semibold text-black dark:text-white">
            Follower Totals Across Sync Snapshots
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Cumulative AlumniLink follower totals tracked as snapshots are recorded over time
          </p>
        </div>
        <div className="h-64 w-full">
          {snapshotTimeline.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={snapshotTimeline} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="monoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryChartFill} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={primaryChartFill} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="time" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="totalFollowers"
                  name="Total Tracked Followers"
                  stroke={primaryChartFill}
                  strokeWidth={2}
                  fill="url(#monoGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-400">
              Historical trend will populate as additional sync snapshots are recorded.
            </div>
          )}
        </div>
      </section>

      {/* Recently Discovered Profiles */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-black dark:text-white">
            Recently Discovered Profiles
          </h3>
          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">Latest {recentlyDiscovered.length}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 divide-y md:divide-y-0 divide-zinc-100 dark:divide-zinc-800/80">
          {recentlyDiscovered.map((a) => (
            <button
              key={a.username}
              type="button"
              onClick={() => onSelectAlumni(a.username)}
              className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40 -mx-2 px-2 rounded-lg transition-colors border-b border-zinc-100 dark:border-zinc-800/60"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar src={a.avatarUrl} name={a.fullName} username={a.username} size="sm" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-zinc-950 dark:text-zinc-100 truncate">
                      {a.fullName}
                    </span>
                    {a.verified && <BadgeCheck className="w-3.5 h-3.5 text-black dark:text-white shrink-0" />}
                  </div>
                  <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate">
                    @{a.username} · Rank #{a.rank}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-mono tabular-nums font-semibold text-black dark:text-white">
                  {a.followers.toLocaleString()}
                </div>
                <div className="text-xs text-zinc-400">followers</div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
