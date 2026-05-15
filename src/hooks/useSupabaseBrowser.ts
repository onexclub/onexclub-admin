"use client";

import { useMemo } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * Reusable browser client hook — prefer this over calling `createBrowserSupabaseClient()`
 * directly in multiple client components so cookie/URL env handling stays centralized.
 */
export function useSupabaseBrowser() {
  return useMemo(() => createBrowserSupabaseClient(), []);
}
