import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const config = {
  baseURL: '/api',
  timeout: 15_000,
  xsrfCookieName: 'submissions_csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  withCredentials: true,
};
export const apiClient = axios.create(config);
const sessionClient = axios.create(config);
let refreshing: Promise<void> | null = null;

async function renewSession() {
  const renew = async () => {
    // Another tab may already have renewed the shared cookie while this tab waited.
    try {
      await sessionClient.get('/auth/me/');
      return;
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
    }
    await sessionClient.get('/auth/csrf/');
    await sessionClient.post('/auth/refresh/', {});
  };
  if (typeof navigator !== 'undefined' && navigator.locks) {
    await navigator.locks.request('submissions-session-refresh', renew);
  } else {
    await renew();
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as
      | (InternalAxiosRequestConfig & { retried?: boolean })
      | undefined;
    if (
      error.response?.status !== 401 ||
      !request ||
      request.retried ||
      request.url?.includes('/auth/login/')
    )
      throw error;
    request.retried = true;
    refreshing ??= renewSession().finally(() => {
      refreshing = null;
    });
    try {
      await refreshing;
    } catch (refreshError) {
      if (
        axios.isAxiosError(refreshError) &&
        refreshError.response?.status === 401 &&
        typeof window !== 'undefined' &&
        !request.url?.includes('/auth/me/')
      ) {
        window.dispatchEvent(new Event('session-expired'));
      }
      throw refreshError;
    }
    return apiClient(request);
  },
);

export function errorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return 'Something went wrong. Please try again.';
  if (!error.response) return 'We could not reach the server. Check your connection and try again.';
  if (error.response.status === 404) return 'This record or page could not be found.';
  if (error.response.status === 429)
    return 'Too many requests. Please wait a moment and try again.';
  const data = error.response.data;
  if (data && typeof data === 'object') {
    if (typeof data.detail === 'string') return data.detail;
    return Object.entries(data)
      .map(
        ([field, value]) =>
          `${field.replaceAll('_', ' ')}: ${Array.isArray(value) ? value.join(' ') : String(value)}`,
      )
      .join(' · ');
  }
  return 'The request could not be completed. Please try again.';
}

export interface PageResult<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
export async function getData<T>(
  url: string,
  signal?: AbortSignal,
  params?: Record<string, string | number>,
) {
  return (await apiClient.get<T>(url, { signal, params })).data;
}
