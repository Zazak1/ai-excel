export type ApiError = {
  message: string;
  status?: number;
};

export type ApiHealth = {
  status: string;
};

const apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

function joinUrl(base: string, path: string) {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export async function apiGetJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = joinUrl(apiBaseUrl, path);
  const response = await fetch(url, {
    ...init,
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const data = (await response.json()) as { detail?: string; message?: string };
      message = data.detail ?? data.message ?? message;
    } catch {
      // ignore
    }
    throw { message, status: response.status } satisfies ApiError;
  }

  return (await response.json()) as T;
}

