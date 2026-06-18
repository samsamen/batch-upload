import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api, fmtCurrency, fmtDate } from '../api.js';

// ── Shared primitives (duplicated here to keep pages self-contained) ─────────

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

  useEffect(() => { load(); }, [id]);

  async function load() {
    try { setLoading(true); setBatch(await api.get(`/api/batches/${id}`)); }
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

  // Store rows
  const storeRows = (batch.biq_batch_stores || []).map(bs => {
    const rev = (bs.biq_performance_daily || []).reduce((s, p) => s + parseFloat(p.revenue || 0), 0);
    const ord = (bs.biq_performance_daily || []).reduce((s, p) => s + (p.orders || 0), 0);
    const unt = (bs.biq_performance_daily || []).reduce((s, p) => s + (p.units_sold || 0), 0);
    return { ...bs, totals: { revenue: rev, orders: ord, units: unt } };
  }).sort((a, b) => b.totals.revenue - a.totals.revenue);

  const grand = storeRows.reduce(
    (acc, r) => ({ revenue: acc.revenue + r.totals.revenue, orders: acc.orders + r.totals.orders, units: acc.units + r.totals.units }),
    { revenue: 0, orders: 0, units: 0 }
  );

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
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)' }}>
            {batch.name}
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

        {/* Metadata + totals */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
          {/* Left: metadata */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 5, padding: 20 }}>
            {batch.source && <MetaField label="Source" value={batch.source} />}
            {batch.thesis && <MetaField label="Thesis" value={batch.thesis} />}
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
            <Label style={{ marginBottom: 16 }}>All-time totals</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <BigStat label="Revenue" value={fmtCurrency(grand.revenue)} gold={grand.revenue > 0} />
              <div style={{ height: 1, background: 'var(--b1)' }} />
              <BigStat label="Orders"  value={grand.orders} />
              <BigStat label="Units"   value={grand.units} />
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
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--b1)' }}>
                  {['Store', 'Sub-tag', 'Revenue', 'Orders', 'Units', ''].map(h => (
                    <th key={h} style={{
                      padding: '8px 20px', textAlign: 'left',
                      fontSize: 9, fontWeight: 600, color: 'var(--t3)',
                      textTransform: 'uppercase', letterSpacing: '0.09em',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {storeRows.map((bs, i) => (
                  <tr
                    key={bs.id}
                    style={{ borderBottom: i < storeRows.length - 1 ? '1px solid var(--b1)' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--s2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--t1)', fontSize: 13 }}>
                      {bs.biq_stores?.name || '—'}
                      {bs.notes && (
                        <div style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 400, marginTop: 2 }}>
                          {bs.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      {bs.shopify_tag ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <TagChip tag={bs.shopify_tag} />
                          <CopyButton value={bs.shopify_tag} />
                        </div>
                      ) : <span style={{ fontSize: 11, color: 'var(--t3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: "'Fira Code', monospace", fontSize: 13, fontWeight: 500, color: bs.totals.revenue > 0 ? 'var(--brand)' : 'var(--t3)' }}>
                      {fmtCurrency(bs.totals.revenue)}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: "'Fira Code', monospace", fontSize: 12, color: 'var(--t2)' }}>
                      {bs.totals.orders}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: "'Fira Code', monospace", fontSize: 12, color: 'var(--t2)' }}>
                      {bs.totals.units}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => syncStore(bs.biq_stores?.id)}
                          disabled={syncing === bs.biq_stores?.id}
                          style={{
                            fontSize: 12, fontWeight: 700, color: '#fff',
                            background: 'linear-gradient(135deg, #818CF8, #6366F1)',
                            border: 'none', borderRadius: 8, padding: '7px 14px',
                            cursor: 'pointer', boxShadow: 'var(--sh-brand)',
                            opacity: syncing === bs.biq_stores?.id ? 0.7 : 1, transition: 'transform 0.1s',
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                          }}
                          onMouseEnter={e => { if (syncing !== bs.biq_stores?.id) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                          {syncing === bs.biq_stores?.id && (
                            <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                          )}
                          {syncing === bs.biq_stores?.id ? 'Syncing…' : 'Sync now'}
                        </button>
                        <button
                          onClick={() => removeStore(bs.id)}
                          style={{
                            fontSize: 12, fontWeight: 600, color: 'var(--t1)',
                            background: 'var(--s1)', border: '1px solid var(--b2)',
                            borderRadius: 8, padding: '7px 14px', cursor: 'pointer', transition: 'all 0.12s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.background = 'var(--red-bg)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--t1)'; e.currentTarget.style.borderColor = 'var(--b2)'; e.currentTarget.style.background = 'var(--s1)'; }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
