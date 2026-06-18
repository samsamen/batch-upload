import { useState } from 'react';
import { api, fmtCurrency } from '../api.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared rich content for a batch: gold reason, totals (w/ CTR), store cards
// with product-status pills + per-market dropdowns. Used by BOTH the detail
// page and the Dashboard expand so they always look identical.
// ─────────────────────────────────────────────────────────────────────────────

function CopyBtn({ value }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(value); setDone(true); setTimeout(() => setDone(false), 1200); }}
      style={{ fontSize: 10, fontWeight: 700, color: done ? 'var(--green)' : 'var(--brand)', background: done ? 'var(--green-bg)' : 'var(--brand-l)', border: 'none', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {done ? '✓ Copied' : 'Copy'}
    </button>
  );
}

function Pill({ label, count, color, bg }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color, background: bg, borderRadius: 5, padding: '2px 8px' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {count} {label}
    </span>
  );
}

function Warn({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3L2 20h20L12 3z" stroke="var(--gold)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 10v4M12 17h.01" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontFamily: "'Fira Code', monospace", fontSize: 13, fontWeight: 600, color: accent ? 'var(--green)' : 'var(--t1)' }}>{value}</div>
    </div>
  );
}

function MarketDropdown({ markets, batchOverlap }) {
  const [open, setOpen] = useState(false);
  if (!markets || markets.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-l)', border: 'none', borderRadius: 7, padding: '5px 11px', cursor: 'pointer' }}>
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▸</span>
        Markets ({markets.length}) — revenue, spend, ROAS, CTR per country
      </button>
      {open && (
        <div style={{ marginTop: 8, overflowX: 'auto', border: '1px solid var(--b1)', borderRadius: 9 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: 'var(--s2)' }}>
                {['Market', 'Revenue', 'Ad spend', 'ROAS', 'CTR', 'Orders', 'Units'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Market' ? 'left' : 'right', padding: '7px 10px', fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {markets.map((m, i) => {
                const ov = batchOverlap?.includes(m.market);
                return (
                  <tr key={m.market} style={{ borderTop: i > 0 ? '1px solid var(--b1)' : 'none' }}>
                    <td style={{ padding: '7px 10px', fontFamily: "'Fira Code', monospace", fontWeight: 700, color: ov ? 'var(--gold)' : 'var(--t1)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{ov && <Warn size={10} />}{m.market}</span>
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'Fira Code', monospace", color: 'var(--t1)' }}>{fmtCurrency(m.revenue)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'Fira Code', monospace", color: 'var(--t2)' }}>{fmtCurrency(m.spend || 0)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'Fira Code', monospace", fontWeight: 700, color: m.roas >= 1 ? 'var(--green)' : (m.roas !== null && m.roas !== undefined ? 'var(--amber)' : 'var(--t3)') }}>{m.roas !== null && m.roas !== undefined ? m.roas.toFixed(2) : '—'}</td>
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

function TagChip({ tag }) {
  return <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 11, fontWeight: 500, color: 'var(--brand)', border: '1px solid var(--b2)', borderRadius: 3, padding: '1px 8px', background: 'var(--brand-l)' }}>{tag}</span>;
}

export default function BatchRichContent({ batch, range, onRangeChange, onSyncStore, syncingStoreId }) {
  if (!batch) return null;

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
    return { ...bs, totals: { revenue: rev, orders: ord, units: unt, spend, roas, clicks, impressions, ctr }, marketRows: r.markets || [] };
  }).sort((a, b) => b.totals.revenue - a.totals.revenue);

  const grand = storeRows.reduce((acc, r) => ({
    revenue: acc.revenue + r.totals.revenue, orders: acc.orders + r.totals.orders, units: acc.units + r.totals.units,
    spend: acc.spend + (r.totals.spend || 0), clicks: acc.clicks + (r.totals.clicks || 0), impressions: acc.impressions + (r.totals.impressions || 0),
    active: acc.active + (r.product_count_active || 0), draft: acc.draft + (r.product_count_draft || 0), archived: acc.archived + (r.product_count_archived || 0),
  }), { revenue: 0, orders: 0, units: 0, spend: 0, clicks: 0, impressions: 0, active: 0, draft: 0, archived: 0 });
  grand.roas = grand.spend > 0 ? grand.revenue / grand.spend : null;
  grand.ctr = grand.impressions > 0 ? (grand.clicks / grand.impressions) * 100 : null;

  const batchMarketCount = {};
  for (const r of storeRows) for (const m of (r.biq_stores?.markets || [])) batchMarketCount[m] = (batchMarketCount[m] || 0) + 1;
  const batchOverlap = Object.entries(batchMarketCount).filter(([, n]) => n > 1).map(([m]) => m);

  const bigStats = [
    { label: 'Revenue', value: fmtCurrency(grand.revenue), gold: grand.revenue > 0 },
    { label: 'Ad spend', value: fmtCurrency(grand.spend) },
    { label: 'ROAS', value: grand.roas !== null ? grand.roas.toFixed(2) : '—', gold: grand.roas !== null && grand.roas >= 1 },
    { label: 'CTR', value: grand.ctr !== null ? grand.ctr.toFixed(2) + '%' : '—' },
    { label: 'Orders', value: grand.orders },
    { label: 'Units', value: grand.units },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Gold reason */}
      {batch.thesis && (
        <div style={{ position: 'relative', background: 'linear-gradient(135deg, rgba(232,184,75,0.10), rgba(232,184,75,0.03))', border: '1px solid rgba(232,184,75,0.35)', borderRadius: 12, padding: '16px 20px', boxShadow: '0 0 0 1px rgba(232,184,75,0.08), 0 4px 24px -6px rgba(232,184,75,0.35)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21.4 8 14 2 9.4h7.6L12 2z" fill="var(--gold)" /></svg>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Main reason for this batch</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.5 }}>{batch.thesis}</div>
          {batch.source && <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--t2)' }}><span style={{ color: 'var(--gold)', fontWeight: 700 }}>Source:</span> {batch.source}</div>}
        </div>
      )}

      {/* Totals bar with range filter */}
      <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{range === 'all' ? 'All-time totals' : `Last ${range} days`}</span>
          {onRangeChange && (
            <select value={range} onChange={e => onRangeChange(e.target.value)}
              style={{ fontSize: 11, fontFamily: "'Fira Code', monospace", padding: '4px 8px', borderRadius: 6, background: 'var(--s2)', border: '1px solid var(--b2)', color: 'var(--t1)', cursor: 'pointer' }}>
              <option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="all">All time</option>
            </select>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 14 }}>
          {bigStats.map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontFamily: "'Fira Code', monospace", fontSize: 18, fontWeight: 500, color: s.gold ? 'var(--brand)' : 'var(--t1)' }}>{s.value}</div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Products</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Pill label="active" count={grand.active} color="var(--green)" bg="var(--green-bg)" />
              <Pill label="draft" count={grand.draft} color="var(--amber)" bg="var(--amber-bg)" />
              <Pill label="arch." count={grand.archived} color="var(--t3)" bg="var(--s3)" />
            </div>
          </div>
        </div>
      </div>

      {/* Overlap warning */}
      {batchOverlap.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', borderRadius: 10, background: 'rgba(232,184,75,0.1)', border: '1px solid rgba(232,184,75,0.35)' }}>
          <Warn />
          <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>Overlapping markets: {batchOverlap.join(', ')} — multiple stores target the same country.</span>
        </div>
      )}

      {/* Store cards */}
      {storeRows.map((bs) => {
        const markets = bs.biq_stores?.markets || [];
        const hasOverlap = markets.some(m => batchOverlap.includes(m));
        return (
          <div key={bs.id} style={{ background: 'var(--s1)', border: '1px solid ' + (hasOverlap ? 'rgba(232,184,75,0.4)' : 'var(--brand-l)'), borderRadius: 14, padding: '16px 18px', boxShadow: hasOverlap ? '0 0 0 1px rgba(232,184,75,0.15), 0 4px 18px -6px rgba(232,184,75,0.25)' : '0 0 0 1px rgba(99,102,241,0.08), 0 4px 20px -8px rgba(99,102,241,0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{bs.biq_stores?.name || '—'}</span>
                  {hasOverlap && <Warn />}
                  {bs.shopify_tag && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><TagChip tag={bs.shopify_tag} /><CopyBtn value={bs.shopify_tag} /></span>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--t2)' }}>{bs.product_count || 0} products:</span>
                  <Pill label="active" count={bs.product_count_active || 0} color="var(--green)" bg="var(--green-bg)" />
                  <Pill label="draft" count={bs.product_count_draft || 0} color="var(--amber)" bg="var(--amber-bg)" />
                  <Pill label="archived" count={bs.product_count_archived || 0} color="var(--t3)" bg="var(--s3)" />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                  {markets.length > 0 ? markets.map(m => {
                    const ov = batchOverlap.includes(m);
                    return <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: "'Fira Code', monospace", fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: ov ? 'rgba(232,184,75,0.15)' : 'var(--brand-l)', color: ov ? 'var(--gold)' : 'var(--brand)', border: '1px solid ' + (ov ? 'rgba(232,184,75,0.4)' : 'transparent') }}>{ov && <Warn size={10} />}{m}</span>;
                  }) : <span style={{ fontSize: 10.5, color: 'var(--t3)' }}>No markets — Sync or Edit the store to load them</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 18, flexShrink: 0 }}>
                <Stat label="Revenue" value={fmtCurrency(bs.totals.revenue)} accent={bs.totals.revenue > 0} />
                <Stat label="Ad spend" value={fmtCurrency(bs.totals.spend || 0)} />
                <Stat label="ROAS" value={bs.totals.roas !== null && bs.totals.roas !== undefined ? bs.totals.roas.toFixed(2) : '—'} accent={bs.totals.roas >= 1} />
                <Stat label="CTR" value={bs.totals.ctr !== null && bs.totals.ctr !== undefined ? bs.totals.ctr.toFixed(2) + '%' : '—'} />
                <Stat label="Orders" value={bs.totals.orders} />
                <Stat label="Units" value={bs.totals.units} />
              </div>
            </div>

            <MarketDropdown markets={bs.marketRows || []} batchOverlap={batchOverlap} />

            {onSyncStore && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                <button onClick={() => onSyncStore(bs.biq_stores?.id)} disabled={syncingStoreId === bs.biq_stores?.id}
                  style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #818CF8, #6366F1)', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', opacity: syncingStoreId === bs.biq_stores?.id ? 0.7 : 1 }}>
                  {syncingStoreId === bs.biq_stores?.id ? 'Syncing…' : 'Sync now'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
