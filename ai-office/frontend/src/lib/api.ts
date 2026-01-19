export type ApiError = {
  message: string;
  status?: number;
};

export type ApiHealth = {
  status: string;
};

export type ApiExcelJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type ApiExcelJobCreateResponse = {
  job_id: string;
  status: ApiExcelJobStatus;
};

export type ApiExcelJobInfo = {
  job_id: string;
  status: ApiExcelJobStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  input_filename: string;
  prompt: string;
  llm_model: string | null;
  summary: unknown | null;
  error: string | null;
};

export type ApiAnalyticsJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type ApiAnalyticsJobCreateResponse = {
  job_id: string;
  status: ApiAnalyticsJobStatus;
};

export type ApiAnalyticsJobInfo = {
  job_id: string;
  status: ApiAnalyticsJobStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  stage?: string | null;
  progress?: number | null;
  detail?: string | null;
  input_filename: string;
  prompt: string;
  llm_model: string | null;
  summary: unknown | null;
  error: string | null;
};

export type ApiReportJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type ApiReportJobCreateResponse = {
  job_id: string;
  status: ApiReportJobStatus;
};

export type ApiReportJobInfo = {
  job_id: string;
  status: ApiReportJobStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  stage?: string | null;
  progress?: number | null;
  detail?: string | null;
  title: string;
  template: string;
  notes: string | null;
  prompt: string | null;
  inputs: { filename: string; size_bytes: number }[];
  llm_model: string | null;
  summary: unknown | null;
  error: string | null;
};

export type ApiArtifactsResponse = {
  job_id: string;
  artifacts: { name: string; exists: boolean; size_bytes: number | null }[];
};

const apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

function joinUrl(base: string, path: string) {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function apiPublicUrl(path: string) {
  return joinUrl(apiBaseUrl, path);
}

async function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  const url = joinUrl(apiBaseUrl, path);
  return await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = `Request failed: ${response.status}`;
  try {
    const data = (await response.json()) as { detail?: string; message?: string };
    message = data.detail ?? data.message ?? message;
  } catch {
    // ignore
  }
  return { message, status: response.status };
}

export async function apiGetJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiRequest(path, { ...init, method: 'GET' });

  if (!response.ok) {
    throw (await toApiError(response)) satisfies ApiError;
  }

  return (await response.json()) as T;
}

export async function apiPostFormJson<T>(path: string, formData: FormData, init?: RequestInit): Promise<T> {
  const response = await apiRequest(path, {
    ...init,
    method: 'POST',
    body: formData,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw (await toApiError(response)) satisfies ApiError;
  }

  return (await response.json()) as T;
}

export async function apiDownloadBlob(path: string, init?: RequestInit): Promise<Blob> {
  const url = joinUrl(apiBaseUrl, path);
  const response = await fetch(url, { ...init, method: 'GET' });
  if (!response.ok) {
    throw (await toApiError(response)) satisfies ApiError;
  }
  return await response.blob();
}
