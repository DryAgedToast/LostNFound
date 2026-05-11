/**
 * Ambient typings for Supabase Edge Functions (Deno) checked with the app tsconfig.
 * Single script file (no imports/exports) so `Deno` and `declare module` stay global.
 */

declare namespace Deno {
  namespace env {
    export function get(key: string): string | undefined;
  }
}

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: Record<string, unknown>
  ): any;
}
