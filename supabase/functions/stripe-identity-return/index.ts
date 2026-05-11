/**
 * Public HTTPS endpoint Stripe redirects to after Identity.
 * Redirects into the app via the lostnfound:// scheme (see app.json "scheme").
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const APP_SCHEME = 'lostnfound';

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

serve((req: Request) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const claimItemId = url.searchParams.get('claim_item_id');
  const claimId = url.searchParams.get('claim_id');

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

  // Custom schemes are not always followed on 302; HTML fallback improves mobile handoff.
  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${escapeAttr(deepLink)}">
<title>Return to app</title></head>
<body>
<p><a href="${escapeAttr(deepLink)}">Open LostNFound</a></p>
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
});
