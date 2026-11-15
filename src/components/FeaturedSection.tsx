import { BadgeCheck, ExternalLink } from 'lucide-react';
import type { LeaderboardEntry } from '../types';
import { Avatar } from './Avatar';

interface FeaturedSectionProps {
  items: LeaderboardEntry[];
  loading?: boolean;
  onSelectAlumni: (username: string) => void;
  title?: string;
}

export function FeaturedSection({
  items,
  loading = false,
  onSelectAlumni,
  title = 'Featured Alumni',
}: FeaturedSectionProps) {
  if (loading && items.length === 0) {
    return (
      <section aria-label="Featured Alumni" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-40 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 animate-pulse"
            />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No featured profiles configured yet. Add featured usernames from the Admin Console.
      </section>
    );
  }

  return (
    <section aria-label="Featured Alumni" className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg font-bold text-black dark:text-white">{title}</h2>
        <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
          {items.length} curated profile{items.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((entry) => {
          const isCreator = entry.username.toLowerCase() === 'aoient';
          return (
            <article
              key={entry.username}
              onClick={() => onSelectAlumni(entry.username)}
              className={`group cursor-pointer rounded-xl border ${
                isCreator
                  ? 'border-black dark:border-white'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-black dark:hover:border-white'
              } bg-white dark:bg-zinc-900 p-5 transition-all duration-150 flex flex-col justify-between gap-4`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-mono tabular-nums font-semibold text-black dark:text-white">
                    {isCreator ? 'Creator' : `Rank #${entry.rank}`}
                  </span>
                  <a
                    href={entry.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title={`Open @${entry.username} on AlumniLink`}
                    className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors"
                  >
                    Profile
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <Avatar src={entry.avatarUrl} name={entry.fullName} username={entry.username} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-display text-sm font-bold text-black dark:text-white truncate group-hover:underline">
                        {entry.fullName}
                      </h3>
                      {entry.verified && (
                        <BadgeCheck
                          className="w-4 h-4 text-black dark:text-white shrink-0"
                          aria-label="Verified on AlumniLink"
                        />
                      )}
                    </div>
                    <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate">
                      @{entry.username} · {isCreator ? 'Creator' : entry.role}
                    </div>
                  </div>
                </div>

                {entry.bio && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                    {entry.bio.replace(/\*\*/g, '')}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-baseline justify-between gap-2">
                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">Followers</div>
                  <div className="text-xl font-display font-bold font-mono tabular-nums text-black dark:text-white">
                    {entry.followers.toLocaleString()}
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums text-xs text-zinc-500 dark:text-zinc-400">
                  <div>Following</div>
                  <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    {entry.following !== null ? entry.following.toLocaleString() : '—'}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
