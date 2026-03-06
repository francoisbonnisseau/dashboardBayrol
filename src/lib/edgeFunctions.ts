type UserRole = 'user' | 'admin';

interface LoginResponse {
  sessionToken: string;
  role: UserRole;
  expiresAt: string;
}

interface BotpressConfigResponse {
  token: string;
  workspaceId: string;
  bots?: Record<string, string>;
}

function getFunctionsBaseUrl(): string {
  const baseUrl = (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || '').trim();
  if (!baseUrl) {
    throw new Error('Missing VITE_SUPABASE_FUNCTIONS_URL');
  }
  return baseUrl.replace(/\/+$/, '');
}

function getEdgeHeaders(extra?: HeadersInit): HeadersInit {
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  return {
    ...(anonKey ? { apikey: anonKey } : {}),
    ...extra,
  };
}

async function parseError(response: Response, fallback: string): Promise<string> {
  if (response.status === 401) {
    return 'Edge function unauthorized. Disable JWT verification on this function in Supabase.';
  }

  try {
    const data = await response.json();
    if (typeof data?.error === 'string' && data.error.trim()) {
      return data.error;
    }
    if (typeof data?.message === 'string' && data.message.trim()) {
      return data.message;
    }
  } catch {
    // Ignore JSON parse errors and return fallback
  }
  return fallback;
}

export async function loginWithEdge(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${getFunctionsBaseUrl()}/dashboard-login`, {
    method: 'POST',
    headers: getEdgeHeaders({
      'Content-Type': 'application/json'
    }),
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    const message = await parseError(response, 'Invalid credentials');
    throw new Error(message);
  }

  return (await response.json()) as LoginResponse;
}

export async function getBotpressConfig(sessionToken: string): Promise<BotpressConfigResponse> {
  const response = await fetch(`${getFunctionsBaseUrl()}/dashboard-get-botpress-token`, {
    method: 'GET',
    headers: getEdgeHeaders({
      Authorization: `Bearer ${sessionToken}`
    })
  });

  if (!response.ok) {
    const message = await parseError(response, 'Unable to load Botpress configuration');
    throw new Error(message);
  }

  return (await response.json()) as BotpressConfigResponse;
}
