export type DataSourceType = 'verified_scrape' | 'manual_verified' | 'manual_entry';

export interface AlumniSkill {
  label: string;
}

export interface AlumniRecord {
  id: string;
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
  discoveredAt: string;
  lastUpdatedAt: string;
  lastSyncJobId: string | null;
}

export interface FollowerSnapshot {
  id: string;
  alumniId: string;
  username: string;
  followers: number;
  following: number | null;
  rankAtSnapshot: number;
  recordedAt: string;
  jobId: string | null;
}

export type JobStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface ScrapingJob {
  id: string;
  mode: 'discover' | 'update_all' | 'single';
  status: JobStatus;
  totalTargets: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  throttleMs: number;
  startedAt: string;
  finishedAt: string | null;
  currentTarget: string | null;
  errorMessage: string | null;
}

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface ScrapingLog {
  id: string;
  jobId: string | null;
  level: LogLevel;
  message: string;
  targetUrl: string | null;
  timestamp: string;
}

export interface FailedProfile {
  username: string;
  profileUrl: string;
  reason: string;
  attempts: number;
  lastFailedAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  role: 'superadmin' | 'admin';
  lastLoginAt: string | null;
}

export interface StoreSchema {
  version: number;
  sitemapTotalDiscovered: number;
  lastSuccessfulSyncAt: string | null;
  robotsAllowed: boolean;
  featuredUsernames: string[];
  alumni: AlumniRecord[];
  snapshots: FollowerSnapshot[];
  jobs: ScrapingJob[];
  logs: ScrapingLog[];
  failedProfiles: FailedProfile[];
  adminUsers: AdminUser[];
}

export interface LeaderboardEntry extends AlumniRecord {
  rank: number;
  previousRank: number | null;
  rankChange: number | null; // positive = moved up, negative = moved down, null = new
  followerDelta: number | null;
}
