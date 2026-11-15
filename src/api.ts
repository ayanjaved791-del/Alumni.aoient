import type {
  AdminStatusResponse,
  AnalyticsResponse,
  FeaturedResponse,
  LeaderboardResponse,
  ProfileDetailResponse,
} from './types';

const TOKEN_STORAGE_KEY = 'saylani_alumnilink_admin_token';

export function getStoredAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredAdminToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage unavailability
  }
}

async function requestJson<T>(url: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (auth) {
    const token = getStoredAdminToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const res = await fetch(url, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function fetchLeaderboard(params: {
  tier?: string;
  search?: string;
  verified?: string;
  role?: string;
  sort?: string;
  order?: string;
  page?: number;
  pageSize?: number;
}): Promise<LeaderboardResponse> {
  const qs = new URLSearchParams();
  if (params.tier) qs.set('tier', params.tier);
  if (params.search) qs.set('search', params.search);
  if (params.verified) qs.set('verified', params.verified);
  if (params.role) qs.set('role', params.role);
  if (params.sort) qs.set('sort', params.sort);
  if (params.order) qs.set('order', params.order);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  return requestJson<LeaderboardResponse>(`/api/leaderboard?${qs.toString()}`);
}

export async function fetchAnalytics(): Promise<AnalyticsResponse> {
  return requestJson<AnalyticsResponse>('/api/analytics');
}

export async function fetchAlumniProfile(username: string): Promise<ProfileDetailResponse> {
  return requestJson<ProfileDetailResponse>(`/api/alumni/${encodeURIComponent(username)}`);
}

export async function refreshAlumniProfile(username: string): Promise<ProfileDetailResponse> {
  return requestJson<ProfileDetailResponse>(`/api/alumni/${encodeURIComponent(username)}/refresh`, {
    method: 'POST',
  });
}

export async function adminLogin(username: string, password: string): Promise<{ token: string; username: string }> {
  const data = await requestJson<{ token: string; username: string }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setStoredAdminToken(data.token);
  return data;
}

export async function checkAdminSession(): Promise<{ authenticated: boolean; username?: string }> {
  return requestJson<{ authenticated: boolean; username?: string }>('/api/admin/session', {}, true);
}

export async function adminLogout(): Promise<void> {
  await requestJson('/api/admin/logout', { method: 'POST' }, true).catch(() => {});
  setStoredAdminToken(null);
}

export async function fetchAdminStatus(): Promise<AdminStatusResponse> {
  return requestJson<AdminStatusResponse>('/api/admin/status', {}, true);
}

export async function startAdminCollection(payload: {
  mode: 'discover' | 'update_all';
  limit: number;
  throttleMs: number;
}): Promise<void> {
  await requestJson('/api/admin/collect/start', { method: 'POST', body: JSON.stringify(payload) }, true);
}

export async function pauseAdminCollection(): Promise<void> {
  await requestJson('/api/admin/collect/pause', { method: 'POST' }, true);
}

export async function resumeAdminCollection(): Promise<void> {
  await requestJson('/api/admin/collect/resume', { method: 'POST' }, true);
}

export async function cancelAdminCollection(): Promise<void> {
  await requestJson('/api/admin/collect/cancel', { method: 'POST' }, true);
}

export async function refreshSingleProfileAdmin(username: string): Promise<void> {
  await requestJson('/api/admin/profile/refresh', {
    method: 'POST',
    body: JSON.stringify({ username }),
  }, true);
}

export async function addManualProfileAdmin(payload: {
  mode: 'fetch' | 'manual';
  usernameOrUrl: string;
  fullName?: string;
  followers?: number;
  following?: number | null;
  avatarUrl?: string;
  role?: string;
  location?: string;
  bio?: string;
}): Promise<void> {
  await requestJson('/api/admin/profile/manual', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, true);
}

export async function deduplicateAdmin(): Promise<{ removedCount: number; remainingCount: number }> {
  return requestJson('/api/admin/deduplicate', { method: 'POST' }, true);
}

export async function clearAdminLogs(): Promise<void> {
  await requestJson('/api/admin/logs', { method: 'DELETE' }, true);
}

export async function dismissFailedProfile(username: string): Promise<void> {
  await requestJson(`/api/admin/failed/${encodeURIComponent(username)}`, { method: 'DELETE' }, true);
}

export async function fetchFeatured(): Promise<FeaturedResponse> {
  return requestJson<FeaturedResponse>('/api/featured');
}

export async function updateFeaturedAdmin(
  action: 'add' | 'remove',
  username: string
): Promise<FeaturedResponse> {
  return requestJson<FeaturedResponse>(
    '/api/admin/featured',
    {
      method: 'POST',
      body: JSON.stringify({ action, username }),
    },
    true
  );
}
