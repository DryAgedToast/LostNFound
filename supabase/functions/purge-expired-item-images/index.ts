import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: records, error: fetchError } = await supabase
    .from('items')
    .select('id, image_url')
    .not('image_url', 'is', null)
    .lt('image_expires_at', new Date().toISOString())
    .eq('image_purge_status', 'active');

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  const results: { id: string; status: string; error?: string }[] = [];

  for (const record of records ?? []) {
    try {
      if (record.image_url) {
        const imagePath = record.image_url.split('/item-images/')[1];
        if (imagePath) {
          await supabase.storage.from('item-images').remove([imagePath]);
        }
      }

      const { error: updateError } = await supabase
        .from('items')
        .update({
          image_url: null,
          image_purge_status: 'purged',
        })
        .eq('id', record.id);

      results.push({
        id: record.id,
        status: updateError ? 'error' : 'purged',
        error: updateError?.message,
      });
    } catch (err) {
      results.push({ id: record.id, status: 'error', error: String(err) });
    }
  }

  return new Response(
    JSON.stringify({ purged: results.filter(r => r.status === 'purged').length, results }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
