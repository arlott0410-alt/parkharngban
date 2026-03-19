import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// ======================================
// Environment Variables
// ======================================

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return url;
}

function getSupabaseAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  return key;
}

function getSupabaseServiceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return key;
}

// ======================================
// Browser Client (public anon key)
// ======================================

export function createBrowserClient() {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey());
}

// ======================================
// Server Client (for Server Components / Route Handlers)
// ======================================

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component context — ignore cookie setting errors
        }
      },
    },
  });
}

// ======================================
// Admin Client (service role — bypass RLS)
// Only used in server-side API routes
// ======================================

export function createAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ======================================
// Helper: Set current user for RLS policies
// ======================================

export async function setUserContext(
  client: ReturnType<typeof createAdminClient>,
  userId: number
) {
  await client.rpc("set_config", {
    setting_name: "app.current_user_id",
    setting_value: userId.toString(),
    is_local: true,
  });
}

// ======================================
// Type-safe DB helpers
// ======================================

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: number;
          username: string | null;
          first_name: string;
          last_name: string | null;
          language_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: number;
          username?: string | null;
          first_name: string;
          last_name?: string | null;
          language_code?: string | null;
        };
        Update: {
          username?: string | null;
          first_name?: string;
          last_name?: string | null;
          language_code?: string | null;
          updated_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: number;
          status: "active" | "inactive" | "expired" | "pending";
          started_at: string | null;
          expiry_date: string | null;
          payment_ref: string | null;
          amount_lak: number;
          payment_details: unknown | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: number;
          status?: "active" | "inactive" | "expired" | "pending";
          started_at?: string | null;
          expiry_date?: string | null;
          payment_ref?: string | null;
          amount_lak?: number;
          payment_details?: unknown | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "active" | "inactive" | "expired" | "pending";
          started_at?: string | null;
          expiry_date?: string | null;
          payment_ref?: string | null;
          amount_lak?: number;
          payment_details?: unknown | null;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: number;
          type: "income" | "expense";
          amount: number;
          category_id: string | null;
          description: string | null;
          raw_text: string | null;
          ai_parsed: boolean;
          note: string | null;
          transaction_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: number;
          type: "income" | "expense";
          amount: number;
          category_id?: string | null;
          description?: string | null;
          raw_text?: string | null;
          ai_parsed?: boolean;
          note?: string | null;
          transaction_date?: string;
        };
        Update: {
          type?: "income" | "expense";
          amount?: number;
          category_id?: string | null;
          description?: string | null;
          note?: string | null;
          transaction_date?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          name_lao: string | null;
          type: "income" | "expense" | "both";
          icon: string;
          color: string;
          is_default: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          name: string;
          name_lao?: string | null;
          type: "income" | "expense" | "both";
          icon?: string;
          color?: string;
          is_default?: boolean;
          sort_order?: number;
        };
        Update: {
          name?: string;
          name_lao?: string | null;
          type?: "income" | "expense" | "both";
          icon?: string;
          color?: string;
          is_default?: boolean;
          sort_order?: number;
        };
      };
      budgets: {
        Row: {
          id: string;
          user_id: number;
          category_id: string;
          amount: number;
          month: number;
          year: number;
          created_at: string;
        };
        Insert: {
          user_id: number;
          category_id: string;
          amount: number;
          month: number;
          year: number;
        };
        Update: {
          amount?: number;
        };
      };
    };
  };
};
