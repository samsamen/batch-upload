import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtCurrency } from '../api.js';

const SOURCES = [
  'AliExpress spy',
  'Competitor store',
  'TikTok trend',
  'Google Trends',
  'Manual research',
  'Supplier suggestion',
  'Other',
];

// ── Shared primitives ────────────────────────────────────────────────────────

function TagChip({ tag }) {
  return (
    <span style={{
      display: 'inline-block',
      fontFamily: 'var(--mono)',
      fontSize: 11,
      fontWeight: 500,
      color: 'var(--gold)',
      border: '1px solid rgba(232,184,75,0.28)',
      borderRadius: 3,
      padding: '1px 8px',
      letterSpacing: '0.02em',
      background: 'rgba(232,184,75,0.05)',
      whiteSpace: 'nowrap',
    }}>
      {tag}
    </span>
  );
}

function CopyButton({ value }) {
  const [state, setState] = useState('idle');

  function handleCopy(e) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setState('copied');
      setTimeout(() => setState('idle'), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        fontFamily: 'var(--mono)',
        fontSize: 9,
        fontWeight: 500,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: state === 'copied' ? 'var(--green)' : 'var(--t2)',
        background: 'none',
        border: '1px solid ' + (state === 'copied' ? 'rgba(56,217,138,0.3)' : 'var(--b2)'),
        borderRadius: 3,
        padding: '2px 7px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        height: 20,
      }}
    >
      {state === 'copied' ? 'Copied' : 'Copy'}
    </button>
  );
}

function StatusDot({ status }) {
  const map = {
    active:   { color: 'var(--green)',  label: 'Active' },
    paused:   { color: 'var(--gold)',   label: 'Paused' },
    archived: { color: 'var(--t3)',     label: 'Archived' },
  };
  const s = map[status] || map.archived;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 500 }}>{s.label}</span>
    </span>
  );
}

// ── Stat panel ───────────────────────────────────────────────────────────────
function Stat({ label, value, gold }) {
  return (
    <div>
      <div style={{
        fontSize: 9, fontWeight: 600, color: 'var(--t3)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 500,
        color: gold ? 'var(--gold)' : 'var(--t1)',
        letterSpacing: '-0.01em',
      }}>
        {value}
      </div>
    </div>
  );
}

// ── Create Batch Modal ───────────────────────────────────────────────────────
function CreateModal({ onClose, onCreate, nextNum }) {
  const [form, setForm] = useState({
    name: '',
    batch_tag: `b${nextNum}`,
    source: '',
    thesis: '',
    validation_notes: '',
    tags: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.batch_tag.trim()) { setError('Shopify tag is required.'); return; }
    setLoading(true); setError(null);
    try {
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      const batch = await api.post('/api/batches', { ...form, tags });
      onCreate(batch);
      onClose();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        background: 'var(--s1)', border: '1px solid var(--b2)',
        borderRadius: 6, width: 520, padding: 28,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>New Batch</div>
            <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 3 }}>
              Define the batch and the Shopify tag before uploading products.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', color: 'var(--t2)', fontSize: 18, lineHeight: 1,
              padding: '2px 6px', borderRadius: 3, border: '1px solid var(--b1)',
              transition: 'color 0.1s',
            }}
            onMouseEnter={e => e.target.style.color = 'var(--t1)'}
            onMouseLeave={e => e.target.style.color = 'var(--t2)'}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,80,80,0.08)', border: '1px solid rgba(239,80,80,0.25)',
            borderRadius: 4, padding: '8px 12px', marginBottom: 16,
            fontSize: 12, color: 'var(--red)',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Name + Tag */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 116px', gap: 10 }}>
            <div>
              <Label>Batch name</Label>
              <input placeholder="Summer Impulse Fashion" value={form.name} onChange={set('name')} />
            </div>
            <div>
              <Label>Shopify tag</Label>
              <input
                placeholder="b20"
                value={form.batch_tag}
                onChange={set('batch_tag')}
                style={{ fontFamily: 'var(--mono)', fontSize: 13 }}
              />
            </div>
          </div>

          {/* Tag structure preview */}
          {form.batch_tag && (
            <div style={{
              background: 'rgba(232,184,75,0.05)', border: '1px solid rgba(232,184,75,0.15)',
              borderRadius: 4, padding: '10px 14px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>
                Tag structure
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <TagInstruction
                  tag={form.batch_tag}
                  desc="Apply to every product in this batch, across all stores"
                />
                <TagInstruction
                  tag={`${form.batch_tag}-fi`}
                  desc="Store sub-tag — auto-suggested per store when you add one"
                />
              </div>
            </div>
          )}

          <div>
            <Label>Source</Label>
            <select value={form.source} onChange={set('source')}>
              <option value="">Select where you found these products</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <Label>Thesis</Label>
            <textarea
              rows={2}
              placeholder="Why you think this batch will perform — be specific."
              value={form.thesis}
              onChange={set('thesis')}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div>
            <Label>Validation</Label>
            <textarea
              rows={2}
              placeholder="Social proof, competitor signals, trend data."
              value={form.validation_notes}
              onChange={set('validation_notes')}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div>
            <Label>Labels (comma-separated)</Label>
            <input
              placeholder="summer, impulse-buy, fashion"
              value={form.tags}
              onChange={set('tags')}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 22, justifyContent: 'flex-end' }}>
          <Btn onClick={onClose} variant="ghost">Cancel</Btn>
          <Btn onClick={submit} disabled={loading} variant="primary">
            {loading ? 'Creating…' : 'Create Batch'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function TagInstruction({ tag, desc }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <TagChip tag={tag} />
      <span style={{ fontSize: 11, color: 'var(--t2)' }}>{desc}</span>
    </div>
  );
}

// ── Batch row in the ledger ──────────────────────────────────────────────────
function BatchRow({ batch, maxRevenue }) {
  const [hovered, setHovered] = useState(false);
  const revenue = batch.totals?.revenue || 0;
  const orders  = batch.totals?.orders  || 0;
  const barPct  = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;

  return (
    <Link to={`/batches/${batch.id}`} style={{ display: 'block' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '96px 1fr 140px 110px 58px 96px 80px',
          alignItems: 'center',
          gap: 16,
          padding: '13px 24px',
          borderBottom: '1px solid var(--b1)',
          background: hovered ? 'var(--s2)' : 'transparent',
          transition: 'background 0.1s',
          cursor: 'pointer',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Tag */}
        <div>
          {batch.batch_tag
            ? <TagChip tag={batch.batch_tag} />
            : <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)' }}>{batch.batch_code}</span>
          }
        </div>

        {/* Name + thesis */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: 'var(--t1)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {batch.name}
          </div>
          {batch.thesis && (
            <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {batch.thesis}
            </div>
          )}
        </div>

        {/* Source */}
        <div style={{ fontSize: 11, color: 'var(--t2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {batch.source || '—'}
        </div>

        {/* Revenue */}
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 500,
          color: revenue > 0 ? 'var(--gold)' : 'var(--t3)',
          textAlign: 'right',
        }}>
          {fmtCurrency(revenue)}
        </div>

        {/* Orders */}
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--t2)',
          textAlign: 'right',
        }}>
          {orders}
        </div>

        {/* Performance bar */}
        <div style={{ padding: '0 4px' }}>
          <div style={{ height: 2, background: 'var(--b1)', borderRadius: 1 }}>
            <div style={{
              height: '100%',
              width: `${barPct}%`,
              background: 'var(--gold)',
              borderRadius: 1,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* Status */}
        <div>
          <StatusDot status={batch.status} />
        </div>
      </div>
    </Link>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [batches, setBatches]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [syncing, setSyncing]     = useState(false);
  const [filter, setFilter]       = useState('active');

  useEffect(() => { load(); }, []);

  async function load() {
    try { setLoading(true); setBatches(await api.get('/api/batches')); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleSync() {
    setSyncing(true);
    try { await api.post('/api/sync', { days: 7 }); await load(); }
    catch (err) { setError(err.message); }
    finally { setSyncing(false); }
  }

  function handleCreate(batch) {
    setBatches(prev => [{ ...batch, totals: { orders: 0, revenue: 0, units: 0 }, store_count: 0 }, ...prev]);
  }

  const totalRevenue  = batches.reduce((s, b) => s + (b.totals?.revenue || 0), 0);
  const totalOrders   = batches.reduce((s, b) => s + (b.totals?.orders  || 0), 0);
  const activeBatches = batches.filter(b => b.status === 'active').length;
  const filtered = filter === 'all' ? batches : batches.filter(b => b.status === filter);
  const maxRevenue = Math.max(...filtered.map(b => b.totals?.revenue || 0), 0);
  const nextNum = batches.length + 1;

  return (
    <div>
      {/* Page header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '24px 32px 20px',
        borderBottom: '1px solid var(--b1)',
      }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--t1)' }}>Batches</div>
          <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>
            Track product groups across all stores by Shopify tag.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={handleSync} disabled={syncing} variant="ghost">
            {syncing ? 'Syncing…' : 'Sync'}
          </Btn>
          <Btn onClick={() => setShowCreate(true)} variant="primary">New Batch</Btn>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        borderBottom: '1px solid var(--b1)',
      }}>
        {[
          { label: 'Active batches', value: activeBatches },
          { label: 'Total revenue',  value: fmtCurrency(totalRevenue), gold: totalRevenue > 0 },
          { label: 'Total orders',   value: totalOrders },
        ].map((stat, i) => (
          <div
            key={stat.label}
            style={{
              padding: '20px 32px',
              borderRight: i < 2 ? '1px solid var(--b1)' : 'none',
            }}
          >
            <Stat label={stat.label} value={stat.value} gold={stat.gold} />
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '12px 32px',
        borderBottom: '1px solid var(--b1)',
      }}>
        {['active', 'paused', 'archived', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '4px 12px', borderRadius: 3, fontSize: 11, fontWeight: 500,
              background: filter === f ? 'var(--s2)' : 'transparent',
              color: filter === f ? 'var(--t1)' : 'var(--t2)',
              border: filter === f ? '1px solid var(--b2)' : '1px solid transparent',
              textTransform: 'capitalize', cursor: 'pointer',
              transition: 'all 0.1s',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          margin: '16px 32px',
          background: 'rgba(239,80,80,0.08)', border: '1px solid rgba(239,80,80,0.2)',
          borderRadius: 4, padding: '10px 14px', fontSize: 12, color: 'var(--red)',
        }}>
          {error}
        </div>
      )}

      {/* Column headers */}
      {!loading && filtered.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '96px 1fr 140px 110px 58px 96px 80px',
          alignItems: 'center',
          gap: 16,
          padding: '8px 24px',
          borderBottom: '1px solid var(--b1)',
        }}>
          {['Tag', 'Batch', 'Source', 'Revenue', 'Orders', 'Relative', 'Status'].map(h => (
            <div key={h} style={{
              fontSize: 9, fontWeight: 600, color: 'var(--t3)',
              textTransform: 'uppercase', letterSpacing: '0.09em',
              textAlign: ['Revenue', 'Orders'].includes(h) ? 'right' : 'left',
            }}>
              {h}
            </div>
          ))}
        </div>
      )}

      {/* Batch rows */}
      {loading ? (
        <div style={{ padding: '60px 32px', color: 'var(--t3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
          Loading batches…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '64px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 14 }}>
            {filter === 'all' ? 'No batches yet.' : `No ${filter} batches.`}
          </div>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} style={{ fontSize: 11, color: 'var(--t2)', background: 'none', textDecoration: 'underline', cursor: 'pointer' }}>
              Show all
            </button>
          )}
          {filter === 'all' && (
            <Btn onClick={() => setShowCreate(true)} variant="primary">Create your first batch</Btn>
          )}
        </div>
      ) : (
        <div>
          {filtered.map(batch => (
            <BatchRow key={batch.id} batch={batch} maxRevenue={maxRevenue} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          nextNum={nextNum}
        />
      )}
    </div>
  );
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────
function Label({ children }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 600, color: 'var(--t3)',
      textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 5,
    }}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = 'ghost' }) {
  const styles = {
    primary: {
      background: 'var(--gold)', color: '#0E0F14',
      border: 'none', fontWeight: 700, fontSize: 12,
    },
    ghost: {
      background: 'transparent', color: 'var(--t2)',
      border: '1px solid var(--b2)', fontWeight: 500, fontSize: 12,
    },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '7px 16px', borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--sans)', letterSpacing: '0.01em',
        opacity: disabled ? 0.5 : 1, transition: 'opacity 0.1s',
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

export { TagChip, CopyButton, StatusDot, Label, Btn };
