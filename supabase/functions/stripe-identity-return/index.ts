/**
 * Public HTTPS endpoint Stripe redirects to after Identity.
 * - **Web (Expo):** optional `web_completion` query → 302 to that HTTPS URL (same origin as
 *   `openAuthSessionAsync`) so the auth popup can close.
 * - **Native:** 302 to `lostnfound://…` (see app.json `scheme`).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const APP_SCHEME = 'lostnfound';

/** Only allow redirects that look like our app routes (mitigate open redirects). */
function safeWebCompletion(raw: string | null): string | null {
  if (raw == null || raw === '') return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  let u: URL;
  try {
    u = new URL(decoded);
  } catch {
    return null;
  }
  const okProto =
    u.protocol === 'https:' ||
    (u.protocol === 'http:' &&
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1'));
  if (!okProto) return null;
  const p = u.pathname;
  const pathOk =
    p.includes('/claim/') ||
    p.includes('/staff/verify') ||
    p.includes('/--/claim/');
  if (!pathOk) return null;
  return decoded;
}

serve((req: Request) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const claimItemId = url.searchParams.get('claim_item_id');
  const claimId = url.searchParams.get('claim_id');
  const webCompletionRaw = url.searchParams.get('web_completion');
  const webTarget = safeWebCompletion(webCompletionRaw);

  if (webTarget) {
    return new Response('', {
      status: 302,
      headers: {
        Location: webTarget,
        'Cache-Control': 'no-store',
      },
    });
  }

  let deepLink: string | null = null;
  if (claimItemId) {
    deepLink = `${APP_SCHEME}://claim/${claimItemId}`;
  } else if (claimId) {
    deepLink = `${APP_SCHEME}://staff/verify?claimId=${encodeURIComponent(claimId)}`;
  }

  if (!deepLink) {
    return new Response('Missing claim_item_id or claim_id query parameter.', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  return new Response('', {
    status: 302,
    headers: {
      Location: deepLink,
      'Cache-Control': 'no-store',
    },
  });
});
