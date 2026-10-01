const env = typeof import.meta.env === 'undefined' ? {} : import.meta.env;
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const sessionKey = 'rimstackle-supabase-session';

export const supabaseConfigured = Boolean(supabaseUrl && publishableKey);

const readSession = () => { try { const value = JSON.parse(localStorage.getItem(sessionKey) || 'null'); return value?.access_token ? value : null; } catch { return null; } };
const writeSession = value => { try { if (value) localStorage.setItem(sessionKey, JSON.stringify(value)); else localStorage.removeItem(sessionKey); } catch { /* Browser storage is optional. */ } };
const request = async (path, options = {}) => {
  if (!supabaseConfigured) throw new Error('Supabase belum dikonfigurasi.');
  const session = readSession();
  const headers = { apikey: publishableKey, 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const response = await fetch(`${supabaseUrl}${path}`, { ...options, headers });
  const body = await response.text();
  let payload = null;
  try { payload = body ? JSON.parse(body) : null; } catch { payload = body; }
  if (!response.ok) throw new Error(payload?.msg || payload?.message || payload?.error_description || 'Supabase request gagal.');
  return payload;
};

export const getSupabaseSession = () => readSession();
export const currentSupabaseUser = () => readSession()?.user || null;

export async function signInWithPassword(email, password) {
  const payload = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  const session = { ...payload, expires_at: payload.expires_at || Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600) };
  writeSession(session);
  return session;
}

export async function signOut() {
  try { if (readSession()) await request('/auth/v1/logout', { method: 'POST' }); } finally { writeSession(null); }
}

export async function supabaseTable(table, query = '?select=*') {
  return request(`/rest/v1/${table}${query}`);
}

export const supabaseUpsert = (table, rows) => request(`/rest/v1/${table}`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(Array.isArray(rows) ? rows : [rows]) });
export const supabaseUpdate = (table, query, values) => request(`/rest/v1/${table}${query}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(values) });
export const supabaseDelete = (table, query) => request(`/rest/v1/${table}${query}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
