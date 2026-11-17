/**
 * Lightweight API client for Nexora mobile.
 *
 * API URL precedence:
 * 1. EXPO_PUBLIC_API_URL (recommended for standalone environments)
 * 2. EXPO_PUBLIC_DOMAIN (temporary backwards compatibility)
 * 3. Relative /api path for same-origin web previews
 */

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const legacyDomain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
export const API_BASE = configuredApiUrl
  ? configuredApiUrl.replace(/\\/+$/, "")
  : legacyDomain
    ? `https://${legacyDomain.replace(/^https?:\\/\\//, "")}/api`
    : "/api";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface FetchOptions extends RequestInit {
  token?: string;
}

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { token, headers: extraHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extraHeaders as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });

  if (!res.ok) {
    let message = "حدث خطأ غير متوقع";
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore parse error */
    }
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}
