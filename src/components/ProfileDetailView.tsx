import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ProfileDetailResponse } from '../types';
import { Avatar } from './Avatar';

interface ProfileDetailViewProps {
  data: ProfileDetailResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  isDark: boolean;
  onBack: () => void;
  onRefresh: (username: string) => void;
}

export function ProfileDetailView({
  data,
  loading,
  refreshing,
  error,
  isDark,
  onBack,
  onRefresh,
}: ProfileDetailViewProps) {
  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-9 w-40 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-56 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" />
        <div className="h-72 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center space-y-4">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{error || 'Profile not found.'}</p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Leaderboard
        </button>
      </div>
    );
  }

  const { profile, history, totalTracked } = data;
  const isCreator = profile.username.toLowerCase() === 'aoient';

  const chartData = history.map((snap) => ({
    date: new Date(snap.recordedAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    followers: snap.followers,
    rank: snap.rankAtSnapshot,
  }));

  const gridStroke = isDark ? '#27272a' : '#e4e4e7';
  const tickColor = isDark ? '#a1a1aa' : '#52525b';
  const chartStroke = isDark ? '#ffffff' : '#09090b';

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Leaderboard
        </button>

        <div className="flex items-center gap-3">
          {profile.source !== 'manual_entry' && (
            <button
              type="button"
              disabled={refreshing}
              onClick={() => onRefresh(profile.username)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Syncing...' : 'Refresh Live Count'}
            </button>
          )}
          <a
            href={profile.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors whitespace-nowrap"
          >
            Open on AlumniLink
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Main Profile Card */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-5 min-w-0">
            <Avatar src={profile.avatarUrl} name={profile.fullName} username={profile.username} size="xl" />
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-black dark:text-white tracking-tight">
                  {profile.fullName}
                </h1>
                {profile.verified && (
                  <BadgeCheck className="w-5 h-5 text-black dark:text-white shrink-0" aria-label="Verified" />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-mono text-zinc-800 dark:text-zinc-300">@{profile.username}</span>
                <span aria-hidden="true">·</span>
                <span>{isCreator ? 'Creator' : profile.role}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {profile.source === 'manual_entry'
                    ? 'Manual Entry (Unverified)'
                    : 'Verified Public AlumniLink Data'}
                </span>
                {profile.location && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {profile.location}
                    </span>
                  </>
                )}
              </div>

              <div className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                Last synchronized: {new Date(profile.lastUpdatedAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* 3 Metric Cells */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Current Rank</div>
            <div className="text-2xl font-display font-bold font-mono tabular-nums text-black dark:text-white mt-1">
              {isCreator ? 'Creator' : `#${profile.rank}`}
              {!isCreator && (
                <span className="text-xs font-normal text-zinc-400 ml-1.5">/ {totalTracked.toLocaleString()}</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">AlumniLink Followers</div>
            <div className="text-2xl font-display font-bold font-mono tabular-nums text-black dark:text-white mt-1">
              {profile.followers.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">AlumniLink Following</div>
            <div className="text-2xl font-display font-bold font-mono tabular-nums text-black dark:text-white mt-1">
              {profile.following !== null ? profile.following.toLocaleString() : 'Unavailable'}
            </div>
          </div>
        </div>

        {/* Bio & Skills */}
        {(profile.bio || profile.skills.length > 0) && (
          <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
            {profile.bio && (
              <div>
                <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Public Bio</h2>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed max-w-3xl">
                  {profile.bio}
                </p>
              </div>
            )}
            {profile.skills.length > 0 && (
              <div>
                <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Listed Skills</h2>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {profile.skills.join(' · ')}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Follower History Chart */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
        <div>
          <h2 className="font-display text-base font-semibold text-black dark:text-white">
            Follower Snapshot History
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Recorded AlumniLink follower counts across {history.length} snapshot(s)
          </p>
        </div>

        <div className="h-64 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="profileMonoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartStroke} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={chartStroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#09090b' : '#ffffff',
                    borderColor: isDark ? '#27272a' : '#e4e4e7',
                    borderRadius: '0.5rem',
                    color: isDark ? '#fafafa' : '#09090b',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="followers"
                  name="AlumniLink Followers"
                  stroke={chartStroke}
                  strokeWidth={2}
                  fill="url(#profileMonoGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-400">
              No snapshot history recorded yet for this profile.
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="overflow-x-auto pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="py-2 pr-4">Recorded Timestamp</th>
                  <th className="py-2 px-4 text-right">Followers</th>
                  <th className="py-2 px-4 text-right">Following</th>
                  <th className="py-2 pl-4 text-right">Rank at Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70 font-mono tabular-nums">
                {[...history].reverse().slice(0, 12).map((snap) => (
                  <tr key={snap.id} className="text-zinc-700 dark:text-zinc-300">
                    <td className="py-2 pr-4">{new Date(snap.recordedAt).toLocaleString()}</td>
                    <td className="py-2 px-4 text-right font-semibold">{snap.followers.toLocaleString()}</td>
                    <td className="py-2 px-4 text-right">{snap.following !== null ? snap.following.toLocaleString() : '—'}</td>
                    <td className="py-2 pl-4 text-right">#{snap.rankAtSnapshot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
