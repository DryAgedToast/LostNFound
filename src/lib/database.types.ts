// Minimal Database type shim — replace with output of `supabase gen types typescript` once connected
export type Database = {
  public: {
    Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>;
    Enums: Record<string, string>;
  };
};
