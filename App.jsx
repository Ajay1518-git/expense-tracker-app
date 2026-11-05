import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Home, List, Plus, X, Trash2, ChevronLeft, ChevronRight, Search, Undo2,
  Wallet, BarChart3, Utensils, Bus, ShoppingBag, Receipt, Shapes, User,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { supabase, configured } from './supabase.js';
import AuthScreen from './AuthScreen.jsx';
import Account from './Account.jsx';
import {
  emptyDoc, mergeDocs, docEqual, loadCache, saveCache, clearCache, syncOnce, peekVersion,
} from './sync.js';

const EKEY = 'et.expenses.v1';
const BKEY = 'et.budget.v1';
const TKEY = 'et.theme.v1';
const CATS = [
  { name: 'Food', Icon: Utensils },
  { name: 'Travel', Icon: Bus },
  { name: 'Shopping', Icon: ShoppingBag },
  { name: 'Bills', Icon: Receipt },
  { name: 'Other', Icon: Shapes },
];
const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const fmt = (n) => '₹' + INR.format(n);
const pad = (n) => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const ym = (s) => s.slice(0, 7);
const iconFor = (name) => (CATS.find((c) => c.name === name) || CATS[4]).Icon;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function shiftMonth(m, delta) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function monthLabel(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase();
}
function dayLabel(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d)
    .toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase();
}

// Safe read: a corrupt value is copied to <key>.corrupt instead of being wiped.
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      localStorage.setItem(key + '.corrupt', raw);
      return fallback;
    }
  } catch {
    return fallback;
  }
}
function loadExpenses() {
  const raw = read(EKEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && typeof e.date === 'string' && Number.isFinite(Number(e.amount)))
    .map((e) => ({
      id: String(e.id || uid()),
      name: String(e.name || 'Untitled'),
      amount: Number(e.amount),
      category: CATS.some((c) => c.name === e.category) ? e.category : 'Other',
      date: e.date,
    }));
}

function initialTheme() {
  try {
    const t = localStorage.getItem(TKEY);
    if (t === 'dark' || t === 'light') return t;
  } catch { /* ignore */ }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Data saved by the older, offline-only version of the app on this phone.
function findLegacy() {
  try {
    if (localStorage.getItem('et.legacy.done')) return null;
  } catch { return null; }
  const items = loadExpenses();
  if (!items.length) return null;
  const b = Number(read(BKEY, 0));
  return { items, budget: Number.isFinite(b) && b > 0 ? b : 0 };
}

function Row({ e, onClick }) {
  const Icon = iconFor(e.category);
  return (
    <button className='row' onClick={onClick}>
      <span className='ico'><Icon size={18} /></span>
      <span className='rn'><b>{e.name}</b><small>{e.category.toUpperCase()}</small></span>
      <span className='ra'>{fmt(e.amount)}</span>
    </button>
  );
}

function Sheet({ init, onSave, onDelete, onClose }) {
  const [name, setName] = useState(init ? init.name : '');
  const [amount, setAmount] = useState(init ? String(init.amount) : '');
  const [category, setCategory] = useState(init ? init.category : 'Food');
  const [date, setDate] = useState(init ? init.date : todayStr());
  const [err, setErr] = useState('');

  const submit = () => {
    const a = Math.round(Number(amount.replace(',', '.')) * 100) / 100;
    if (!name.trim()) return setErr('NAME REQUIRED');
    if (!Number.isFinite(a) || a <= 0) return setErr('AMOUNT MUST BE MORE THAN 0');
    if (a > 1e9) return setErr('AMOUNT TOO LARGE');
    if (date.length !== 10 || Number.isNaN(new Date(date).getTime())) return setErr('PICK A VALID DATE');
    if (date > todayStr()) return setErr('FUTURE DATE NOT ALLOWED');
    onSave({ name: name.trim(), amount: a, category, date });
  };

  return (
    <div className='overlay' onClick={onClose}>
      <div className='sheet' onClick={(e) => e.stopPropagation()}>
        <div className='sheet-h'>
          <b>{init ? 'EDIT EXPENSE' : 'NEW EXPENSE'}</b>
          <button className='sq' onClick={onClose}><X size={18} /></button>
        </div>
        <label>NAME</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder='Dinner' maxLength={60} autoFocus={!init} />
        <label>AMOUNT (₹)</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder='0' inputMode='decimal' />
        <label>CATEGORY</label>
        <div className='chips'>
          {CATS.map(({ name: n, Icon }) => (
            <button key={n} className={'chip' + (category === n ? ' on' : '')} onClick={() => setCategory(n)}>
              <Icon size={14} />{n.toUpperCase()}
            </button>
          ))}
        </div>
        <label>DATE</label>
        <input type='date' value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
        {err && <div className='err'>{err}</div>}
        <div className='actions'>
          {onDelete && <button className='btn ghost' onClick={onDelete}><Trash2 size={16} /> DELETE</button>}
          <button className='btn' onClick={submit}>SAVE</button>
        </div>
      </div>
    </div>
  );
}

function Tracker({ user, theme, toggleTheme }) {
  const [tab, setTab] = useState('home');
  const [month, setMonth] = useState(ym(todayStr()));
  const [initial] = useState(() => loadCache(user.id));
  const [expenses, setExpenses] = useState(initial.expenses);
  const [tombs, setTombs] = useState(initial.tombs);
  const [budget, setBudget] = useState(initial.budget ? initial.budget.v : 10000);
  const [budgetU, setBudgetU] = useState(initial.budget ? initial.budget.u : 0);
  const [sheet, setSheet] = useState(null);
  const [query, setQuery] = useState('');
  const [fcat, setFcat] = useState('All');
  const [toast, setToast] = useState(null);
  const [editBudget, setEditBudget] = useState(false);
  const [draft, setDraft] = useState('');
  const [syncState, setSyncState] = useState('syncing');
  const [legacy, setLegacy] = useState(findLegacy);

  const docRef = useRef(emptyDoc());
  docRef.current = { expenses, tombs, budget: budgetU ? { v: budget, u: budgetU } : null };
  const verRef = useRef(null);
  const busy = useRef(false);
  const again = useRef(false);
  const loggingOut = useRef(false);

  const applyDoc = (d) => {
    if (docEqual(docRef.current, d)) return;
    setExpenses(d.expenses);
    setTombs(d.tombs);
    if (d.budget) { setBudget(d.budget.v); setBudgetU(d.budget.u); }
  };

  const runSync = async () => {
    if (loggingOut.current) return;
    if (busy.current) { again.current = true; return; }
    busy.current = true;
    setSyncState('syncing');
    try {
      const res = await syncOnce(supabase, user.id, docRef.current);
      verRef.current = res.version;
      applyDoc(mergeDocs(docRef.current, res.doc));
      setSyncState('synced');
    } catch {
      setSyncState(navigator.onLine ? 'error' : 'offline');
    } finally {
      busy.current = false;
      if (again.current) { again.current = false; setTimeout(runSync, 300); }
    }
  };

  // Every change is cached on the phone and sent to the cloud a moment later.
  useEffect(() => {
    if (loggingOut.current) return undefined;
    saveCache(user.id, docRef.current);
    const t = setTimeout(runSync, 1200);
    return () => clearTimeout(t);
  }, [expenses, tombs, budget, budgetU]);

  // Pick up changes made on other devices.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') runSync(); };
    const onOnline = () => runSync();
    const poll = async () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine || busy.current) return;
      try {
        const v = await peekVersion(supabase, user.id);
        if (verRef.current !== null && v !== verRef.current) runSync();
      } catch { /* try again next time */ }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);
    const id = setInterval(poll, 30000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOnline);
      clearInterval(id);
    };
  }, []);

  const finishLegacy = (doImport) => {
    if (doImport && legacy) {
      const items = legacy.items.map((e) => ({ ...e, u: 1 }));
      const merged = mergeDocs(docRef.current, {
        expenses: items,
        tombs: {},
        budget: legacy.budget && !budgetU ? { v: legacy.budget, u: 1 } : null,
      });
      setExpenses(merged.expenses);
      setTombs(merged.tombs);
      if (merged.budget) { setBudget(merged.budget.v); setBudgetU(merged.budget.u); }
    }
    try { localStorage.setItem('et.legacy.done', '1'); } catch { /* ignore */ }
    setLegacy(null);
  };

  const logout = async () => {
    setSyncState('syncing');
    try {
      const res = await syncOnce(supabase, user.id, docRef.current);
      applyDoc(mergeDocs(docRef.current, res.doc));
    } catch {
      setSyncState(navigator.onLine ? 'error' : 'offline');
      if (!window.confirm('Sync failed. Logging out now will lose changes that are not saved to the cloud yet. Log out anyway?')) return;
    }
    loggingOut.current = true;
    clearCache(user.id);
    await supabase.auth.signOut();
  };

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const monthExp = useMemo(() => expenses.filter((e) => ym(e.date) === month), [expenses, month]);
  const spent = monthExp.reduce((s, e) => s + e.amount, 0);
  const pct = (spent / budget) * 100;
  const over = spent > budget;
  let status = `${fmt(budget - spent)} LEFT`;
  if (over) status = `OVER BUDGET BY ${fmt(spent - budget)}`;
  else if (spent === budget) status = 'BUDGET REACHED';
  else if (pct >= 80) status = `WARNING · ${fmt(budget - spent)} LEFT`;

  const byCat = useMemo(() => {
    const t = {};
    monthExp.forEach((e) => { t[e.category] = (t[e.category] || 0) + e.amount; });
    return Object.entries(t).sort((a, b) => b[1] - a[1]);
  }, [monthExp]);
  const recent = [...monthExp].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const allTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const [yy, mm] = month.split('-').map(Number);
  const days = month === ym(todayStr()) ? new Date().getDate() : new Date(yy, mm, 0).getDate();

  const q = query.trim().toLowerCase();
  const list = expenses
    .filter((e) => (q ? true : ym(e.date) === month)
      && (fcat === 'All' || e.category === fcat)
      && (!q || (e.name + ' ' + e.category).toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date));
  const groups = [];
  list.forEach((e) => {
    const g = groups[groups.length - 1];
    if (g && g.date === e.date) g.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  });

  const save = (data) => {
    if (sheet && sheet.expense) {
      const id = sheet.expense.id;
      setExpenses((p) => p.map((e) => (e.id === id ? { ...e, ...data, u: Date.now() } : e)));
      setToast({ msg: 'UPDATED' });
    } else {
      const m = ym(data.date);
      const total = expenses.filter((e) => ym(e.date) === m).reduce((s, e) => s + e.amount, 0) + data.amount;
      const p = (total / budget) * 100;
      let msg = 'ADDED';
      if (total > budget) msg = `ADDED · OVER BUDGET BY ${fmt(total - budget)}`;
      else if (p >= 80) msg = `ADDED · ${Math.round(p)}% OF BUDGET USED`;
      setExpenses((prev) => [{ id: uid(), ...data, u: Date.now() }, ...prev]);
      setToast({ msg });
    }
    setMonth(ym(data.date));
    setSheet(null);
  };
  const remove = (exp) => {
    setExpenses((p) => p.filter((e) => e.id !== exp.id));
    setTombs((t) => ({ ...t, [exp.id]: Date.now() }));
    setSheet(null);
    setToast({
      msg: 'DELETED',
      undo: () => {
        setExpenses((p) => [{ ...exp, u: Date.now() }, ...p]);
        setTombs((t) => { const n = { ...t }; delete n[exp.id]; return n; });
        setToast(null);
      },
    });
  };
  const saveBudget = () => {
    const b = Number(draft.replace(',', '.'));
    if (Number.isFinite(b) && b > 0 && b <= 1e9) {
      setBudget(Math.round(b * 100) / 100);
      setBudgetU(Date.now());
      setEditBudget(false);
    }
  };
  const open = (e) => () => setSheet({ expense: e });

  return (
    <div className='app'>
      <header>
        <div className='brand'><span className='logo'>E</span>EXPENSE</div>
        <div className='mnav'>
          <button className='sq' onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={18} /></button>
          <span className='mlabel'>{monthLabel(month)}</span>
          <button className='sq' onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={18} /></button>
        </div>
      </header>

      <main>
        <div className='page'>
        {tab === 'home' && (
          <div className='bento'>
            <section className='box shadow budget'>
              <div className='lab'>
                <Wallet size={14} /> MONTHLY BUDGET
                <button className='link' onClick={() => { setDraft(String(budget)); setEditBudget(!editBudget); }}>EDIT</button>
              </div>
              <div className='big'>{fmt(spent)}</div>
              <div className='sub'>OF {fmt(budget)} · {Math.round(pct)}% USED</div>
              <div className={'status' + (over ? ' inv' : '')}>{status}</div>
              {editBudget && (
                <div className='inline'>
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} inputMode='decimal' placeholder='Budget' />
                  <button className='btn' onClick={saveBudget}>SET</button>
                </div>
              )}
            </section>
            <div className='two'>
              <div className='box'><div className='lab'>ENTRIES</div><div className='mid'>{monthExp.length}</div></div>
              <div className='box'><div className='lab'>TOP CATEGORY</div><div className='mid'>{byCat.length ? byCat[0][0].toUpperCase() : '—'}</div></div>
            </div>
            <div className='recent'>
              <div className='h'>RECENT</div>
              <div className='rows'>
                {recent.length
                  ? recent.map((e) => <Row key={e.id} e={e} onClick={open(e)} />)
                  : <div className='empty'>NO EXPENSES THIS MONTH<br />TAP ADD TO START</div>}
              </div>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className='log'>
            <div className='search'>
              <Search size={16} />
              <input placeholder='Search all expenses' value={query} onChange={(e) => setQuery(e.target.value)} />
              {query && <button className='sq sm' onClick={() => setQuery('')}><X size={14} /></button>}
            </div>
            <div className='chips scroll'>
              {['All', ...CATS.map((c) => c.name)].map((c) => (
                <button key={c} className={'chip' + (fcat === c ? ' on' : '')} onClick={() => setFcat(c)}>{c.toUpperCase()}</button>
              ))}
            </div>
            {groups.length ? groups.map((g) => (
              <div key={g.date}>
                <div className='h'>{dayLabel(g.date)}</div>
                <div className='rows'>
                  {g.items.map((e) => <Row key={e.id} e={e} onClick={open(e)} />)}
                </div>
              </div>
            )) : <div className='empty'>NOTHING FOUND</div>}
          </div>
        )}

        {tab === 'stats' && (
          <div className='bento stats'>
            <section className='box shadow'>
              <div className='lab'>MONTH TOTAL</div>
              <div className='big'>{fmt(spent)}</div>
              <div className='sub'>{monthExp.length} ENTRIES · AVG {fmt(spent / days)} / DAY</div>
            </section>
            <div className='recent'>
              <div className='h'>BY CATEGORY</div>
              <div className='rows'>
            {byCat.length ? byCat.map(([n, t]) => {
              const Icon = iconFor(n);
              const share = spent ? (t / spent) * 100 : 0;
              return (
                <div className='box cat' key={n}>
                  <div className='cat-h'><span><Icon size={16} /> {n.toUpperCase()}</span><b>{fmt(t)}</b></div>
                  <div className='meter'><i style={{ width: share + '%' }} /></div>
                  <small>{Math.round(share)}% OF MONTH</small>
                </div>
              );
            }) : <div className='empty'>NO DATA</div>}
              </div>
            </div>
            <div className='box alltime'><div className='lab'>ALL-TIME TOTAL</div><div className='mid'>{fmt(allTotal)}</div></div>
          </div>
        )}
        {tab === 'account' && (
          <Account
            user={user}
            theme={theme}
            toggleTheme={toggleTheme}
            syncState={syncState}
            count={expenses.length}
            onSync={runSync}
            onLogout={logout}
          />
        )}
        </div>
      </main>

      <nav>
        {[['home', Home, 'HOME'], ['history', List, 'LOG'], ['stats', BarChart3, 'STATS'], ['account', User, 'ACCOUNT']].map(([k, Icon, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><Icon size={20} /><span>{l}</span></button>
        ))}
        <button className='add' onClick={() => setSheet({})}><Plus size={20} /><span>ADD</span></button>
      </nav>

      {toast && (
        <div className='toast'>
          <span>{toast.msg}</span>
          {toast.undo && <button onClick={toast.undo}><Undo2 size={14} /> UNDO</button>}
        </div>
      )}
      {legacy && (
        <div className='overlay'>
          <div className='sheet'>
            <div className='sheet-h'><b>OLD DATA FOUND</b></div>
            <p className='note'>
              {legacy.items.length} expenses from the older version of the app were found on this phone.
              Add them to your account?
            </p>
            <div className='actions'>
              <button className='btn ghost' onClick={() => finishLegacy(false)}>NO</button>
              <button className='btn' onClick={() => finishLegacy(true)}>YES, ADD</button>
            </div>
          </div>
        </div>
      )}
      {sheet && (
        <Sheet
          key={sheet.expense ? sheet.expense.id : 'new'}
          init={sheet.expense}
          onSave={save}
          onDelete={sheet.expense ? () => remove(sheet.expense) : null}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

function Splash({ text }) {
  return <div className='auth'><div className='auth-sub'>{text}</div></div>;
}

export default function App() {
  const [theme, setTheme] = useState(initialTheme);
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (Capacitor.isNativePlatform()) {
      StatusBar.setBackgroundColor({ color: theme === 'dark' ? '#0E1527' : '#F8F4EA' }).catch(() => {});
      StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light }).catch(() => {});
    }
  }, [theme]);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem(TKEY, next); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session || null))
      .catch(() => setSession(null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!configured) return <Splash text='APP NOT CONFIGURED · SUPABASE KEYS MISSING' />;
  if (session === undefined) return <Splash text='LOADING…' />;
  if (!session) return <AuthScreen />;
  return <Tracker key={session.user.id} user={session.user} theme={theme} toggleTheme={toggleTheme} />;
}
