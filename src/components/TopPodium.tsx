import { Award, BadgeCheck, ExternalLink } from 'lucide-react';
import type { LeaderboardEntry } from '../types';
import { Avatar } from './Avatar';

interface TopPodiumProps {
  podium: LeaderboardEntry[];
  onSelectAlumni: (username: string) => void;
}

export function TopPodium({ podium, onSelectAlumni }: TopPodiumProps) {
  if (podium.length === 0) return null;

  const slotMeta: Array<{ ring: string; orderClass: string; badgeColor: string }> = [
    {
      ring: 'border-black dark:border-white bg-white dark:bg-zinc-900',
      orderClass: 'lg:order-2 lg:-mt-3',
      badgeColor: 'text-black dark:text-white',
    },
    {
      ring: 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900',
      orderClass: 'lg:order-1',
      badgeColor: 'text-zinc-600 dark:text-zinc-400',
    },
    {
      ring: 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900',
      orderClass: 'lg:order-3',
      badgeColor: 'text-zinc-500 dark:text-zinc-500',
    },
  ];

  return (
    <section aria-label="Top 3 AlumniLink Leaders" className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-end">
      {podium.map((entry, idx) => {
        const isCreator = entry.username.toLowerCase() === 'aoient';
        const meta = slotMeta[idx] || slotMeta[2];
        const label = isCreator ? 'Creator' : entry.rank === 1 ? 'Rank #1 Leader' : `Rank #${entry.rank}`;
        return (
          <article
            key={entry.username}
            className={`rounded-xl border ${meta.ring} ${meta.orderClass} p-6 transition-transform duration-150 hover:-translate-y-0.5 flex flex-col justify-between gap-5`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <Award className={`w-4 h-4 ${meta.badgeColor}`} aria-hidden="true" />
                <span className={`font-mono tabular-nums ${idx === 0 || entry.rank === 1 ? 'text-black dark:text-white font-semibold' : ''}`}>
                  {label}
                </span>
              </div>
              <a
                href={entry.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
                title={`Open @${entry.username} on AlumniLink`}
              >
                AlumniLink
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>

            <button
              type="button"
              onClick={() => onSelectAlumni(entry.username)}
              className="flex items-center gap-4 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white rounded-lg"
            >
              <Avatar src={entry.avatarUrl} name={entry.fullName} username={entry.username} size="lg" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-display text-lg font-bold text-zinc-950 dark:text-white truncate group-hover:underline">
                    {entry.fullName}
                  </h3>
                  {entry.verified && (
                    <BadgeCheck
                      className="w-4 h-4 text-black dark:text-white shrink-0"
                      aria-label="Verified AlumniLink Profile"
                    />
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate mt-0.5">
                  @{entry.username} <span aria-hidden="true">·</span> {isCreator ? 'Creator' : entry.role}
                </p>
              </div>
            </button>

            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-baseline justify-between gap-4">
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">AlumniLink Followers</div>
                <div className="text-2xl font-display font-bold font-mono tabular-nums text-black dark:text-white mt-0.5">
                  {entry.followers.toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Following</div>
                <div className="text-base font-display font-semibold font-mono tabular-nums text-zinc-800 dark:text-zinc-200 mt-0.5">
                  {entry.following !== null ? entry.following.toLocaleString() : '—'}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
