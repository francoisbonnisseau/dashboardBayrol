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

interface VerifiedUser {
  id: string;
  role: 'user' | 'admin';
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

function createSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const { username, password } = await req.json();
    const normalizedUsername = String(username ?? '').trim();
    const normalizedPassword = String(password ?? '');

    if (!normalizedUsername || !normalizedPassword) {
      return jsonResponse({ error: 'Missing credentials' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Missing Supabase configuration' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: users, error: verifyError } = await supabase.rpc('dashboard_verify_user', {
      p_username: normalizedUsername,
      p_password: normalizedPassword,
    });

    if (verifyError) {
      console.error('dashboard-login verification error:', verifyError);
      return jsonResponse({ error: 'Authentication failed' }, 500);
    }

    const user = (users?.[0] || null) as VerifiedUser | null;
    if (!user) {
      return jsonResponse({ error: 'Invalid username or password' }, 401);
    }

    const ttlHours = Number(Deno.env.get('DASHBOARD_SESSION_TTL_HOURS') || '8');
    const expiresAt = new Date(Date.now() + Math.max(ttlHours, 1) * 60 * 60 * 1000).toISOString();
    const sessionToken = createSessionToken();
    const sessionHash = await sha256(sessionToken);

    const { error: insertError } = await supabase.from('dashboard_sessions').insert({
      user_id: user.id,
      session_hash: sessionHash,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('dashboard-login session insert error:', insertError);
      return jsonResponse({ error: 'Authentication failed' }, 500);
    }

    return jsonResponse({
      sessionToken,
      role: user.role,
      expiresAt,
    });
  } catch (error) {
    console.error('dashboard-login unhandled error:', error);
    return jsonResponse({ error: 'Invalid request' }, 400);
  }
});
