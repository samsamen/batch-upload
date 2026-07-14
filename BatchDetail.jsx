import { useState } from 'react';
import { api, fmtCurrency } from '../api.js';
import { conventionsForMarkets, hasMixedConventions } from '../lib/sizeConventions.js';

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

function DiagFlag({ ok, label }) {
  const color = ok === true ? 'var(--green)' : ok === false ? 'var(--red)' : 'var(--t3)';
  const sym = ok === true ? '✓' : ok === false ? '✗' : '○';
  return <span style={{ color }}>{sym} {label}</span>;
}

function DiagBox({ title, lines }) {
  return (
    <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{title}</div>
      {lines.map((l, i) => <div key={i} style={{ fontFamily: "'Fira Code', monospace", fontSize: 10.5, color: String(l).includes('⚠') ? 'var(--amber)' : 'var(--t1)' }}>{l}</div>)}
    </div>
  );
}

function SizeWarning({ markets }) {
  const groups = conventionsForMarkets(markets);
  if (groups.length === 0) return null;
  const mixed = hasMixedConventions(markets);
  return (
    <div style={{ marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 11px', borderRadius: 8, background: mixed ? 'rgba(244,63,94,0.08)' : 'rgba(232,184,75,0.08)', border: '1px solid ' + (mixed ? 'rgba(244,63,94,0.3)' : 'rgba(232,184,75,0.3)') }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}><Warn size={12} /></span>
      <div style={{ fontSize: 10.5, lineHeight: 1.6 }}>
        <span style={{ fontWeight: 700, color: mixed ? 'var(--red)' : 'var(--gold)' }}>{mixed ? 'Mixed conventions — check each market:' : 'Market conventions:'}</span>
        <div style={{ marginTop: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {groups.map((g, i) => (
            <div key={i} style={{ color: 'var(--t1)', fontFamily: "'Fira Code', monospace" }}>
              <span style={{ fontWeight: 700, color: 'var(--brand)' }}>{g.markets.join('/')}</span> → {g.shoe} sizes · {g.unit} · <span style={{ color: 'var(--t2)' }}>{g.lang}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GuidanceInfo({ storeId, initial }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initial || '');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const has = (text || '').trim().length > 0;

  async function save() {
    setSaving(true); setSaved(false);
    try { await api.patch(`/api/stores/${storeId}`, { listing_guidance: text }); setSaved(true); setTimeout(() => setSaved(false), 1500); }
    catch (e) {} finally { setSaving(false); }
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button onClick={() => setOpen(o => !o)} title="Listing guidance for this store"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: has ? 'var(--gold)' : 'var(--t3)', background: has ? 'rgba(232,184,75,0.12)' : 'var(--s2)', border: '1px solid ' + (has ? 'rgba(232,184,75,0.35)' : 'var(--b2)'), borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        Info{has ? ' •' : ''}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 30, width: 300, background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 10, padding: 12, boxShadow: '0 8px 30px -8px rgba(0,0,0,0.4)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Listing guidance (saved on store)</div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="e.g. sizes run large — advise 1 size down; exclude Northern Ireland; avoid the word 'cheap'…"
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 11.5, padding: '8px 10px', borderRadius: 7, border: '1px solid var(--b2)', background: 'var(--s2)', color: 'var(--t1)', resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button onClick={() => setOpen(false)} style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 6, padding: '5px 11px', cursor: 'pointer' }}>Close</button>
            <button onClick={save} disabled={saving} style={{ fontSize: 11, fontWeight: 700, color: saved ? 'var(--green)' : '#fff', background: saved ? 'var(--green-bg)' : 'linear-gradient(135deg, #818CF8, #6366F1)', border: 'none', borderRadius: 6, padding: '5px 11px', cursor: 'pointer' }}>{saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}</button>
          </div>
        </div>
      )}
    </span>
  );
}

function StoreVAControls({ batchId, bs, onProgress }) {
  const [checked, setChecked] = useState(!!bs.va_checked);
  const [checkedAt, setCheckedAt] = useState(bs.va_checked_at || null);
  const [note, setNote] = useState(bs.va_note || '');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !checked;
    setBusy(true);
    try {
      const r = await api.patch(`/api/batches/${batchId}/stores/${bs.id}/check`, { checked: next });
      setChecked(r.store.va_checked);
      setCheckedAt(r.store.va_checked_at);
      if (r.progress && onProgress) onProgress(r.progress);
    } catch (e) { /* keep UI state */ } finally { setBusy(false); }
  }

  async function saveNote() {
    setSavingNote(true); setNoteSaved(false);
    try { await api.patch(`/api/batches/${batchId}/stores/${bs.id}/note`, { note }); setNoteSaved(true); setTimeout(() => setNoteSaved(false), 1500); }
    catch (e) { /* noop */ } finally { setSavingNote(false); }
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--b1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={toggle} disabled={busy}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: checked ? '#fff' : 'var(--t2)', background: checked ? 'linear-gradient(135deg, #34D399, #10B981)' : 'var(--s2)', border: '1px solid ' + (checked ? 'transparent' : 'var(--b2)'), borderRadius: 8, padding: '7px 13px', cursor: busy ? 'default' : 'pointer' }}>
          <span style={{ width: 16, height: 16, borderRadius: 4, border: '2px solid ' + (checked ? '#fff' : 'var(--t3)'), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{checked ? '✓' : ''}</span>
          {checked ? 'Checked by VA' : 'Mark as checked'}
        </button>
        {checked && checkedAt && (
          <span style={{ fontSize: 10.5, color: 'var(--t3)', fontFamily: "'Fira Code', monospace" }}>
            {new Date(checkedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="VA note for this store (e.g. 12 products had image errors)…"
          rows={2} style={{ width: '100%', boxSizing: 'border-box', fontSize: 11.5, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--b2)', background: 'var(--s2)', color: 'var(--t1)', resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button onClick={saveNote} disabled={savingNote}
            style={{ fontSize: 11, fontWeight: 700, color: noteSaved ? 'var(--green)' : 'var(--brand)', background: noteSaved ? 'var(--green-bg)' : 'var(--brand-l)', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>
            {savingNote ? 'Saving…' : noteSaved ? '✓ Saved' : 'Save note'}
          </button>
        </div>
      </div>
    </div>
  );
}

function GoLivePanel({ batch }) {
  const [date, setDate] = useState(batch.go_live_date || '');
  const [auto, setAuto] = useState(batch.auto_publish !== false);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const published = !!batch.published_at;

  async function save(nextDate, nextAuto) {
    setSaved(false);
    try { await api.patch(`/api/batches/${batch.id}`, { go_live_date: nextDate || null, auto_publish: nextAuto }); setSaved(true); setTimeout(() => setSaved(false), 1500); } catch (e) {}
  }
  async function loadPreview() {
    setLoadingPreview(true);
    try { setPreview(await api.get(`/api/batches/${batch.id}/publish-preview`)); } catch (e) { setPreview({ error: e.message }); } finally { setLoadingPreview(false); }
  }
  async function publishNow() {
    if (!confirm('Publish all draft products with this batch\'s tag to LIVE now, across all stores?')) return;
    setPublishing(true);
    try { setPublishResult(await api.post(`/api/batches/${batch.id}/publish`, {})); } catch (e) { setPublishResult({ error: e.message }); } finally { setPublishing(false); }
  }

  return (
    <div style={{ background: 'var(--s1)', border: '1px solid ' + (published ? 'rgba(16,185,129,0.4)' : 'var(--b1)'), borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke={published ? '#10B981' : 'var(--brand)'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Go-live scheduling</span>
        {published && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: '#10B981', borderRadius: 5, padding: '2px 8px' }}>Published {new Date(batch.published_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</span>}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Go-live date (all stores)</div>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); save(e.target.value, auto); }}
            style={{ fontSize: 12, fontFamily: "'Fira Code', monospace", padding: '7px 10px', borderRadius: 7, background: 'var(--s2)', border: '1px solid var(--b2)', color: 'var(--t1)' }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: 'var(--t1)', paddingBottom: 7 }}>
          <input type="checkbox" checked={auto} onChange={e => { setAuto(e.target.checked); save(date, e.target.checked); }} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          Auto-publish on that date
        </label>
        {saved && <span style={{ fontSize: 10.5, color: 'var(--green)', paddingBottom: 9 }}>✓ Saved</span>}
      </div>

      {date && auto && !published && (
        <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 10 }}>
          BatchIQ will automatically set all draft products with this tag to live on <b style={{ color: 'var(--brand)' }}>{date}</b>, across every store in this batch.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button onClick={loadPreview} disabled={loadingPreview}
          style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--t2)', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '7px 13px', cursor: 'pointer' }}>
          {loadingPreview ? 'Checking…' : 'Preview — how many will go live'}
        </button>
        <button onClick={publishNow} disabled={publishing}
          style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #34D399, #10B981)', border: 'none', borderRadius: 8, padding: '7px 13px', cursor: publishing ? 'default' : 'pointer', opacity: publishing ? 0.7 : 1 }}>
          {publishing ? 'Publishing…' : 'Publish now'}
        </button>
      </div>

      {preview && (
        <div style={{ marginTop: 12, border: '1px solid var(--b1)', borderRadius: 9, overflow: 'hidden' }}>
          {preview.error ? <div style={{ padding: 10, fontSize: 11, color: 'var(--red)' }}>{preview.error}</div> : (
            <>
              <div style={{ padding: '8px 12px', background: 'var(--s2)', fontSize: 11.5, fontWeight: 700, color: 'var(--t1)' }}>
                {preview.total_draft} draft product(s) will go live across {preview.stores.length} store(s)
              </div>
              {preview.stores.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', borderTop: '1px solid var(--b1)', fontSize: 11 }}>
                  <span style={{ color: 'var(--t1)', fontWeight: 600 }}>{s.store}</span>
                  <span style={{ fontFamily: "'Fira Code', monospace", color: s.error ? 'var(--amber)' : 'var(--t2)' }}>{s.error ? `⚠ ${s.error}` : `${s.draft_count} draft`}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {publishResult && (
        <div style={{ marginTop: 12, border: '1px solid var(--b1)', borderRadius: 9, padding: 10, fontSize: 11.5 }}>
          {publishResult.error ? <span style={{ color: 'var(--red)' }}>{publishResult.error}</span> : (
            <>
              <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 5 }}>✓ Published {publishResult.total_published} product(s) live</div>
              {(publishResult.results || []).map((r, i) => (
                <div key={i} style={{ fontFamily: "'Fira Code', monospace", fontSize: 10.5, color: r.error ? 'var(--amber)' : 'var(--t2)' }}>
                  {r.error ? `⚠ ${r.store}: ${r.error}` : `${r.store}: ${r.published} live${r.note ? ' — ' + r.note : ''}`}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function BatchRichContent({ batch, range, onRangeChange, onSyncStore, syncingStoreId }) {
  const [diag, setDiag] = useState(null);
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState(null);

  // VA review state
  const initialStores = batch?.biq_batch_stores || [];
  const initialDone = initialStores.filter(s => s.va_checked).length;
  const [vaProgress, setVaProgress] = useState({ done: initialDone, total: initialStores.length, all_checked: initialStores.length > 0 && initialDone === initialStores.length });
  const [generalNote, setGeneralNote] = useState(batch?.va_general_note || '');
  const [genSaved, setGenSaved] = useState(false);
  const [summary, setSummary] = useState(batch?.va_note_summary || '');
  const [summarizing, setSummarizing] = useState(false);

  if (!batch) return null;

  async function saveGeneralNote() {
    setGenSaved(false);
    try { await api.patch(`/api/batches/${batch.id}/note`, { note: generalNote }); setGenSaved(true); setTimeout(() => setGenSaved(false), 1500); } catch (e) {}
  }
  async function summarizeNotes() {
    setSummarizing(true);
    try { const r = await api.post(`/api/batches/${batch.id}/summarize-notes`, {}); setSummary(r.summary || ''); } catch (e) { setSummary('Could not summarize: ' + e.message); } finally { setSummarizing(false); }
  }

  async function pushLabels() {
    setPushing(true); setPushResult(null);
    try { setPushResult(await api.post(`/api/google-ads/push-labels/${batch.id}`, {})); }
    catch (e) { setPushResult({ label: '—', results: [{ store: 'Error', error: e.message }] }); }
    finally { setPushing(false); }
  }

  async function loadDiag() {
    setDiagOpen(o => !o);
    if (diag) return;
    setDiagLoading(true);
    try { setDiag(await api.get(`/api/batches/${batch.id}/diagnostics`)); }
    catch (e) { setDiag({ error: e.message }); }
    finally { setDiagLoading(false); }
  }

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
      {/* Diagnostics + Push labels toggle */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={loadDiag}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: diagOpen ? '#fff' : 'var(--t2)', background: diagOpen ? 'var(--brand)' : 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          Diagnostics {diag && diag.total_issues != null ? `(${diag.total_issues} issues)` : ''}
        </button>
        <button onClick={pushLabels} disabled={pushing}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #34D399, #10B981)', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: pushing ? 'default' : 'pointer', opacity: pushing ? 0.7 : 1 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {pushing ? 'Pushing labels…' : 'Push labels to Google'}
        </button>
      </div>

      {pushResult && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 10, padding: 12, fontSize: 11.5 }}>
          <div style={{ fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>Label push: {pushResult.label}</div>
          {(pushResult.results || []).map((r, i) => (
            <div key={i} style={{ marginBottom: 4, color: r.error ? 'var(--amber)' : 'var(--green)', fontFamily: "'Fira Code', monospace", fontSize: 10.5 }}>
              {r.error ? `⚠ ${r.store}: ${r.error}` : `✓ ${r.store}: ${r.updated}/${r.matched_products} products labeled`}
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: 'var(--t3)', marginTop: 6 }}>Allow 24-48h for Google to process, then sync — spend will track by label.</div>
        </div>
      )}

      {diagOpen && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 12, padding: 16 }}>
          {diagLoading ? (
            <div style={{ fontSize: 12, color: 'var(--t3)', fontFamily: "'Fira Code', monospace" }}>Running diagnostics…</div>
          ) : diag?.error ? (
            <div style={{ fontSize: 12, color: 'var(--red)' }}>{diag.error}</div>
          ) : diag ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: diag.total_issues > 0 ? 'var(--amber)' : 'var(--green)' }}>
                {diag.total_issues > 0 ? `${diag.total_issues} issue(s) found across ${diag.store_count} store(s)` : `All ${diag.store_count} store(s) healthy`}
              </div>
              {diag.stores.map((s, i) => (
                <div key={i} style={{ border: '1px solid var(--b1)', borderRadius: 10, padding: 12, fontSize: 11.5 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 8 }}>{s.store} <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 10, color: 'var(--t3)' }}>{s.shop_domain}</span></div>

                  {/* Integration status */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8, fontFamily: "'Fira Code', monospace", fontSize: 10.5 }}>
                    <DiagFlag ok={s.integration.shopify_ok} label="Shopify" />
                    <DiagFlag ok={s.integration.gads_connected} label="GAds connected" />
                    <DiagFlag ok={!!s.integration.gads_account} label="GAds account" />
                    <DiagFlag ok={s.integration.gads_ok} label="GAds query" />
                  </div>

                  {/* Data presence grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 8 }}>
                    <DiagBox title="Products" lines={[`${s.products.total} total`, `${s.products.active}A / ${s.products.draft}D / ${s.products.archived}Ar`]} />
                    <DiagBox title="Store markets" lines={[s.store_markets.length ? s.store_markets.join(', ') : '⚠ none']} />
                    <DiagBox title="Shopify perf" lines={[`${s.shopify_performance.days_with_data} days`, `€${s.shopify_performance.total_revenue} rev`, s.shopify_performance.date_range || '—']} />
                    <DiagBox title="Ad spend" lines={[`${s.ad_spend.rows} rows`, `€${s.ad_spend.total_spend}`, `${s.ad_spend.total_impressions} impr`, `mkts: ${s.ad_spend.markets.join(', ') || '—'}`]} />
                    <DiagBox title="Market revenue" lines={[`${s.market_revenue.rows} rows`, `mkts: ${s.market_revenue.markets.join(', ') || '—'}`]} />
                  </div>

                  {/* Issues */}
                  {s.issues.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {s.issues.map((iss, j) => (
                        <div key={j} style={{ fontSize: 11, color: 'var(--amber)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <span style={{ flexShrink: 0 }}>⚠</span> {iss}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--green)' }}>✓ No issues — all data present</div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

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

      {/* VA review section: main (auto) checkmark + progress + notes */}
      <div style={{ background: 'var(--s1)', border: '1px solid ' + (vaProgress.all_checked ? 'rgba(16,185,129,0.4)' : 'var(--b1)'), borderRadius: 12, padding: 16, boxShadow: vaProgress.all_checked ? '0 0 0 1px rgba(16,185,129,0.15)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            {/* Main checkmark — DISABLED, auto-driven by per-store checks */}
            <span title="Auto-checks when every store is checked" style={{ width: 26, height: 26, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: vaProgress.all_checked ? '#fff' : 'var(--t3)', background: vaProgress.all_checked ? 'linear-gradient(135deg, #34D399, #10B981)' : 'var(--s3)', border: '2px solid ' + (vaProgress.all_checked ? 'transparent' : 'var(--b2)'), cursor: 'not-allowed', opacity: vaProgress.all_checked ? 1 : 0.85 }}>
              {vaProgress.all_checked ? '✓' : ''}
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{vaProgress.all_checked ? 'All stores checked' : 'Product check'}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>{vaProgress.all_checked ? 'Every store reviewed by a VA' : 'Main check completes automatically when all stores are checked'}</div>
            </div>
          </div>
          {/* Progress badge X/Y done */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 90, height: 7, borderRadius: 4, background: 'var(--s3)', overflow: 'hidden' }}>
              <div style={{ width: `${vaProgress.total ? (vaProgress.done / vaProgress.total) * 100 : 0}%`, height: '100%', background: vaProgress.all_checked ? '#10B981' : 'var(--brand)', transition: 'width 0.2s' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "'Fira Code', monospace", color: vaProgress.all_checked ? 'var(--green)' : 'var(--t1)' }}>{vaProgress.done}/{vaProgress.total} done</span>
          </div>
        </div>

        {/* General note + AI summary */}
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>General note (whole batch)</div>
            <textarea value={generalNote} onChange={e => setGeneralNote(e.target.value)} onBlur={saveGeneralNote} placeholder="Optional note that applies to the whole batch…"
              rows={3} style={{ width: '100%', boxSizing: 'border-box', fontSize: 11.5, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--b2)', background: 'var(--s2)', color: 'var(--t1)', resize: 'vertical', fontFamily: 'inherit' }} />
            {genSaved && <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 3 }}>✓ Saved</div>}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI summary of store notes</div>
              <button onClick={summarizeNotes} disabled={summarizing}
                style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #818CF8, #6366F1)', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: summarizing ? 'default' : 'pointer', opacity: summarizing ? 0.7 : 1 }}>
                {summarizing ? 'Summarizing…' : '✨ Summarize'}
              </button>
            </div>
            <div style={{ fontSize: 11.5, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--b2)', background: 'var(--s2)', color: summary ? 'var(--t1)' : 'var(--t3)', minHeight: 62, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {summary || 'Click Summarize to combine all per-store notes into one overview.'}
            </div>
          </div>
        </div>

        {/* Scrollable per-store notes */}
        {(batch.biq_batch_stores || []).some(s => s.va_note) && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Per-store notes</div>
            <div style={{ maxHeight: 130, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4 }}>
              {(batch.biq_batch_stores || []).filter(s => s.va_note).map(s => (
                <div key={s.id} style={{ fontSize: 11, padding: '6px 9px', borderRadius: 7, background: 'var(--s2)', border: '1px solid var(--b1)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--brand)' }}>{s.biq_stores?.name}:</span> <span style={{ color: 'var(--t2)' }}>{s.va_note}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Go-live scheduling */}
      <GoLivePanel batch={batch} />

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
                  <GuidanceInfo storeId={bs.biq_stores?.id} initial={bs.biq_stores?.listing_guidance} />
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

            <SizeWarning markets={markets} />

            <MarketDropdown markets={bs.marketRows || []} batchOverlap={batchOverlap} />

            <StoreVAControls batchId={batch.id} bs={bs} onProgress={setVaProgress} />

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
