import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
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
      console.error('dashboard-get-botpress-token session lookup error:', sessionError);
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
      console.error('dashboard-get-botpress-token user lookup error:', userError);
      return jsonResponse({ error: 'Session validation failed' }, 500);
    }

    if (!user) {
      return jsonResponse({ error: 'Invalid session user' }, 401);
    }

    const token = (Deno.env.get('BOTPRESS_TOKEN') || '').trim();
    const workspaceId = (Deno.env.get('BOTPRESS_WORKSPACE_ID') || '').trim();

    if (!token || !workspaceId) {
      return jsonResponse({ error: 'Botpress secrets are not configured' }, 500);
    }

    return jsonResponse({
      token,
      workspaceId,
      bots: {
        fr: (Deno.env.get('BOTPRESS_BOT_ID_FR') || '').trim(),
        de: (Deno.env.get('BOTPRESS_BOT_ID_DE') || '').trim(),
        es: (Deno.env.get('BOTPRESS_BOT_ID_ES') || '').trim(),
        'leroy-merlin-es': (Deno.env.get('BOTPRESS_BOT_ID_LEROY_MERLIN_ES') || '').trim(),
      },
      role: user.role,
    });
  } catch (error) {
    console.error('dashboard-get-botpress-token unhandled error:', error);
    return jsonResponse({ error: 'Invalid request' }, 400);
  }
});
