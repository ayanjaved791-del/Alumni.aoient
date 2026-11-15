export type DataSourceType = 'verified_scrape' | 'manual_verified' | 'manual_entry';

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

export interface LeaderboardEntry extends AlumniRecord {
  rank: number;
  previousRank: number | null;
  rankChange: number | null;
  followerDelta: number | null;
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

export interface ScrapingLog {
  id: string;
  jobId: string | null;
  level: 'info' | 'success' | 'warning' | 'error';
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

export interface LeaderboardResponse {
  items: LeaderboardEntry[];
  podium: LeaderboardEntry[];
  featured: LeaderboardEntry[];
  total: number;
  totalAllTracked: number;
  page: number;
  pageSize: number;
  totalPages: number;
  roles: string[];
  meta: {
    lastSuccessfulSyncAt: string | null;
    sitemapTotalDiscovered: number;
    robotsAllowed: boolean;
    activeJob: ScrapingJob | null;
  };
}

export interface FeaturedResponse {
  items: LeaderboardEntry[];
  usernames: string[];
}

export interface AnalyticsResponse {
  kpis: {
    totalDiscoveredAlumni: number;
    sitemapTotalUrls: number;
    totalFollowers: number;
    averageFollowers: number;
    highestFollowerCount: number;
    highestLeaderName: string | null;
    highestLeaderUsername: string | null;
    latestUpdatedProfile: {
      username: string;
      fullName: string;
      lastUpdatedAt: string;
    } | null;
    verifiedProfilesCount: number;
    manualOrUnverifiedCount: number;
    lastSuccessfulSyncAt: string | null;
  };
  top10: Array<{
    username: string;
    fullName: string;
    followers: number;
    following: number;
    rank: number;
    verified: boolean;
  }>;
  followerDistribution: Array<{
    bucket: string;
    count: number;
  }>;
  snapshotTimeline: Array<{
    time: string;
    timestamp: number;
    totalFollowers: number;
    profilesTracked: number;
    topFollowers: number;
  }>;
  rankMovers: LeaderboardEntry[];
  recentlyDiscovered: LeaderboardEntry[];
}

export interface ProfileDetailResponse {
  profile: LeaderboardEntry;
  history: FollowerSnapshot[];
  totalTracked: number;
}

export interface AdminStatusResponse {
  activeJob: ScrapingJob | null;
  jobs: ScrapingJob[];
  logs: ScrapingLog[];
  failedProfiles: FailedProfile[];
  stats: {
    totalTracked: number;
    totalSnapshots: number;
    sitemapTotalDiscovered: number;
    lastSuccessfulSyncAt: string | null;
    robotsAllowed: boolean;
  };
}
