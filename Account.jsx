import { LogOut, RefreshCw, Sun, Moon, Cloud, CloudOff } from 'lucide-react';

const LABELS = {
  synced: 'ALL CHANGES SAVED TO THE CLOUD',
  syncing: 'SYNCING…',
  offline: 'OFFLINE · WILL SYNC WHEN YOU ARE ONLINE',
  error: 'SYNC FAILED · TAP SYNC NOW',
};

export default function Account({ user, theme, toggleTheme, syncState, count, onSync, onLogout }) {
  const name = (user.user_metadata && user.user_metadata.name) || 'User';
  return (
    <>
      <section className='box shadow'>
        <div className='lab'>ACCOUNT</div>
        <div className='mid'>{name}</div>
        <div className='sub acc-mail'>{user.email}</div>
      </section>
      <section className='box'>
        <div className='lab'>{syncState === 'offline' ? <CloudOff size={14} /> : <Cloud size={14} />} CLOUD BACKUP</div>
        <div className='sub acc-line'>{LABELS[syncState] || LABELS.syncing}</div>
        <div className='sub acc-line'>{count} EXPENSES</div>
        <div className='actions'>
          <button className='btn ghost' onClick={onSync}><RefreshCw size={16} /> SYNC NOW</button>
        </div>
      </section>
      <section className='box'>
        <div className='lab'>APPEARANCE</div>
        <div className='actions'>
          <button className='btn ghost' onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {theme === 'dark' ? 'SWITCH TO LIGHT' : 'SWITCH TO DARK'}
          </button>
        </div>
      </section>
      <button className='btn ghost wide' onClick={onLogout}><LogOut size={16} /> LOG OUT</button>
    </>
  );
}
