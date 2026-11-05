// Cloud sync for one user. The cloud holds one JSON document per user:
// { expenses: [{id,name,amount,category,date,u}], tombs: {id: u}, budget: {v,u} | null }
// "u" = time of the last change. Two copies are merged item by item, newest change wins,
// so an older device can never wipe newer cloud data.

const CAT_NAMES = ['Food', 'Travel', 'Shopping', 'Bills', 'Other'];
const TOMB_TTL = 365 * 24 * 60 * 60 * 1000;

export const emptyDoc = () => ({ expenses: [], tombs: {}, budget: null });

function cleanExpense(e) {
  if (!e || !e.id || typeof e.date !== 'string') return null;
  const amount = Number(e.amount);
  if (!Number.isFinite(amount)) return null;
  return {
    id: String(e.id),
    name: String(e.name || 'Untitled').slice(0, 80),
    amount,
    category: CAT_NAMES.includes(e.category) ? e.category : 'Other',
    date: e.date,
    u: Number(e.u) || 0,
  };
}

export function cleanDoc(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const expenses = (Array.isArray(d.expenses) ? d.expenses : []).map(cleanExpense).filter(Boolean);
  const tombs = {};
  if (d.tombs && typeof d.tombs === 'object') {
    Object.entries(d.tombs).forEach(([id, u]) => {
      if (Number.isFinite(Number(u))) tombs[id] = Number(u);
    });
  }
  let budget = null;
  if (d.budget && Number.isFinite(Number(d.budget.v)) && Number(d.budget.v) > 0) {
    budget = { v: Number(d.budget.v), u: Number(d.budget.u) || 0 };
  }
  return { expenses, tombs, budget };
}

export function mergeDocs(a, b) {
  const docs = [cleanDoc(a), cleanDoc(b)];
  const state = new Map();
  const put = (id, u, e) => {
    const cur = state.get(id);
    if (!cur || u > cur.u || (u === cur.u && !e && cur.e)) state.set(id, { u, e });
  };
  docs.forEach((d) => {
    d.expenses.forEach((e) => put(e.id, e.u, e));
    Object.entries(d.tombs).forEach(([id, u]) => put(id, u, null));
  });
  const cutoff = Date.now() - TOMB_TTL;
  const expenses = [];
  const tombs = {};
  state.forEach((s, id) => {
    if (s.e) expenses.push(s.e);
    else if (s.u > cutoff) tombs[id] = s.u;
  });
  expenses.sort((x, y) => y.u - x.u);
  const budgets = docs.map((d) => d.budget).filter(Boolean).sort((x, y) => y.u - x.u);
  return { expenses, tombs, budget: budgets[0] || null };
}

function signature(raw) {
  const d = cleanDoc(raw);
  const parts = d.expenses.map((e) => 'e' + e.id + ':' + e.u);
  Object.entries(d.tombs).forEach(([id, u]) => parts.push('t' + id + ':' + u));
  parts.sort();
  parts.push('b' + (d.budget ? d.budget.u + ':' + d.budget.v : '-'));
  return parts.join('|');
}
export const docEqual = (a, b) => signature(a) === signature(b);

const ckey = (uid) => 'et.cache.v2.' + uid;
export function loadCache(uid) {
  try {
    const raw = localStorage.getItem(ckey(uid));
    if (raw) return cleanDoc(JSON.parse(raw));
  } catch { /* a broken cache is fine: the cloud copy restores everything */ }
  return emptyDoc();
}
export function saveCache(uid, doc) {
  try { localStorage.setItem(ckey(uid), JSON.stringify(doc)); } catch { /* ignore */ }
}
export function clearCache(uid) {
  try { localStorage.removeItem(ckey(uid)); } catch { /* ignore */ }
}

export async function peekVersion(supabase, uid) {
  const { data, error } = await supabase.from('user_data').select('version').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return data ? data.version : 0;
}

// Pull, merge, push (only if the cloud is missing something). Never overwrites newer cloud data.
export async function syncOnce(supabase, uid, local) {
  let doc = cleanDoc(local);
  for (let i = 0; i < 4; i += 1) {
    const { data: row, error } = await supabase
      .from('user_data').select('data,version').eq('user_id', uid).maybeSingle();
    if (error) throw error;
    if (!row) {
      const { error: e2 } = await supabase.from('user_data').insert({ user_id: uid, data: doc, version: 1 });
      if (!e2) return { doc, version: 1 };
      if (e2.code !== '23505') throw e2;
      continue; // someone created it a moment ago: pull again
    }
    const merged = mergeDocs(doc, row.data);
    if (docEqual(merged, row.data)) return { doc: merged, version: row.version };
    const { data: upd, error: e3 } = await supabase
      .from('user_data')
      .update({ data: merged, version: row.version + 1, updated_at: new Date().toISOString() })
      .eq('user_id', uid).eq('version', row.version).select('version');
    if (e3) throw e3;
    if (upd && upd.length === 1) return { doc: merged, version: row.version + 1 };
    doc = merged; // another device saved first: merge again
  }
  throw new Error('Sync conflict');
}
