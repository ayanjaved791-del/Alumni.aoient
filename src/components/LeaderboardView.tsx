import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
} from 'lucide-react';
import type { LeaderboardEntry } from '../types';
import { Avatar } from './Avatar';
import { FeaturedSection } from './FeaturedSection';
import { TopPodium } from './TopPodium';

export interface LeaderboardFilterState {
  tier: 'top10' | 'top50' | 'top100' | 'all';
  search: string;
  verified: 'all' | 'verified' | 'unverified';
  role: string;
  sort: 'followers' | 'following' | 'name' | 'updated';
  order: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

interface LeaderboardViewProps {
  items: LeaderboardEntry[];
  podium: LeaderboardEntry[];
  featured?: LeaderboardEntry[];
  total: number;
  totalAllTracked: number;
  page: number;
  totalPages: number;
  roles: string[];
  loading: boolean;
  error: string | null;
  filters: LeaderboardFilterState;
  showPodium?: boolean;
  showFeatured?: boolean;
  onFilterChange: (patch: Partial<LeaderboardFilterState>) => void;
  onSelectAlumni: (username: string) => void;
  onRetry: () => void;
}

function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function LeaderboardView({
  items,
  podium,
  featured = [],
  total,
  totalAllTracked,
  page,
  totalPages,
  roles,
  loading,
  error,
  filters,
  showPodium = true,
  showFeatured = false,
  onFilterChange,
  onSelectAlumni,
  onRetry,
}: LeaderboardViewProps) {
  const handleSort = (column: LeaderboardFilterState['sort']) => {
    if (filters.sort === column) {
      onFilterChange({ order: filters.order === 'desc' ? 'asc' : 'desc', page: 1 });
    } else {
      onFilterChange({ sort: column, order: column === 'name' ? 'asc' : 'desc', page: 1 });
    }
  };

  const renderSortIcon = (column: LeaderboardFilterState['sort']) => {
    if (filters.sort !== column) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" aria-hidden="true" />;
    return filters.order === 'desc' ? (
      <ArrowDown className="w-3.5 h-3.5 text-black dark:text-white" aria-hidden="true" />
    ) : (
      <ArrowUp className="w-3.5 h-3.5 text-black dark:text-white" aria-hidden="true" />
    );
  };

  const resetFilters = () => {
    onFilterChange({
      tier: 'all',
      search: '',
      verified: 'all',
      role: 'all',
      sort: 'followers',
      order: 'desc',
      page: 1,
    });
  };

  return (
    <div className="space-y-8">
      {showFeatured && !filters.search && filters.verified === 'all' && filters.role === 'all' && (
        <FeaturedSection items={featured} loading={loading} onSelectAlumni={onSelectAlumni} />
      )}

      {showPodium && !filters.search && filters.verified === 'all' && filters.role === 'all' && (
        <TopPodium podium={podium} onSelectAlumni={onSelectAlumni} />
      )}

      {/* Filter & Search Toolbar */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Segmented Tier Selector */}
          <div
            role="tablist"
            aria-label="Leaderboard Scope"
            className="inline-flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/60 self-start overflow-x-auto max-w-full"
          >
            {(
              [
                { id: 'top10', label: 'Top 10' },
                { id: 'top50', label: 'Top 50' },
                { id: 'top100', label: 'Top 100' },
                { id: 'all', label: `All Alumni (${totalAllTracked.toLocaleString()})` },
              ] as const
            ).map((tab) => {
              const active = filters.tier === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => onFilterChange({ tier: tab.id, page: 1 })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-black dark:bg-white text-white dark:text-black'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search & Secondary Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:w-64 min-w-[200px]">
              <Search
                className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={filters.search}
                onChange={(e) => onFilterChange({ search: e.target.value, page: 1 })}
                placeholder="Search name, @username, bio..."
                aria-label="Search alumni profiles"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
            </div>

            <select
              value={filters.verified}
              onChange={(e) =>
                onFilterChange({
                  verified: e.target.value as LeaderboardFilterState['verified'],
                  page: 1,
                })
              }
              aria-label="Filter by verification status"
              className="px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            >
              <option value="all">All Verification</option>
              <option value="verified">Verified Only</option>
              <option value="unverified">Unverified / Manual</option>
            </select>

            <select
              value={filters.role}
              onChange={(e) => onFilterChange({ role: e.target.value, page: 1 })}
              aria-label="Filter by platform role"
              className="px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            >
              <option value="all">All Roles</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  Role: {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Leaderboard Table */}
        {error ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity"
            >
              Retry Loading
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:-mx-5">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-y border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  <th className="py-3 pl-5 pr-3 w-20">Rank</th>
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className="inline-flex items-center gap-1.5 hover:text-black dark:hover:text-white transition-colors"
                    >
                      Alumni Profile {renderSortIcon('name')}
                    </button>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('followers')}
                      className="inline-flex items-center gap-1.5 hover:text-black dark:hover:text-white transition-colors ml-auto"
                    >
                      Followers {renderSortIcon('followers')}
                    </button>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('following')}
                      className="inline-flex items-center gap-1.5 hover:text-black dark:hover:text-white transition-colors ml-auto"
                    >
                      Following {renderSortIcon('following')}
                    </button>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('updated')}
                      className="inline-flex items-center gap-1.5 hover:text-black dark:hover:text-white transition-colors ml-auto"
                    >
                      Last Synced {renderSortIcon('updated')}
                    </button>
                  </th>
                  <th className="py-3 pl-3 pr-5 text-right w-28">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-sm">
                {loading && items.length === 0 ? (
                  Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="h-4 w-8 rounded bg-zinc-200 dark:bg-zinc-800" />
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                          <div className="space-y-1.5">
                            <div className="h-3.5 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
                            <div className="h-3 w-24 rounded bg-zinc-100 dark:bg-zinc-800/60" />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="h-4 w-10 rounded bg-zinc-200 dark:bg-zinc-800 ml-auto" />
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="h-4 w-10 rounded bg-zinc-100 dark:bg-zinc-800/60 ml-auto" />
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="h-3.5 w-14 rounded bg-zinc-100 dark:bg-zinc-800/60 ml-auto" />
                      </td>
                      <td className="py-3.5 pl-3 pr-5 text-right">
                        <div className="h-4 w-12 rounded bg-zinc-100 dark:bg-zinc-800/60 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        No alumni profiles match the active search or filter criteria.
                      </p>
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-3 px-4 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        Reset Filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  items.map((entry) => (
                    <tr
                      key={entry.username}
                      onClick={() => onSelectAlumni(entry.username)}
                      className="group cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3.5 pl-5 pr-3 font-mono tabular-nums font-semibold text-zinc-900 dark:text-zinc-200">
                        #{entry.rank}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar src={entry.avatarUrl} name={entry.fullName} username={entry.username} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-zinc-950 dark:text-white truncate group-hover:underline">
                                {entry.fullName}
                              </span>
                              {entry.verified && (
                                <BadgeCheck
                                  className="w-4 h-4 text-black dark:text-white shrink-0"
                                  aria-label="Verified on AlumniLink"
                                />
                              )}
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1.5">
                              <span className="font-mono">@{entry.username}</span>
                              <span aria-hidden="true">·</span>
                              <span>{entry.role}</span>
                              {entry.source === 'manual_entry' && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-zinc-700 dark:text-zinc-300 font-medium">Manual Entry</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-black dark:text-white">
                        {entry.followers.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                        {entry.following !== null ? entry.following.toLocaleString() : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {formatRelativeTime(entry.lastUpdatedAt)}
                      </td>
                      <td className="py-3.5 pl-3 pr-5 text-right">
                        <a
                          href={entry.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-900 hover:underline dark:text-zinc-100 whitespace-nowrap"
                        >
                          Visit
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="font-mono tabular-nums">
            Showing {items.length} of {total.toLocaleString()} matching alumni ({totalAllTracked.toLocaleString()} synced)
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2">
              <span>Rows</span>
              <select
                value={filters.pageSize}
                onChange={(e) => onFilterChange({ pageSize: Number(e.target.value), page: 1 })}
                className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 font-mono"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>

            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onFilterChange({ page: Math.max(1, page - 1) })}
                aria-label="Previous page"
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2.5 font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onFilterChange({ page: Math.min(totalPages, page + 1) })}
                aria-label="Next page"
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
