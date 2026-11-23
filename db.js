// TRENDORA - Supabase client (db.js)
const SUPABASE_URL = "https://elnlfgmwnkpkhfrmcubt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_7-puxTz65x9zRrh2g1rYPg_Z7VuhBRV";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
window.db = db;
