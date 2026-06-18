import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtCurrency } from '../api.js';

const SOURCES = ['AliExpress spy', 'Competitor store', 'TikTok trend', 'Google Trends', 'Manual research', 'Supplier suggestion', 'Other'];
const CHANGE_OPTIONS = ['Pricing changed', 'Only branding changed', 'Used own template', 'Added creatives', 'Changed all creatives', 'Nothing changed'];

const DATE_RANGES = [
  { key: '7',   label: '7 days',  days: 7 },
  { key: '14',  label: '14 days', days: 14 },
  { key: '30',  label: '30 days', days: 30 },
  { key: '60',  label: '60 days', days: 60 },
  { key: 'all', label: 'All time', days: null },
];

const SORT_OPTIONS = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'roas',    label: 'ROAS' },
  { key: 'orders',  label: 'Orders' },
  { key: 'recent',  label: 'Newest' },
];

// ═══ Shared UI ═══════════════════════════════════════════════════════════════

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{children}</div>;
}

function Btn({ children, onClick, disabled, variant = 'ghost', size = 'md' }) {
  const variants = {
    primary: { background: 'linear-gradient(135deg, #7C5CFC, #5B5BD6)', color: '#fff', border: 'none', boxShadow: 'var(--sh-brand)', fontWeight: 700 },
    ghost:   { background: 'var(--s1)', color: 'var(--t1)', border: '1px solid var(--b2)', fontWeight: 600 },
    subtle:  { background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--b1)', fontWeight: 600 },
  };
  const sizes = { md: { padding: '9px 16px', fontSize: 13 }, sm: { padding: '6px 12px', fontSize: 12 } };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      borderRadius: 9, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1, transition: 'transform 0.1s, box-shadow 0.15s, background 0.15s',
      display: 'inline-flex', alignItems: 'center', gap: 7, ...variants[variant], ...sizes[size],
    }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}>
      {children}
    </button>
  );
}

function TagChip({ tag, color = 'brand' }) {
  const colors = {
    brand:  { bg: 'var(--brand-l)', fg: 'var(--brand)', bd: 'transparent' },
    violet: { bg: 'rgba(124,92,252,0.1)', fg: 'var(--c-violet)', bd: 'rgba(124,92,252,0.2)' },
  };
  const c = colors[color] || colors.brand;
  return (
    <span style={{ display: 'inline-block', fontFamily: "'Fira Code', monospace", fontSize: 11, fontWeight: 600, color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 5, padding: '2px 8px', letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
      {tag}
    </span>
  );
}

function StatusDot({ status }) {
  const map = {
    active:   { color: 'var(--green)', label: 'Active' },
    paused:   { color: 'var(--amber)', label: 'Paused' },
    archived: { color: 'var(--t3)',    label: 'Archived' },
  };
  const s = map[status] || map.archived;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, boxShadow: status === 'active' ? `0 0 6px ${s.color}` : 'none' }} />
      <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600 }}>{s.label}</span>
    </span>
  );
}

// Rank medal
function RankBadge({ rank }) {
  const styles = {
    1: { bg: 'linear-gradient(135deg, #FCD34D, #F0B429)', fg: '#7A5A00', sh: '0 2px 8px rgba(240,180,41,0.4)' },
    2: { bg: 'linear-gradient(135deg, #E2E8F0, #94A3B8)', fg: '#334155', sh: '0 2px 8px rgba(148,163,184,0.3)' },
    3: { bg: 'linear-gradient(135deg, #E0A877, #C2855A)', fg: '#5A3A1A', sh: '0 2px 8px rgba(194,133,90,0.3)' },
  };
  const s = styles[rank];
  if (s) {
    return <div style={{ width: 24, height: 24, borderRadius: 7, background: s.bg, color: s.fg, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: s.sh }}>{rank}</div>;
  }
  return <div style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--s3)', color: 'var(--t3)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{rank}</div>;
}

// Three-dot action menu
function ActionMenu({ batch, onAction }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const items = [
    batch.status !== 'active'   && { key: 'active',   label: 'Set active',  color: 'var(--green)' },
    batch.status !== 'paused'   && { key: 'paused',   label: 'Pause',       color: 'var(--amber)' },
    batch.status !== 'archived' && { key: 'archived', label: 'Archive',     color: 'var(--t2)' },
    { key: 'delete', label: 'Delete', color: 'var(--red)', divider: true },
  ].filter(Boolean);

  return (
    <div ref={ref} style={{ position: 'relative' }} onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: open ? 'var(--t1)' : 'var(--t3)', background: open ? 'var(--s3)' : 'transparent',
        border: '1px solid ' + (open ? 'var(--b2)' : 'transparent'), transition: 'all 0.1s', cursor: 'pointer',
      }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--s3)'; e.currentTarget.style.color = 'var(--t1)'; }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t3)'; } }}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><circle cx="7.5" cy="3" r="1.3"/><circle cx="7.5" cy="7.5" r="1.3"/><circle cx="7.5" cy="12" r="1.3"/></svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 32, zIndex: 50, minWidth: 150,
          background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 10,
          boxShadow: 'var(--sh-lg)', padding: 5, animation: 'fadeIn 0.12s ease',
        }}>
          {items.map(it => (
            <div key={it.key}>
              {it.divider && <div style={{ height: 1, background: 'var(--b1)', margin: '5px 0' }} />}
              <button onClick={() => { setOpen(false); onAction(it.key); }} style={{
                width: '100%', textAlign: 'left', padding: '8px 11px', borderRadius: 7,
                fontSize: 12.5, fontWeight: 600, color: it.color, background: 'transparent',
                cursor: 'pointer', transition: 'background 0.1s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--s2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {it.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Quick hover action buttons
function QuickActions({ batch, onAction, visible }) {
  const btns = [];
  if (batch.status === 'active') btns.push({ key: 'paused', label: 'Pause', color: 'var(--amber)' });
  if (batch.status === 'paused') btns.push({ key: 'active', label: 'Resume', color: 'var(--green)' });
  if (batch.status !== 'archived') btns.push({ key: 'archived', label: 'Archive', color: 'var(--t2)' });

  return (
    <div style={{ display: 'flex', gap: 5, opacity: visible ? 1 : 0, transition: 'opacity 0.15s', pointerEvents: visible ? 'auto' : 'none' }}
      onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
      {btns.map(b => (
        <button key={b.key} onClick={() => onAction(b.key)} style={{
          fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
          color: b.color, background: 'var(--s1)', border: '1px solid var(--b2)',
          cursor: 'pointer', transition: 'all 0.1s', whiteSpace: 'nowrap',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--s3)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--s1)'; }}>
          {b.label}
        </button>
      ))}
    </div>
  );
}

// ═══ Create Modal ═════════════════════════════════════════════════════════════
function CreateModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', batch_tag: '', source: '', thesis: '', validation_notes: '', tags: '', changes_note: '' });
  const [subTags, setSubTags] = useState([]);
  const [changes, setChanges] = useState([]);
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    api.get('/api/batches/suggest-name').then(d => {
      setSuggestion(d);
      if (d.suggested_name || d.suggested_tag) setForm(f => ({ ...f, name: d.suggested_name || f.name, batch_tag: d.suggested_tag || f.batch_tag }));
    }).catch(() => {});
  }, []);

  const toggleChange = (o) => setChanges(p => p.includes(o) ? p.filter(c => c !== o) : [...p, o]);
  const addSub = () => setSubTags(p => [...p, { tag: '', description: '' }]);
  const updSub = (i, f, v) => setSubTags(p => p.map((s, idx) => idx === i ? { ...s, [f]: v } : s));
  const rmSub = (i) => setSubTags(p => p.filter((_, idx) => idx !== i));

  async function submit() {
    if (!form.name.trim()) { setError('Batch name is required.'); return; }
    setLoading(true); setError(null);
    try {
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      const sub = subTags.filter(s => s.tag.trim()).map(s => ({ tag: s.tag.trim(), description: s.description.trim() }));
      const batch = await api.post('/api/batches', { ...form, batch_tag: form.batch_tag.trim() || null, tags, sub_tags: sub, changes });
      onCreate(batch); onClose();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,35,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, width: 580, padding: 0, boxShadow: 'var(--sh-xl)', maxHeight: '92vh', overflowY: 'auto', animation: 'slideUp 0.2s ease' }}>
        <div style={{ padding: '22px 26px', borderBottom: '1px solid var(--b1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: 'var(--s1)', borderRadius: '16px 16px 0 0', zIndex: 2 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.01em' }}>New Batch</div>
            <div style={{ fontSize: 12.5, color: 'var(--t2)', marginTop: 3 }}>Document a product group so you can track its performance.</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, color: 'var(--t3)', background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {error && <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 9, padding: '10px 14px', fontSize: 12.5, color: 'var(--red)', fontWeight: 600 }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12 }}>
            <div><Label>Batch name</Label><input placeholder="e.g. BATCH5-VIVL" value={form.name} onChange={set('name')} /></div>
            <div><Label>Shopify tag <span style={{ color: 'var(--t4)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></Label><input placeholder="empty" value={form.batch_tag} onChange={set('batch_tag')} style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }} /></div>
          </div>

          {suggestion?.last_name && (
            <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: -10, display: 'flex', alignItems: 'center', gap: 6 }}>
              Last: <span style={{ fontFamily: "'Fira Code', monospace", color: 'var(--t2)' }}>{suggestion.last_name}</span>
              {suggestion.suggested_name && <>· next: <span style={{ fontFamily: "'Fira Code', monospace", color: 'var(--brand)', fontWeight: 600 }}>{suggestion.suggested_name}</span></>}
            </div>
          )}

          {/* Sub-tags */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Label>Sub-tags <span style={{ color: 'var(--t4)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>— refinements with meaning</span></Label>
              <button onClick={addSub} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand)', padding: '3px 10px', borderRadius: 6, border: '1px solid var(--brand-l)', background: 'var(--brand-l)', cursor: 'pointer' }}>+ Add</button>
            </div>
            {subTags.length === 0
              ? <div style={{ fontSize: 11.5, color: 'var(--t3)', fontStyle: 'italic' }}>e.g. "-A1" with note "premium pricing variant".</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {subTags.map((st, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 30px', gap: 8, alignItems: 'center' }}>
                      <input placeholder="-A1" value={st.tag} onChange={e => updSub(i, 'tag', e.target.value)} style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }} />
                      <input placeholder="what makes these specific" value={st.description} onChange={e => updSub(i, 'description', e.target.value)} />
                      <button onClick={() => rmSub(i)} style={{ color: 'var(--t3)', fontSize: 16, cursor: 'pointer', height: 30 }}>✕</button>
                    </div>
                  ))}
                </div>}
          </div>

          {/* Changes */}
          <div>
            <Label>What did you change on the products?</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 9 }}>
              {CHANGE_OPTIONS.map(o => {
                const a = changes.includes(o);
                return <button key={o} onClick={() => toggleChange(o)} style={{
                  fontSize: 11.5, fontWeight: 600, padding: '6px 12px', borderRadius: 7, cursor: 'pointer', transition: 'all 0.12s',
                  background: a ? 'var(--brand)' : 'var(--s2)', color: a ? '#fff' : 'var(--t2)',
                  border: '1px solid ' + (a ? 'var(--brand)' : 'var(--b2)'), boxShadow: a ? 'var(--sh-brand)' : 'none',
                }}>{o}</button>;
              })}
            </div>
            <input placeholder="Or describe something else…" value={form.changes_note} onChange={set('changes_note')} />
          </div>

          <div><Label>Source</Label><select value={form.source} onChange={set('source')}><option value="">Where did you find these?</option>{SOURCES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><Label>Thesis</Label><textarea rows={2} placeholder="Why you think this will perform." value={form.thesis} onChange={set('thesis')} style={{ resize: 'vertical' }} /></div>
          <div><Label>Validation</Label><textarea rows={2} placeholder="Social proof, competitor signals, trends." value={form.validation_notes} onChange={set('validation_notes')} style={{ resize: 'vertical' }} /></div>
          <div><Label>Labels (comma-separated)</Label><input placeholder="summer, impulse-buy, fashion" value={form.tags} onChange={set('tags')} /></div>
        </div>

        <div style={{ padding: '16px 26px', borderTop: '1px solid var(--b1)', display: 'flex', gap: 10, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: 'var(--s1)', borderRadius: '0 0 16px 16px' }}>
          <Btn onClick={onClose} variant="ghost">Cancel</Btn>
          <Btn onClick={submit} disabled={loading} variant="primary">{loading ? 'Creating…' : 'Create Batch'}</Btn>
        </div>
      </div>
    </div>
  );
}

// ═══ Batch Row ════════════════════════════════════════════════════════════════
function BatchRow({ batch, rank, maxRevenue, onAction }) {
  const [hover, setHover] = useState(false);
  const revenue = batch.totals?.revenue || 0;
  const orders = batch.totals?.orders || 0;
  const adSpend = batch.totals?.ad_spend || 0;
  const roas = adSpend > 0 ? (revenue / adSpend) : null;
  const barPct = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;

  return (
    <Link to={`/batches/${batch.id}`} style={{ display: 'block' }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div style={{
        display: 'grid', gridTemplateColumns: '44px 110px 1fr 130px 120px 64px 90px 110px 40px',
        alignItems: 'center', gap: 14, padding: '14px 22px',
        borderBottom: '1px solid var(--b1)', background: hover ? 'var(--s2)' : 'transparent',
        transition: 'background 0.12s', cursor: 'pointer',
      }}>
        <RankBadge rank={rank} />

        <div>{batch.batch_tag ? <TagChip tag={batch.batch_tag} /> : <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 10.5, color: 'var(--t4)' }}>{batch.batch_code}</span>}</div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{batch.name}</div>
          {batch.thesis && <div style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{batch.thesis}</div>}
        </div>

        {/* Quick actions appear on hover in source column space */}
        <div>
          {hover
            ? <QuickActions batch={batch} onAction={onAction} visible={hover} />
            : <span style={{ fontSize: 11.5, color: 'var(--t2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{batch.source || '—'}</span>}
        </div>

        <div style={{ textAlign: 'right', fontFamily: "'Fira Code', monospace", fontSize: 14, fontWeight: 600, color: revenue > 0 ? 'var(--t1)' : 'var(--t4)' }}>{fmtCurrency(revenue)}</div>

        <div style={{ textAlign: 'right', fontFamily: "'Fira Code', monospace", fontSize: 13, color: 'var(--t2)' }}>{orders}</div>

        <div style={{ textAlign: 'right', fontFamily: "'Fira Code', monospace", fontSize: 12.5, fontWeight: 600, color: roas ? (roas >= 2 ? 'var(--green)' : 'var(--amber)') : 'var(--t4)' }}>{roas ? `${roas.toFixed(1)}×` : '—'}</div>

        <div style={{ padding: '0 2px' }}>
          <div style={{ height: 5, background: 'var(--s3)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${barPct}%`, background: 'linear-gradient(90deg, #7C5CFC, #5B5BD6)', borderRadius: 3, transition: 'width 0.4s ease' }} />
          </div>
        </div>

        <div><StatusDot status={batch.status} /></div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><ActionMenu batch={batch} onAction={onAction} /></div>
      </div>
    </Link>
  );
}

// ═══ Dashboard ════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState('active');
  const [sortBy, setSortBy] = useState('revenue');
  const [range, setRange] = useState('30');

  useEffect(() => { load(); }, [range]);

  async function load() {
    try { setLoading(true); setBatches(await api.get(`/api/batches?range=${range}`)); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function handleSync() {
    setSyncing(true);
    try { await api.post('/api/sync', { days: 30 }); await load(); }
    catch (err) { setError(err.message); } finally { setSyncing(false); }
  }

  async function handleAction(batch, action) {
    try {
      if (action === 'delete') {
        if (!confirm(`Delete "${batch.name}"? This cannot be undone.`)) return;
        await api.delete(`/api/batches/${batch.id}?hard=true`);
        setBatches(p => p.filter(b => b.id !== batch.id));
      } else {
        await api.patch(`/api/batches/${batch.id}`, { status: action });
        setBatches(p => p.map(b => b.id === batch.id ? { ...b, status: action } : b));
      }
    } catch (err) { setError(err.message); }
  }

  function handleCreate(b) { setBatches(p => [{ ...b, totals: { orders: 0, revenue: 0, units: 0 }, store_count: 0 }, ...p]); }

  const totalRevenue = batches.reduce((s, b) => s + (b.totals?.revenue || 0), 0);
  const totalOrders = batches.reduce((s, b) => s + (b.totals?.orders || 0), 0);
  const totalSpend = batches.reduce((s, b) => s + (b.totals?.ad_spend || 0), 0);
  const blendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : null;
  const activeCount = batches.filter(b => b.status === 'active').length;

  let filtered = filter === 'all' ? batches : batches.filter(b => b.status === filter);
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'recent') return new Date(b.created_at) - new Date(a.created_at);
    if (sortBy === 'roas') {
      const ra = (a.totals?.ad_spend > 0) ? a.totals.revenue / a.totals.ad_spend : -1;
      const rb = (b.totals?.ad_spend > 0) ? b.totals.revenue / b.totals.ad_spend : -1;
      return rb - ra;
    }
    if (sortBy === 'orders') return (b.totals?.orders || 0) - (a.totals?.orders || 0);
    return (b.totals?.revenue || 0) - (a.totals?.revenue || 0);
  });
  const maxRevenue = Math.max(...filtered.map(b => b.totals?.revenue || 0), 0);

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '26px 32px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.025em' }}>Batches</h1>
            <p style={{ fontSize: 13, color: 'var(--t2)', marginTop: 3 }}>Ranked product groups across all your stores.</p>
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            <Btn onClick={handleSync} disabled={syncing} variant="ghost">{syncing ? 'Syncing…' : 'Sync'}</Btn>
            <Btn onClick={() => setShowCreate(true)} variant="primary">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              New Batch
            </Btn>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
          <StatCard label="Active batches" value={activeCount} accent="var(--c-violet)" />
          <StatCard label="Revenue" value={fmtCurrency(totalRevenue)} accent="var(--c-emerald)" mono />
          <StatCard label="Orders" value={totalOrders} accent="var(--c-blue)" mono />
          <StatCard label="Blended ROAS" value={blendedRoas ? `${blendedRoas.toFixed(2)}×` : '—'} accent="var(--c-amber)" mono />
        </div>

        {/* Controls bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          {/* Status filter */}
          <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--s2)', borderRadius: 10, border: '1px solid var(--b1)' }}>
            {['active', 'paused', 'archived', 'all'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer', transition: 'all 0.12s',
                background: filter === f ? 'var(--s1)' : 'transparent', color: filter === f ? 'var(--t1)' : 'var(--t2)',
                boxShadow: filter === f ? 'var(--sh-sm)' : 'none',
              }}>{f}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Sort */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rank by</span>
              <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--s2)', borderRadius: 9, border: '1px solid var(--b1)' }}>
                {SORT_OPTIONS.map(o => (
                  <button key={o.key} onClick={() => setSortBy(o.key)} style={{
                    padding: '5px 11px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
                    background: sortBy === o.key ? 'var(--brand)' : 'transparent', color: sortBy === o.key ? '#fff' : 'var(--t2)',
                  }}>{o.label}</button>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--s2)', borderRadius: 9, border: '1px solid var(--b1)' }}>
              {DATE_RANGES.map(r => (
                <button key={r.key} onClick={() => setRange(r.key)} style={{
                  padding: '5px 11px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap',
                  background: range === r.key ? 'var(--s1)' : 'transparent', color: range === r.key ? 'var(--t1)' : 'var(--t2)',
                  boxShadow: range === r.key ? 'var(--sh-sm)' : 'none',
                }}>{r.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && <div style={{ margin: '0 32px 16px', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 9, padding: '11px 15px', fontSize: 12.5, color: 'var(--red)', fontWeight: 600 }}>{error}</div>}

      {/* Table */}
      <div style={{ margin: '0 32px 32px', background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--sh-md)' }}>
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '44px 110px 1fr 130px 120px 64px 90px 110px 40px', alignItems: 'center', gap: 14, padding: '11px 22px', borderBottom: '1px solid var(--b1)', background: 'var(--s2)' }}>
            {['#', 'Tag', 'Batch', 'Source', 'Revenue', 'Orders', 'ROAS', 'Relative', 'Status'].map((h, i) => (
              <div key={h} style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: ['Revenue', 'Orders', 'ROAS'].includes(h) ? 'right' : 'left' }}>{h}</div>
            ))}
            <div />
          </div>
        )}

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--t3)', fontFamily: "'Fira Code', monospace", fontSize: 12 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '70px 32px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, margin: '0 auto 16px', borderRadius: 12, background: 'var(--brand-l)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 5 }}>{filter === 'all' ? 'No batches yet' : `No ${filter} batches`}</div>
            <div style={{ fontSize: 12.5, color: 'var(--t2)', marginBottom: 20 }}>Create your first batch to start ranking performance.</div>
            {filter === 'all' && <Btn onClick={() => setShowCreate(true)} variant="primary">Create first batch</Btn>}
          </div>
        ) : (
          filtered.map((batch, i) => (
            <BatchRow key={batch.id} batch={batch} rank={i + 1} maxRevenue={maxRevenue} onAction={(action) => handleAction(batch, action)} />
          ))
        )}
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
    </div>
  );
}

function StatCard({ label, value, accent, mono }) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 13, padding: '16px 18px', boxShadow: 'var(--sh-sm)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: accent }} />
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.02em', fontFamily: mono ? "'Fira Code', monospace" : 'inherit' }}>{value}</div>
    </div>
  );
}
