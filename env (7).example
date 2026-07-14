import { useState, useEffect } from 'react';
import { api } from '../api.js';

const LEVEL = {
  success: { color: 'var(--green)', bg: 'var(--green-bg)', label: 'OK' },
  info:    { color: 'var(--c-blue)', bg: 'color-mix(in srgb, var(--c-blue) 12%, transparent)', label: 'Info' },
  warning: { color: 'var(--amber)', bg: 'var(--amber-bg)', label: 'Warn' },
  error:   { color: 'var(--red)', bg: 'var(--red-bg)', label: 'Error' },
};

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Activity() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // auto-refresh every 15s
    return () => clearInterval(t);
  }, []);

  async function load() {
    try { setItems(await api.get('/api/activity?limit=200')); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function clear() {
    if (!confirm('Clear the entire activity log?')) return;
    try { await api.delete('/api/activity'); setItems([]); }
    catch (err) { setError(err.message); }
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.level === filter);
  const counts = { error: items.filter(i => i.level === 'error').length, warning: items.filter(i => i.level === 'warning').length };

  return (
    <div>
      <div style={{ padding: '26px 32px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.025em' }}>Activity</h1>
            <p style={{ fontSize: 13, color: 'var(--t2)', marginTop: 3 }}>What the system is doing — syncs, changes, and errors. Auto-refreshes.</p>
          </div>
          <button onClick={clear} style={{ padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--s1)', color: 'var(--t1)', border: '1px solid var(--b2)', cursor: 'pointer' }}>Clear log</button>
        </div>

        <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--s2)', borderRadius: 10, border: '1px solid var(--b1)', width: 'fit-content', marginBottom: 18 }}>
          {['all', 'success', 'info', 'warning', 'error'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer', transition: 'all 0.12s',
              background: filter === f ? 'var(--s1)' : 'transparent', color: filter === f ? 'var(--t1)' : 'var(--t2)', boxShadow: filter === f ? 'var(--sh-sm)' : 'none',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {f}
              {f === 'error' && counts.error > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--red)', borderRadius: 10, padding: '0 6px', minWidth: 16, textAlign: 'center' }}>{counts.error}</span>}
              {f === 'warning' && counts.warning > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--amber)', borderRadius: 10, padding: '0 6px', minWidth: 16, textAlign: 'center' }}>{counts.warning}</span>}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={{ margin: '0 32px 16px', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 9, padding: '11px 15px', fontSize: 12.5, color: 'var(--red)', fontWeight: 600 }}>{error}</div>}

      <div style={{ margin: '0 32px 32px', background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--sh-md)' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--t3)', fontFamily: "'Fira Code', monospace", fontSize: 12 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px 32px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
            No activity yet. It will fill up as the system syncs and you make changes.
          </div>
        ) : (
          filtered.map((it, i) => {
            const lv = LEVEL[it.level] || LEVEL.info;
            return (
              <div key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '13px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--b1)' : 'none' }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: lv.color, background: lv.bg, borderRadius: 6, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0, marginTop: 1, minWidth: 48, textAlign: 'center' }}>{lv.label}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 500 }}>{it.message}</div>
                  {it.detail?.error && <div style={{ fontSize: 11.5, color: 'var(--red)', fontFamily: "'Fira Code', monospace", marginTop: 3, wordBreak: 'break-word' }}>{it.detail.error}</div>}
                </div>
                <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'Fira Code', monospace", flexShrink: 0, marginTop: 2 }}>{timeAgo(it.created_at)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
