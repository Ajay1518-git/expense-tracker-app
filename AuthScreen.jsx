import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from './supabase.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function friendly(error) {
  const m = (error && error.message ? error.message : '').toLowerCase();
  if (m.includes('invalid login')) return 'WRONG EMAIL OR PASSWORD';
  if (m.includes('already registered') || m.includes('already been registered')) return 'ACCOUNT ALREADY EXISTS · LOG IN';
  if (m.includes('not confirmed')) return 'EMAIL NOT CONFIRMED · TURN OFF CONFIRM EMAIL IN SUPABASE';
  if (m.includes('rate limit') || m.includes('too many') || (error && error.status === 429)) return 'TOO MANY TRIES · WAIT A MINUTE';
  if (m.includes('password')) return 'PASSWORD TOO WEAK · USE 8+ CHARACTERS';
  if (m.includes('fetch') || m.includes('network')) return 'NO INTERNET · CHECK CONNECTION';
  return 'SOMETHING WENT WRONG · TRY AGAIN';
}

export default function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';

  const submit = async () => {
    if (busy) return;
    const em = email.trim().toLowerCase();
    if (signup && !name.trim()) return setErr('NAME REQUIRED');
    if (!EMAIL_RE.test(em)) return setErr('ENTER A VALID EMAIL');
    if (password.length < 8) return setErr('PASSWORD MUST BE 8+ CHARACTERS');
    setBusy(true);
    setErr('');
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email: em,
          password,
          options: { data: { name: name.trim().slice(0, 60) } },
        });
        if (error) throw error;
        if (!data.session) {
          setMode('login');
          setErr('ACCOUNT CREATED · NOW LOG IN');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password });
        if (error) throw error;
      }
    } catch (e) {
      setErr(friendly(e));
    }
    setBusy(false);
  };
  const onKey = (e) => { if (e.key === 'Enter') submit(); };

  return (
    <div className='auth'>
      <div className='auth-card'>
        <div className='auth-brand'><span className='logo'>E</span>EXPENSE</div>
        <div className='auth-sub'>
          {signup ? 'CREATE AN ACCOUNT TO KEEP YOUR EXPENSES SAFE IN THE CLOUD' : 'LOG IN TO SEE YOUR EXPENSES ON ANY DEVICE'}
        </div>
        {signup && (
          <>
            <label>NAME</label>
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey} maxLength={60} autoComplete='name' placeholder='Your name' />
          </>
        )}
        <label>EMAIL</label>
        <input type='email' value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onKey} autoComplete='email' inputMode='email' placeholder='you@example.com' />
        <label>PASSWORD</label>
        <div className='pw'>
          <input
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKey}
            autoComplete={signup ? 'new-password' : 'current-password'}
            placeholder='8+ characters'
          />
          <button type='button' className='sq' onClick={() => setShow(!show)} aria-label='Show or hide password'>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {signup && <div className='auth-sub tight'>REMEMBER YOUR PASSWORD · IT CANNOT BE RESET</div>}
        {err && <div className='err'>{err}</div>}
        <div className='actions'>
          <button className='btn' onClick={submit} disabled={busy}>{busy ? 'PLEASE WAIT…' : signup ? 'SIGN UP' : 'LOG IN'}</button>
        </div>
        <button className='textbtn' onClick={() => { setMode(signup ? 'login' : 'signup'); setErr(''); }}>
          {signup ? 'ALREADY HAVE AN ACCOUNT? LOG IN' : 'NEW HERE? CREATE ACCOUNT'}
        </button>
      </div>
    </div>
  );
}
