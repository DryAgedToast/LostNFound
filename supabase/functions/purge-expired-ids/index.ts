import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Find all expired, non-held, active identity records
  const { data: records, error: fetchError } = await supabase
    .from('identity_records')
    .select('id, id_image_front_url, id_image_back_url')
    .lt('expires_at', new Date().toISOString())
    .eq('theft_hold', false)
    .eq('purge_status', 'active');

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  const results: { id: string; status: string; error?: string }[] = [];

  for (const record of records ?? []) {
    try {
      // Delete front image
      if (record.id_image_front_url) {
        const frontPath = record.id_image_front_url.split('/identity-records/')[1];
        if (frontPath) {
          await supabase.storage.from('identity-records').remove([frontPath]);
        }
      }

      // Delete back image
      if (record.id_image_back_url) {
        const backPath = record.id_image_back_url.split('/identity-records/')[1];
        if (backPath) {
          await supabase.storage.from('identity-records').remove([backPath]);
        }
      }

      // Nullify sensitive fields and mark as purged
      const { error: updateError } = await supabase
        .from('identity_records')
        .update({
          id_image_front_url: null,
          id_image_back_url: null,
          full_name: null,
          idanalyzer_result: null,
          purge_status: 'purged',
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
