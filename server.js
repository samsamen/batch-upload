import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api, fmtCurrency, fmtDate } from '../api.js';

// ── Shared primitives (duplicated here to keep pages self-contained) ─────────

function BatchStageBadge({ stage }) {
  const map = {
    draft:       { label: 'Draft',       color: 'var(--t3)',    bg: 'var(--s3)' },
    in_progress: { label: 'In Progress', color: 'var(--amber)', bg: 'var(--amber-bg)' },
    live:        { label: 'Live',        color: 'var(--green)', bg: 'var(--green-bg)' },
  };
  const s = map[stage] || map.draft;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, border: '1px solid ' + s.color + '44', borderRadius: 6, padding: '3px 10px' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, boxShadow: stage === 'live' ? `0 0 6px ${s.color}` : 'none' }} />
      {s.label}
    </span>
  );
}

function TagChip({ tag }) {
  return (
    <span style={{
      display: 'inline-block',
      fontFamily: "'Fira Code', monospace", fontSize: 11, fontWeight: 500,
      color: 'var(--brand)', border: '1px solid var(--b2)',
      borderRadius: 3, padding: '1px 8px',
      letterSpacing: '0.02em', background: 'var(--brand-l)',
      whiteSpace: 'nowrap',
    }}>
      {tag}
    </span>
  );
}

function CopyButton({ value }) {
  const [state, setState] = useState('idle');
  function handleCopy(e) {
    e.preventDefault(); e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setState('copied');
      setTimeout(() => setState('idle'), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      style={{
        fontFamily: "'Fira Code', monospace", fontSize: 9, fontWeight: 500,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: state === 'copied' ? 'var(--green)' : 'var(--t2)',
        background: 'none',
        border: '1px solid ' + (state === 'copied' ? 'rgba(56,217,138,0.3)' : 'var(--b2)'),
        borderRadius: 3, padding: '2px 7px', cursor: 'pointer',
        transition: 'all 0.15s', height: 20,
      }}
    >
      {state === 'copied' ? 'Copied' : 'Copy'}
    </button>
  );
}

function MarketDropdown({ markets, batchOverlap }) {
  const [open, setOpen] = useState(false);
  if (!markets || markets.length === 0) return null;
  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--b1)', paddingTop: 10 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--brand)', fontSize: 12, fontWeight: 700 }}>
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▸</span>
        Markets ({markets.length})
      </button>
      {open && (
        <div style={{ marginTop: 10, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--b1)' }}>
                {['Market', 'Revenue', 'Ad spend', 'ROAS', 'CTR', 'Orders', 'Units'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Market' ? 'left' : 'right', padding: '6px 10px', fontSize: 9, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {markets.map(m => {
                const ov = batchOverlap.includes(m.market);
                return (
                  <tr key={m.market} style={{ borderBottom: '1px solid var(--b1)' }}>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: "'Fira Code', monospace", fontWeight: 700, color: ov ? 'var(--gold)' : 'var(--t1)' }}>
                        {ov && <WarnTriangle size={11} />}{m.market}
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'Fira Code', monospace", color: m.revenue > 0 ? 'var(--brand)' : 'var(--t3)' }}>{fmtCurrency(m.revenue)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'Fira Code', monospace", color: 'var(--t2)' }}>{fmtCurrency(m.spend)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'Fira Code', monospace", fontWeight: 700, color: m.roas >= 1 ? 'var(--green)' : (m.roas !== null ? 'var(--amber)' : 'var(--t3)') }}>{m.roas !== null ? m.roas.toFixed(2) : '—'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'Fira Code', monospace", color: 'var(--t2)' }}>{m.ctr !== null && m.ctr !== undefined ? m.ctr.toFixed(2) + '%' : '—'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'Fira Code', monospace", color: 'var(--t2)' }}>{m.orders}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'Fira Code', monospace", color: 'var(--t2)' }}>{m.units}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WarnTriangle({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M12 3L2 20h20L12 3z" fill="rgba(232,184,75,0.18)" stroke="var(--gold)" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 9v5" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.6" fill="var(--gold)" stroke="var(--gold)" strokeWidth="0.8" />
    </svg>
  );
}

function StatusPill({ label, count, color, bg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      background: bg, color: color,
    }}>
      <span style={{ fontFamily: "'Fira Code', monospace" }}>{count}</span>
      <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.85 }}>{label}</span>
    </span>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: "'Fira Code', monospace", fontSize: 14, fontWeight: 600, color: accent ? 'var(--brand)' : 'var(--t1)' }}>{value}</div>
    </div>
  );
}

function Label({ children, style }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 600, color: 'var(--t3)',
      textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 5,
      ...style,
    }}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = 'ghost' }) {
  const styles = {
    primary: { background: 'linear-gradient(135deg, #818CF8, #6366F1)', color: '#fff', border: 'none', fontWeight: 700, boxShadow: 'var(--sh-brand)' },
    ghost:   { background: 'var(--s1)', color: 'var(--t1)', border: '1px solid var(--b2)', fontWeight: 600 },
    danger:  { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)', fontWeight: 600 },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '9px 16px', borderRadius: 9, fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'transform 0.1s', display: 'inline-flex', alignItems: 'center', gap: 7, ...styles[variant],
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      {children}
    </button>
  );
}

// ── Add Store Modal ──────────────────────────────────────────────────────────
function AddStoreModal({ batchId, batchTag, onClose, onAdd }) {
  const [stores, setStores]         = useState([]);
  const [loadingStores, setLS]      = useState(true);
  const [form, setForm]             = useState({ store_id: '', shopify_tag: '', notes: '' });
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  useEffect(() => {
    api.get('/api/stores').then(data => { setStores(data); setLS(false); });
  }, []);

  function handleStoreSelect(e) {
    const id = e.target.value;
    const store = stores.find(s => s.id === id);
    const cc = (store?.country || '').toLowerCase().slice(0, 2);
    const suggested = batchTag ? (cc ? `${batchTag}-${cc}` : batchTag) : '';
    setForm(f => ({ ...f, store_id: id, shopify_tag: suggested }));
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit() {
    if (!form.store_id) {
      setError('Select a store.'); return;
    }
    setLoading(true); setError(null);
    try {
      const bs = await api.post(`/api/batches/${batchId}/stores`, {
        store_id: form.store_id,
        shopify_tag: form.shopify_tag.trim() || null,
        notes: form.notes,
      });
      onAdd(bs); onClose();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,20,35,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        background: 'var(--s1)', border: '1px solid var(--b2)',
        borderRadius: 14, width: 460, padding: 26,
        boxShadow: 'var(--sh-xl)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)' }}>Add store to batch</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, color: 'var(--t3)', background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>✕</button>
        </div>

        {error && (
          <div style={{
            background: 'var(--red-bg)', border: '1px solid var(--red)',
            borderRadius: 9, padding: '9px 13px', marginBottom: 14, fontSize: 12.5, color: 'var(--red)', fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Label>Store</Label>
            <select value={form.store_id} onChange={handleStoreSelect} disabled={loadingStores}>
              <option value="">Select a store…</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name} — {s.shop_domain}</option>)}
            </select>
            {!loadingStores && stores.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--brand)', marginTop: 5 }}>
                No stores connected. Go to Stores first.
              </div>
            )}
          </div>

          <div>
            <Label>Store sub-tag <span style={{ color: 'var(--t4)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></Label>
            <input
              placeholder={batchTag ? `${batchTag}-fi` : 'optional'}
              value={form.shopify_tag}
              onChange={set('shopify_tag')}
              style={{ fontFamily: "'Fira Code', monospace", fontSize: 13 }}
            />
          </div>

          <div>
            <Label>Notes <span style={{ color: 'var(--t4)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></Label>
            <textarea
              rows={2} placeholder="e.g. 3 dresses + 2 accessories"
              value={form.notes} onChange={set('notes')}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <Btn onClick={onClose} variant="ghost">Cancel</Btn>
          <Btn onClick={submit} disabled={loading} variant="primary">
            {loading ? 'Adding…' : 'Add Store'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function TagRow({ tag, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <TagChip tag={tag} />
      <span style={{ fontSize: 11, color: 'var(--t2)' }}>{note}</span>
      <CopyButton value={tag} />
    </div>
  );
}

// ── Custom chart tooltip ─────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--s2)', border: '1px solid var(--b2)',
      borderRadius: 4, padding: '8px 12px', fontSize: 11,
    }}>
      <div style={{ color: 'var(--t3)', marginBottom: 4, fontFamily: "'Fira Code', monospace" }}>{label}</div>
      <div style={{ color: 'var(--brand)', fontFamily: "'Fira Code', monospace", fontWeight: 500 }}>
        {fmtCurrency(payload[0]?.value)}
      </div>
      {payload[1] && (
        <div style={{ color: 'var(--t2)', fontFamily: "'Fira Code', monospace", marginTop: 2 }}>
          {payload[1].value} orders
        </div>
      )}
    </div>
  );
}

// ── BatchDetail ──────────────────────────────────────────────────────────────
export default function BatchDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [batch, setBatch]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showAddStore, setAddStore] = useState(false);
  const [syncing, setSyncing]     = useState(null);
  const [range, setRange]         = useState('all');

  useEffect(() => { load(); }, [id, range]);

  async function load() {
    try { setLoading(true); setBatch(await api.get(`/api/batches/${id}?range=${range}`)); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function syncStore(storeId) {
    setSyncing(storeId);
    try { await api.post(`/api/sync/store/${storeId}`, { days: 30 }); await load(); }
    catch (err) { setError(err.message); } finally { setSyncing(null); }
  }

  async function removeStore(bsId) {
    if (!confirm('Remove this store from the batch? Performance data is kept.')) return;
    try { await api.delete(`/api/batches/${id}/stores/${bsId}`); await load(); }
    catch (err) { setError(err.message); }
  }

  async function archiveBatch() {
    if (!confirm('Archive this batch?')) return;
    await api.patch(`/api/batches/${id}`, { status: 'archived' });
    navigate('/');
  }

  function onStoreAdded(bs) {
    setBatch(prev => ({ ...prev, biq_batch_stores: [...(prev.biq_batch_stores || []), bs] }));
  }

  if (loading) return (
    <div style={{ padding: '40px 32px', fontFamily: "'Fira Code', monospace", fontSize: 12, color: 'var(--t3)' }}>
      Loading…
    </div>
  );
  if (error) return <div style={{ padding: 40, color: 'var(--red)', fontSize: 12 }}>{error}</div>;
  if (!batch) return null;

  // Chart data
  const byDate = {};
  for (const bs of batch.biq_batch_stores || []) {
    for (const p of bs.biq_performance_daily || []) {
      if (!byDate[p.date]) byDate[p.date] = { date: p.date, revenue: 0, orders: 0 };
      byDate[p.date].revenue += parseFloat(p.revenue || 0);
      byDate[p.date].orders  += p.orders || 0;
    }
  }
  const chartData = Object.values(byDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({ ...d, date: d.date.slice(5) }));

  // Store rows — prefer backend rollup (has spend/roas/markets), fall back to local calc
  const storeRows = (batch.biq_batch_stores || []).map(bs => {
    const r = bs.rollup || {};
    const rev = r.revenue ?? (bs.biq_performance_daily || []).reduce((s, p) => s + parseFloat(p.revenue || 0), 0);
    const ord = r.orders ?? (bs.biq_performance_daily || []).reduce((s, p) => s + (p.orders || 0), 0);
    const unt = r.units ?? (bs.biq_performance_daily || []).reduce((s, p) => s + (p.units_sold || 0), 0);
    const spend = r.spend ?? 0;
    const roas = r.roas ?? (spend > 0 ? rev / spend : null);
    const clicks = r.clicks ?? 0;
    const impressions = r.impressions ?? 0;
    const ctr = r.ctr ?? (impressions > 0 ? (clicks / impressions) * 100 : null);
    const markets = r.markets || [];
    return { ...bs, totals: { revenue: rev, orders: ord, units: unt, spend, roas, clicks, impressions, ctr }, marketRows: markets };
  }).sort((a, b) => b.totals.revenue - a.totals.revenue);

  const grand = storeRows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.totals.revenue,
      orders: acc.orders + r.totals.orders,
      units: acc.units + r.totals.units,
      spend: acc.spend + (r.totals.spend || 0),
      clicks: acc.clicks + (r.totals.clicks || 0),
      impressions: acc.impressions + (r.totals.impressions || 0),
      active: acc.active + (r.product_count_active || 0),
      draft: acc.draft + (r.product_count_draft || 0),
      archived: acc.archived + (r.product_count_archived || 0),
      totalProducts: acc.totalProducts + (r.product_count || 0),
    }),
    { revenue: 0, orders: 0, units: 0, spend: 0, clicks: 0, impressions: 0, active: 0, draft: 0, archived: 0, totalProducts: 0 }
  );
  grand.roas = grand.spend > 0 ? grand.revenue / grand.spend : null;
  grand.ctr = grand.impressions > 0 ? (grand.clicks / grand.impressions) * 100 : null;

  // Detect markets shared by 2+ stores within THIS batch (cannibalization risk)
  const batchMarketCount = {};
  for (const r of storeRows) {
    for (const m of (r.biq_stores?.markets || [])) {
      batchMarketCount[m] = (batchMarketCount[m] || 0) + 1;
    }
  }
  const batchOverlap = Object.entries(batchMarketCount).filter(([, n]) => n > 1).map(([m]) => m);

  return (
    <div>
      {/* Header */}
      <div style={{
        padding: '20px 32px',
        borderBottom: '1px solid var(--b1)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          {/* Back */}
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none', color: 'var(--t2)', fontSize: 11,
              padding: 0, marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
            }}
          >
            <span>←</span> Batches
          </button>

          {/* Batch identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            {batch.batch_tag && <TagChip tag={batch.batch_tag} />}
            <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 10, color: 'var(--t3)', letterSpacing: '0.04em' }}>
              {batch.batch_code}
            </span>
            <span style={{ fontSize: 10, color: 'var(--t3)' }}>
              Created {fmtDate(batch.created_at)}
            </span>
            {batch.start_date && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-l)', border: '1px solid var(--brand-l)', borderRadius: 5, padding: '2px 9px' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                Live since {fmtDate(batch.start_date)}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, fontWeight: 700, color: 'var(--t1)' }}>
            {batch.name}
            <CopyButton value={batch.name} />
            <BatchStageBadge stage={batch.stage} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, paddingTop: 28 }}>
          <Btn onClick={() => setAddStore(true)} variant="primary">Add Store</Btn>
          <Btn onClick={archiveBatch} variant="danger">Archive</Btn>
        </div>
      </div>

      {error && (
        <div style={{
          margin: '16px 32px',
          background: 'rgba(239,80,80,0.08)', border: '1px solid rgba(239,80,80,0.2)',
          borderRadius: 4, padding: '10px 14px', fontSize: 12, color: 'var(--red)',
        }}>
          {error}
        </div>
      )}

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Main reason — the thesis, the WHY this batch exists, with a gold glow */}
        {batch.thesis && (
          <div style={{
            position: 'relative',
            background: 'linear-gradient(135deg, rgba(232,184,75,0.10), rgba(232,184,75,0.03))',
            border: '1px solid rgba(232,184,75,0.35)',
            borderRadius: 12,
            padding: '18px 22px',
            boxShadow: '0 0 0 1px rgba(232,184,75,0.08), 0 4px 24px -6px rgba(232,184,75,0.35)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21.4 8 14 2 9.4h7.6L12 2z" fill="var(--gold)" />
              </svg>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Main reason for this batch</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.5 }}>{batch.thesis}</div>
            {batch.source && (
              <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--t2)' }}>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>Source:</span> {batch.source}
              </div>
            )}
          </div>
        )}

        {/* Metadata + totals */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
          {/* Left: metadata */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 5, padding: 20 }}>
            {batch.validation_notes && <MetaField label="Validation" value={batch.validation_notes} />}

            {batch.batch_tag && (
              <div style={{ marginTop: 14 }}>
                <Label>Shopify tags</Label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TagChip tag={batch.batch_tag} />
                    <span style={{ fontSize: 11, color: 'var(--t2)' }}>Parent — apply to all products</span>
                    <CopyButton value={batch.batch_tag} />
                  </div>
                </div>
              </div>
            )}

            {batch.tags?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <Label>Labels</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {batch.tags.map(tag => (
                    <span key={tag} style={{
                      background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--b1)',
                      fontSize: 10, padding: '2px 8px', borderRadius: 3,
                    }}>{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: totals */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 5, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Label style={{ margin: 0 }}>{range === 'all' ? 'All-time totals' : `Last ${range} days`}</Label>
              <select value={range} onChange={e => setRange(e.target.value)}
                style={{ fontSize: 11, fontFamily: "'Fira Code', monospace", padding: '4px 8px', borderRadius: 6, background: 'var(--s2)', border: '1px solid var(--b2)', color: 'var(--t1)', cursor: 'pointer' }}>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="all">All time</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <BigStat label="Revenue" value={fmtCurrency(grand.revenue)} gold={grand.revenue > 0} />
              <div style={{ height: 1, background: 'var(--b1)' }} />
              <BigStat label="Ad spend" value={fmtCurrency(grand.spend)} />
              <BigStat label="ROAS" value={grand.roas !== null ? grand.roas.toFixed(2) : '—'} gold={grand.roas !== null && grand.roas >= 1} />
              <BigStat label="CTR" value={grand.ctr !== null ? grand.ctr.toFixed(2) + '%' : '—'} />
              <div style={{ height: 1, background: 'var(--b1)' }} />
              <BigStat label="Orders"  value={grand.orders} />
              <BigStat label="Units"   value={grand.units} />
              <div style={{ height: 1, background: 'var(--b1)' }} />
              <BigStat label="Active products" value={grand.active} />
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: -8 }}>
                {grand.totalProducts} total · {grand.draft} draft · {grand.archived} archived
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 5, padding: 20 }}>
            <Label style={{ marginBottom: 16 }}>Daily revenue — all stores</Label>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--b1)" strokeDasharray="0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'var(--t3)', fontSize: 10, fontFamily: "'Fira Code', monospace" }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--t3)', fontSize: 10, fontFamily: "'Fira Code', monospace" }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => `€${v}`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="revenue" stroke="var(--brand)" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Stores table */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 5, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 20px', borderBottom: '1px solid var(--b1)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>
              Stores in this batch
            </div>
            <Btn onClick={() => setAddStore(true)} variant="primary">Add Store</Btn>
          </div>

          {storeRows.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
              No stores added. Click "Add Store" to link a Shopify store to this batch.
            </div>
          ) : (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {batchOverlap.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', borderRadius: 10, background: 'rgba(232,184,75,0.1)', border: '1px solid rgba(232,184,75,0.35)' }}>
                  <WarnTriangle />
                  <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>
                    Overlapping markets in this batch: {batchOverlap.join(', ')} — multiple stores target the same country.
                  </span>
                </div>
              )}
              {storeRows.map((bs) => {
                const markets = bs.biq_stores?.markets || [];
                const hasOverlap = markets.some(m => batchOverlap.includes(m));
                return (
                  <div key={bs.id} style={{
                    background: 'var(--s1)',
                    border: '1px solid ' + (hasOverlap ? 'rgba(232,184,75,0.4)' : 'var(--brand-l)'),
                    borderRadius: 14, padding: '16px 18px',
                    boxShadow: hasOverlap ? '0 0 0 1px rgba(232,184,75,0.15), 0 4px 18px -6px rgba(232,184,75,0.25)' : '0 0 0 1px rgba(99,102,241,0.08), 0 4px 20px -8px rgba(99,102,241,0.35)',
                    transition: 'transform 0.12s, box-shadow 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = hasOverlap ? '0 0 0 1px rgba(232,184,75,0.25), 0 8px 26px -6px rgba(232,184,75,0.4)' : '0 0 0 1px rgba(99,102,241,0.15), 0 8px 30px -8px rgba(99,102,241,0.55)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = hasOverlap ? '0 0 0 1px rgba(232,184,75,0.15), 0 4px 18px -6px rgba(232,184,75,0.25)' : '0 0 0 1px rgba(99,102,241,0.08), 0 4px 20px -8px rgba(99,102,241,0.35)'; }}>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
                      {/* Left: identity + markets */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{bs.biq_stores?.name || '—'}</span>
                          {hasOverlap && <WarnTriangle />}
                          {bs.shopify_tag && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <TagChip tag={bs.shopify_tag} />
                              <CopyButton value={bs.shopify_tag} />
                            </span>
                          )}
                        </div>
                        {bs.notes && <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 4 }}>{bs.notes}</div>}

                        {/* Product status breakdown */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--t2)' }}>{bs.product_count || 0} products:</span>
                          <StatusPill label="active" count={bs.product_count_active || 0} color="var(--green)" bg="var(--green-bg)" />
                          <StatusPill label="draft" count={bs.product_count_draft || 0} color="var(--amber)" bg="var(--amber-bg)" />
                          <StatusPill label="archived" count={bs.product_count_archived || 0} color="var(--t3)" bg="var(--s3)" />
                        </div>

                        {/* Markets underneath */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                          {markets.length > 0 ? markets.map(m => {
                            const ov = batchOverlap.includes(m);
                            return (
                              <span key={m} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontFamily: "'Fira Code', monospace", fontSize: 10.5, fontWeight: 600,
                                padding: '2px 8px', borderRadius: 6,
                                background: ov ? 'rgba(232,184,75,0.15)' : 'var(--brand-l)',
                                color: ov ? 'var(--gold)' : 'var(--brand)',
                                border: '1px solid ' + (ov ? 'rgba(232,184,75,0.4)' : 'transparent'),
                              }}>
                                {ov && <WarnTriangle size={10} />}
                                {m}
                              </span>
                            );
                          }) : <span style={{ fontSize: 10.5, color: 'var(--t3)' }}>No markets — Sync or Edit the store to load them</span>}
                        </div>
                      </div>

                      {/* Right: stats */}
                      <div style={{ display: 'flex', gap: 22, textAlign: 'right', flexShrink: 0 }}>
                        <Stat label="Revenue" value={fmtCurrency(bs.totals.revenue)} accent={bs.totals.revenue > 0} />
                        <Stat label="Ad spend" value={fmtCurrency(bs.totals.spend || 0)} />
                        <Stat label="ROAS" value={bs.totals.roas !== null && bs.totals.roas !== undefined ? bs.totals.roas.toFixed(2) : '—'} accent={bs.totals.roas >= 1} />
                        <Stat label="CTR" value={bs.totals.ctr !== null && bs.totals.ctr !== undefined ? bs.totals.ctr.toFixed(2) + '%' : '—'} />
                        <Stat label="Orders" value={bs.totals.orders} />
                        <Stat label="Units" value={bs.totals.units} />
                      </div>
                    </div>

                    {/* Per-market dropdown */}
                    <MarketDropdown markets={bs.marketRows || []} batchOverlap={batchOverlap} />

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                      <button
                        onClick={() => syncStore(bs.biq_stores?.id)}
                        disabled={syncing === bs.biq_stores?.id}
                        style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #818CF8, #6366F1)', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', boxShadow: 'var(--sh-brand)', opacity: syncing === bs.biq_stores?.id ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {syncing === bs.biq_stores?.id && <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />}
                        {syncing === bs.biq_stores?.id ? 'Syncing…' : 'Sync now'}
                      </button>
                      <button
                        onClick={() => removeStore(bs.id)}
                        style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', transition: 'all 0.12s' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.background = 'var(--red-bg)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--t1)'; e.currentTarget.style.borderColor = 'var(--b2)'; e.currentTarget.style.background = 'var(--s1)'; }}>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showAddStore && (
        <AddStoreModal
          batchId={id}
          batchTag={batch.batch_tag}
          onClose={() => setAddStore(false)}
          onAdd={onStoreAdded}
        />
      )}
    </div>
  );
}

function MetaField({ label, value }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <Label>{label}</Label>
      <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.6 }}>{value}</div>
    </div>
  );
}

function BigStat({ label, value, gold }) {
  return (
    <div>
      <Label style={{ marginBottom: 4 }}>{label}</Label>
      <div style={{
        fontFamily: "'Fira Code', monospace", fontSize: 20, fontWeight: 500,
        color: gold ? 'var(--brand)' : 'var(--t1)',
      }}>
        {value}
      </div>
    </div>
  );
}
