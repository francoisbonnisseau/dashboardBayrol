import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GITHUB_REPOSITORY = 'francoisbonnisseau/dashboardBayrol';
const GITHUB_BRANCH = 'main';
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPOSITORY}`;
const BEGIN_MARKER = '// BEGIN MANAGED CONVERSATION STARTERS';
const END_MARKER = '// END MANAGED CONVERSATION STARTERS';
const MAX_STARTERS = 100;
const MAX_STARTER_ID_LENGTH = 200;
const MAX_STARTER_TITLE_LENGTH = 1000;

type Locale = 'fr' | 'de' | 'es';

interface ConversationStarter {
  id: string;
  title: string;
  icon: 'message-circle';
}

interface PublishRequest {
  locale: Locale;
  starters: ConversationStarter[];
}

interface DashboardSession {
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
}

interface DashboardUser {
  id: string;
  role: 'user' | 'admin';
  is_active: boolean;
}

interface GithubRefResponse {
  object: {
    sha: string;
  };
}

interface GithubCommitResponse {
  sha: string;
  tree: {
    sha: string;
  };
}

interface GithubTreeResponse {
  sha: string;
}

interface GithubBlobResponse {
  sha: string;
}

interface GithubContentResponse {
  type: string;
  encoding?: string;
  content?: string;
}

class RequestValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'RequestValidationError';
    this.status = status;
  }
}

class PublicationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublicationConfigurationError';
  }
}

class GithubApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'GithubApiError';
    this.status = status;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return toHex(digest);
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  return token || null;
}

function validatePayload(payload: unknown): PublishRequest {
  if (!isRecord(payload)) {
    throw new RequestValidationError('Request body must be an object');
  }

  const locale = payload.locale;
  if (locale !== 'fr' && locale !== 'de' && locale !== 'es') {
    throw new RequestValidationError('Locale must be one of: fr, de, es');
  }

  if (!Array.isArray(payload.starters)) {
    throw new RequestValidationError('Starters must be an array');
  }

  if (payload.starters.length > MAX_STARTERS) {
    throw new RequestValidationError(`A maximum of ${MAX_STARTERS} starters can be published`);
  }

  const ids = new Set<string>();
  const starters = payload.starters.map((value, index): ConversationStarter => {
    if (!isRecord(value)) {
      throw new RequestValidationError(`Starter at index ${index} must be an object`);
    }

    const id = value.id;
    const title = value.title;
    const icon = value.icon;

    if (typeof id !== 'string' || !id.startsWith('intro-') || id.length > MAX_STARTER_ID_LENGTH) {
      throw new RequestValidationError(`Starter at index ${index} has an invalid id`);
    }
    if (/[\u0000-\u001F\u007F]/.test(id)) {
      throw new RequestValidationError(`Starter at index ${index} has an invalid id`);
    }
    if (ids.has(id)) {
      throw new RequestValidationError(`Starter id is duplicated: ${id}`);
    }
    ids.add(id);

    if (typeof title !== 'string' || !title.trim() || title.length > MAX_STARTER_TITLE_LENGTH) {
      throw new RequestValidationError(`Starter at index ${index} has an invalid title`);
    }
    if (icon !== 'message-circle') {
      throw new RequestValidationError(`Starter at index ${index} has an invalid icon`);
    }

    return { id, title, icon };
  });

  return { locale, starters };
}

function countOccurrences(value: string, search: string): number {
  let count = 0;
  let offset = 0;

  while (true) {
    const index = value.indexOf(search, offset);
    if (index === -1) return count;
    count += 1;
    offset = index + search.length;
  }
}

function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function getMarkerIndent(content: string, markerIndex: number): string {
  const lineStart = content.lastIndexOf('\n', markerIndex - 1) + 1;
  const indent = content.slice(lineStart, markerIndex);
  if (!/^[ \t]*$/.test(indent)) {
    throw new PublicationConfigurationError(`${BEGIN_MARKER} must be on its own line`);
  }
  return indent;
}

function renderManagedBlock(starters: ConversationStarter[], indent: string, newline: string): string {
  const entryIndent = `${indent}  `;
  const fieldIndent = `${entryIndent}  `;
  const lines = [
    `${indent}${BEGIN_MARKER}`,
    `${indent}conversationStarters: [`,
  ];

  starters.forEach((starter, index) => {
    lines.push(
      `${entryIndent}{`,
      `${fieldIndent}id: ${JSON.stringify(starter.id)},`,
      `${fieldIndent}title: ${JSON.stringify(starter.title)},`,
      `${fieldIndent}icon: ${JSON.stringify(starter.icon)}`,
      `${entryIndent}}${index === starters.length - 1 ? '' : ','}`,
    );
  });

  lines.push(
    `${indent}],`,
    `${indent}${END_MARKER}`,
  );

  return lines.join(newline);
}

function replaceManagedConversationStarters(content: string, starters: ConversationStarter[]): string {
  if (countOccurrences(content, BEGIN_MARKER) !== 1 || countOccurrences(content, END_MARKER) !== 1) {
    throw new PublicationConfigurationError('Config file must contain exactly one managed conversation starter block');
  }

  const beginIndex = content.indexOf(BEGIN_MARKER);
  const endIndex = content.indexOf(END_MARKER);
  if (beginIndex === -1 || endIndex === -1 || beginIndex >= endIndex) {
    throw new PublicationConfigurationError('Config file contains an invalid managed conversation starter block');
  }

  const managedContent = content.slice(beginIndex, endIndex);
  if (!/conversationStarters\s*:\s*\[/.test(managedContent)) {
    throw new PublicationConfigurationError('Managed block does not contain conversationStarters');
  }

  const markerLineStart = content.lastIndexOf('\n', beginIndex - 1) + 1;
  const indent = getMarkerIndent(content, beginIndex);
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const replacement = renderManagedBlock(starters, indent, newline);

  return `${content.slice(0, markerLineStart)}${replacement}${content.slice(endIndex + END_MARKER.length)}`;
}

function encodeGithubPath(path: string): string {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function configPaths(locale: Locale): string[] {
  const suffix = locale.toUpperCase();
  return [
    `public/config_${suffix}.js`,
    `public/config_${suffix}_app.js`,
    `dist/config_${suffix}.js`,
    `dist/config_${suffix}_app.js`,
  ];
}

async function githubRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/vnd.github+json');
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-GitHub-Api-Version', '2022-11-28');
  headers.set('User-Agent', 'dashboardBayrol-conversation-starters');

  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...init,
    headers,
  });
  const responseText = await response.text();
  let body: unknown = null;

  if (responseText) {
    try {
      body = JSON.parse(responseText);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const message = isRecord(body) && typeof body.message === 'string' ? body.message : 'GitHub request failed';
    throw new GithubApiError(response.status, message);
  }

  return body as T;
}

async function getGithubFile(path: string, token: string): Promise<string> {
  const file = await githubRequest<GithubContentResponse>(
    `/contents/${encodeGithubPath(path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`,
    token,
  );

  if (file.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string') {
    throw new PublicationConfigurationError(`GitHub path is not a readable file: ${path}`);
  }

  return decodeBase64(file.content);
}

async function publishToGithub(locale: Locale, starters: ConversationStarter[], token: string) {
  const paths = configPaths(locale);
  const ref = await githubRequest<GithubRefResponse>(
    `/git/ref/heads/${encodeURIComponent(GITHUB_BRANCH)}`,
    token,
  );
  const baseCommitSha = ref.object.sha;
  const baseCommit = await githubRequest<GithubCommitResponse>(`/git/commits/${baseCommitSha}`, token);
  const currentFiles = await Promise.all(paths.map(async (path) => ({
    path,
    content: await getGithubFile(path, token),
  })));
  const updatedFiles = currentFiles.map(({ path, content }) => ({
    path,
    content: replaceManagedConversationStarters(content, starters),
  }));
  const changedFiles = updatedFiles.filter((file, index) => file.content !== currentFiles[index].content);

  const commitMessage = `Publish ${locale.toUpperCase()} conversation starters (${starters.length})`;
  if (changedFiles.length === 0) {
    return {
      locale,
      starterCount: starters.length,
      changedFiles: [],
      commit: null,
      commitMessage,
    };
  }

  const blobs = await Promise.all(changedFiles.map(async ({ path, content }) => ({
    path,
    blob: await githubRequest<GithubBlobResponse>('/git/blobs', token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, encoding: 'utf-8' }),
    }),
  })));

  const tree = await githubRequest<GithubTreeResponse>('/git/trees', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: baseCommit.tree.sha,
      tree: blobs.map(({ path, blob }) => ({
        path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      })),
    }),
  });

  const commit = await githubRequest<GithubCommitResponse>('/git/commits', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: commitMessage,
      tree: tree.sha,
      parents: [baseCommitSha],
    }),
  });

  try {
    await githubRequest(`/git/refs/heads/${encodeURIComponent(GITHUB_BRANCH)}`, token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
  } catch (error) {
    if (error instanceof GithubApiError && error.status === 422) {
      throw new GithubApiError(409, 'GitHub branch changed during publication');
    }
    throw error;
  }

  return {
    locale,
    starterCount: starters.length,
    changedFiles: changedFiles.map((file) => file.path),
    commit: commit.sha,
    commitMessage,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const rawToken = getBearerToken(req);
    if (!rawToken) {
      return jsonResponse({ error: 'Missing authorization token' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Missing Supabase configuration' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const sessionHash = await sha256(rawToken);
    const nowIso = new Date().toISOString();

    const { data: session, error: sessionError } = await supabase
      .from('dashboard_sessions')
      .select('user_id, expires_at, revoked_at')
      .eq('session_hash', sessionHash)
      .is('revoked_at', null)
      .gt('expires_at', nowIso)
      .limit(1)
      .maybeSingle<DashboardSession>();

    if (sessionError) {
      console.error('dashboard-publish-conversation-starters session lookup error:', sessionError);
      return jsonResponse({ error: 'Session validation failed' }, 500);
    }

    if (!session) {
      return jsonResponse({ error: 'Invalid or expired session' }, 401);
    }

    const { data: user, error: userError } = await supabase
      .from('dashboard_users')
      .select('id, role, is_active')
      .eq('id', session.user_id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle<DashboardUser>();

    if (userError) {
      console.error('dashboard-publish-conversation-starters user lookup error:', userError);
      return jsonResponse({ error: 'Session validation failed' }, 500);
    }

    if (!user) {
      return jsonResponse({ error: 'Invalid session user' }, 401);
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      throw new RequestValidationError('Invalid JSON body');
    }

    const { locale, starters } = validatePayload(payload);
    const githubToken = (Deno.env.get('GITHUB_TOKEN') || '').trim();
    if (!githubToken) {
      return jsonResponse({ error: 'GitHub publication is not configured' }, 500);
    }

    return jsonResponse(await publishToGithub(locale, starters, githubToken));
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return jsonResponse({ error: error.message }, error.status);
    }

    if (error instanceof PublicationConfigurationError) {
      console.error('dashboard-publish-conversation-starters configuration error:', error.message);
      return jsonResponse({ error: 'GitHub config files are missing their managed conversation starter markers' }, 500);
    }

    if (error instanceof GithubApiError) {
      console.error('dashboard-publish-conversation-starters GitHub error:', {
        status: error.status,
        message: error.message,
      });
      if (error.status === 409) {
        return jsonResponse({ error: 'The GitHub branch changed during publication. Please retry.' }, 409);
      }
      return jsonResponse({ error: 'Unable to publish conversation starters to GitHub' }, 502);
    }

    console.error('dashboard-publish-conversation-starters unhandled error:', error);
    return jsonResponse({ error: 'Conversation starter publication failed' }, 500);
  }
});
