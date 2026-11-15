import { useState } from 'react';

interface AvatarProps {
  src: string | null;
  name: string;
  username: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-2xl',
};

function getInitials(name: string, username: string): string {
  const cleaned = (name || username || 'SA').replace(/[^a-zA-Z0-9\s]/g, '').trim();
  if (!cleaned) return username.slice(0, 2).toUpperCase();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export function Avatar({ src, name, username, size = 'md', className = '' }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const sizeClass = SIZE_CLASSES[size];

  if (!src || failed) {
    return (
      <div
        className={`${sizeClass} ${className} rounded-full flex items-center justify-center shrink-0 font-display font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border border-zinc-200 dark:border-zinc-800 select-none`}
        aria-label={name}
      >
        {getInitials(name, username)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} (@${username})`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} ${className} rounded-full object-cover shrink-0 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700`}
    />
  );
}
