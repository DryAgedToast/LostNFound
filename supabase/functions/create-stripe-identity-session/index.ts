import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isAllowedReturnUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === 'lostnfound:' || u.protocol === 'exp:') return true;
    if (u.protocol === 'https:') return true;
    return false;
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    return jsonResponse({ error: 'Stripe is not configured (missing STRIPE_SECRET_KEY)' }, 503);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return jsonResponse({ error: 'Profile not found' }, 403);
  }

  const role = profile.role as string;
  const profileId = profile.id as string;

  let claimId: string | undefined;
  let itemId: string | undefined;
  let returnUrl: string | undefined;
  try {
    const body = (await req.json()) as {
      claim_id?: string;
      item_id?: string;
      return_url?: string;
    };
    claimId = typeof body.claim_id === 'string' ? body.claim_id : undefined;
    itemId = typeof body.item_id === 'string' ? body.item_id : undefined;
    returnUrl = typeof body.return_url === 'string' ? body.return_url : undefined;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!returnUrl || !isAllowedReturnUrl(returnUrl)) {
    return jsonResponse(
      { error: 'return_url is required and must be a lostnfound://, exp://, or https:// URL' },
      400,
    );
  }

  const isStaffReview = Boolean(claimId);
  const isClaimantBeforeClaim = Boolean(itemId) && !claimId;

  if (!isStaffReview && !isClaimantBeforeClaim) {
    return jsonResponse(
      { error: 'Provide either claim_id (staff) or item_id (claimant before submitting a claim)' },
      400,
    );
  }

  if (isStaffReview && role !== 'staff' && role !== 'admin') {
    return jsonResponse({ error: 'Staff or admin role required' }, 403);
  }

  const form = new URLSearchParams();
  form.set('type', 'document');
  form.set('return_url', returnUrl);
  form.set('metadata[supabase_user_id]', user.id);
  form.set('metadata[claimant_profile_id]', profileId);
  if (claimId) form.set('metadata[claim_id]', claimId);
  if (itemId) form.set('metadata[item_id]', itemId);

  const stripeRes = await fetch('https://api.stripe.com/v1/identity/verification_sessions', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(stripeKey + ':')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  const stripeBody = (await stripeRes.json()) as {
    id?: string;
    url?: string | null;
    error?: { message?: string };
  };

  if (!stripeRes.ok) {
    const msg = stripeBody.error?.message ?? 'Stripe request failed';
    return jsonResponse({ error: msg }, 400);
  }

  if (!stripeBody.url) {
    return jsonResponse(
      { error: 'Stripe did not return a hosted session URL. Check Identity is enabled for your account.' },
      502,
    );
  }

  return jsonResponse({
    url: stripeBody.url,
    verification_session_id: stripeBody.id,
  });
});
