import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Public values; access is decided by the database rules.
export const SUPABASE_URL = "https://necfldbbnithcvnrcacu.supabase.co";
const SUPABASE_KEY = "sb_publishable_YbszrHSGtpumYGeEPeWUuQ_wJexntnl";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

export type Device = {
  id: string; public_id: string; device_type: "pen" | "bracelet"; tier_id: string;
  status: "unclaimed" | "active" | "lost" | "disabled";
  product_tiers: { name: string; features: string[] } | null;
};
export const has = (d: Device, feature: string) => !!d.product_tiers?.features.includes(feature);
