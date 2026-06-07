/**
 * Lightweight API client for Nexora mobile.
 *
 * Constructs the correct base URL for both:
 *  - Replit web preview  → relative /api path works via the proxy
 *  - Expo Go on device   → must use the full HTTPS dev domain
 */

const domain = process.env.EXPO_PUBLIC_DOMAIN;
export const API_BASE = domain ? `https://${domain}/api` : "/api";

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
