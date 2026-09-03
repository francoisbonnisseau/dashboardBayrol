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

export type ConversationStarterLocale = 'fr' | 'de' | 'es';

export interface ConversationStarter {
  id: string;
  title: string;
  icon: 'message-circle';
}

interface PublishConversationStartersResponse {
  locale: ConversationStarterLocale;
  starterCount: number;
  changedFiles: string[];
  commit: string | null;
  commitMessage: string;
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

  if (response.status === 401) {
    return 'Edge function unauthorized. Disable JWT verification on this function in Supabase.';
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

export async function publishConversationStarters(
  sessionToken: string,
  locale: ConversationStarterLocale,
  starters: ConversationStarter[]
): Promise<PublishConversationStartersResponse> {
  const response = await fetch(`${getFunctionsBaseUrl()}/dashboard-publish-conversation-starters`, {
    method: 'POST',
    headers: getEdgeHeaders({
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ locale, starters }),
  });

  if (!response.ok) {
    const message = await parseError(response, 'Unable to publish conversation starters');
    throw new Error(message);
  }

  return (await response.json()) as PublishConversationStartersResponse;
}
