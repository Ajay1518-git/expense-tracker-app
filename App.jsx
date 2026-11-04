import { useEffect, useMemo, useState } from 'react';
import {
  Home, List, Plus, X, Trash2, ChevronLeft, ChevronRight, Search, Undo2,
  Wallet, BarChart3, Utensils, Bus, ShoppingBag, Receipt, Shapes,
} from 'lucide-react';

const EKEY = 'et.expenses.v1';
const BKEY = 'et.budget.v1';
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
        <input type='date' value={date} onChange={(e) => setDate(e.target.value)} />
        {err && <div className='err'>{err}</div>}
        <div className='actions'>
          {onDelete && <button className='btn ghost' onClick={onDelete}><Trash2 size={16} /> DELETE</button>}
          <button className='btn' onClick={submit}>SAVE</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('home');
  const [month, setMonth] = useState(ym(todayStr()));
  const [expenses, setExpenses] = useState(loadExpenses);
  const [budget, setBudget] = useState(() => {
    const b = Number(read(BKEY, 10000));
    return Number.isFinite(b) && b > 0 ? b : 10000;
  });
  const [sheet, setSheet] = useState(null);
  const [query, setQuery] = useState('');
  const [fcat, setFcat] = useState('All');
  const [toast, setToast] = useState(null);
  const [editBudget, setEditBudget] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    try { localStorage.setItem(EKEY, JSON.stringify(expenses)); } catch { /* ignore */ }
  }, [expenses]);
  useEffect(() => {
    try { localStorage.setItem(BKEY, JSON.stringify(budget)); } catch { /* ignore */ }
  }, [budget]);
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
      setExpenses((p) => p.map((e) => (e.id === id ? { ...e, ...data } : e)));
      setToast({ msg: 'UPDATED' });
    } else {
      const m = ym(data.date);
      const total = expenses.filter((e) => ym(e.date) === m).reduce((s, e) => s + e.amount, 0) + data.amount;
      const p = (total / budget) * 100;
      let msg = 'ADDED';
      if (total > budget) msg = `ADDED · OVER BUDGET BY ${fmt(total - budget)}`;
      else if (p >= 80) msg = `ADDED · ${Math.round(p)}% OF BUDGET USED`;
      setExpenses((prev) => [{ id: uid(), ...data }, ...prev]);
      setToast({ msg });
    }
    setMonth(ym(data.date));
    setSheet(null);
  };
  const remove = (exp) => {
    setExpenses((p) => p.filter((e) => e.id !== exp.id));
    setSheet(null);
    setToast({
      msg: 'DELETED',
      undo: () => { setExpenses((p) => [exp, ...p]); setToast(null); },
    });
  };
  const saveBudget = () => {
    const b = Number(draft.replace(',', '.'));
    if (Number.isFinite(b) && b > 0 && b <= 1e9) {
      setBudget(Math.round(b * 100) / 100);
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
        {tab === 'home' && (
          <>
            <section className='box shadow'>
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
            <div className='h'>RECENT</div>
            {recent.length
              ? recent.map((e) => <Row key={e.id} e={e} onClick={open(e)} />)
              : <div className='empty'>NO EXPENSES THIS MONTH<br />TAP ADD TO START</div>}
          </>
        )}

        {tab === 'history' && (
          <>
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
                {g.items.map((e) => <Row key={e.id} e={e} onClick={open(e)} />)}
              </div>
            )) : <div className='empty'>NOTHING FOUND</div>}
          </>
        )}

        {tab === 'stats' && (
          <>
            <section className='box shadow'>
              <div className='lab'>MONTH TOTAL</div>
              <div className='big'>{fmt(spent)}</div>
              <div className='sub'>{monthExp.length} ENTRIES · AVG {fmt(spent / days)} / DAY</div>
            </section>
            <div className='h'>BY CATEGORY</div>
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
            <div className='box'><div className='lab'>ALL-TIME TOTAL</div><div className='mid'>{fmt(allTotal)}</div></div>
          </>
        )}
      </main>

      <nav>
        {[['home', Home, 'HOME'], ['history', List, 'LOG'], ['stats', BarChart3, 'STATS']].map(([k, Icon, l]) => (
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
