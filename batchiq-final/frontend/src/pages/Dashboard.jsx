import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtCurrency, fmtDate } from '../api.js';

const SOURCES = ['AliExpress spy', 'Competitor store', 'TikTok trend', 'Google Trends', 'Manual research', 'Supplier suggestion', 'Other'];
const CHANGE_OPTIONS = ['Pricing changed', 'Only branding changed', 'Used own template', 'Added creatives', 'Changed all creatives', 'Nothing changed'];
const DATE_RANGES = [
  { key: '7', label: '7 days' }, { key: '14', label: '14 days' },
  { key: '30', label: '30 days' }, { key: '60', label: '60 days' }, { key: 'all', label: 'All time' },
];
const SORT_OPTIONS = [
  { key: 'revenue', label: 'Revenue' }, { key: 'roas', label: 'ROAS' },
  { key: 'orders', label: 'Orders' }, { key: 'recent', label: 'Newest' },
];

// ═══ Shared UI ═══════════════════════════════════════════════════════════════
function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{children}</div>;
}

function Spinner({ size = 14, color = 'currentColor' }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', display: 'inline-block',
      border: `2px solid ${color}`, borderTopColor: 'transparent',
      animation: 'spin 0.6s linear infinite', flexShrink: 0,
    }} />
  );
}

function Btn({ children, onClick, disabled, variant = 'ghost', size = 'md', loading }) {
  const variants = {
    primary: { background: 'linear-gradient(135deg, #818CF8, #6366F1)', color: '#fff', border: 'none', boxShadow: 'var(--sh-brand)', fontWeight: 700 },
    ghost:   { background: 'var(--s1)', color: 'var(--t1)', border: '1px solid var(--b2)', fontWeight: 600 },
    subtle:  { background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--b1)', fontWeight: 600 },
    danger:  { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)', fontWeight: 600 },
  };
  const sizes = { md: { padding: '9px 16px', fontSize: 13 }, sm: { padding: '6px 12px', fontSize: 12 } };
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      borderRadius: 9, cursor: (disabled || loading) ? 'not-allowed' : 'pointer', opacity: (disabled || loading) ? 0.7 : 1,
      transition: 'transform 0.1s, box-shadow 0.15s, background 0.15s', display: 'inline-flex', alignItems: 'center', gap: 7,
      ...variants[variant], ...sizes[size],
    }}
      onMouseEnter={e => { if (!disabled && !loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}>
      {loading && <Spinner size={size === 'sm' ? 12 : 14} />}
      {children}
    </button>
  );
}

function TagChip({ tag }) {
  return <span style={{ display: 'inline-block', fontFamily: "'Fira Code', monospace", fontSize: 11, fontWeight: 600, color: 'var(--brand)', background: 'var(--brand-l)', border: '1px solid transparent', borderRadius: 5, padding: '2px 8px', whiteSpace: 'nowrap' }}>{tag}</span>;
}

function StageBadge({ stage }) {
  const map = {
    draft:       { label: 'Draft',       color: 'var(--t3)',    bg: 'var(--s3)' },
    in_progress: { label: 'In Progress', color: 'var(--amber)', bg: 'var(--amber-bg)' },
    live:        { label: 'Live',        color: 'var(--green)', bg: 'var(--green-bg)' },
  };
  const s = map[stage] || map.draft;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: s.color, background: s.bg, border: '1px solid ' + s.color + '44', borderRadius: 5, padding: '2px 8px' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, boxShadow: stage === 'live' ? `0 0 6px ${s.color}` : 'none' }} />
      {s.label}
    </span>
  );
}

function StatusDot({ status }) {
  const map = { active: { color: 'var(--green)', label: 'Active' }, paused: { color: 'var(--amber)', label: 'Paused' }, archived: { color: 'var(--t3)', label: 'Archived' } };
  const s = map[status] || map.archived;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, boxShadow: status === 'active' ? `0 0 6px ${s.color}` : 'none' }} />
      <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600 }}>{s.label}</span>
    </span>
  );
}

function RankBadge({ rank }) {
  const styles = {
    1: { bg: 'linear-gradient(135deg, #FCD34D, #F0B429)', fg: '#7A5A00', sh: '0 2px 8px rgba(240,180,41,0.4)' },
    2: { bg: 'linear-gradient(135deg, #E2E8F0, #94A3B8)', fg: '#334155', sh: '0 2px 8px rgba(148,163,184,0.3)' },
    3: { bg: 'linear-gradient(135deg, #E0A877, #C2855A)', fg: '#5A3A1A', sh: '0 2px 8px rgba(194,133,90,0.3)' },
  };
  const s = styles[rank];
  if (s) return <div style={{ width: 24, height: 24, borderRadius: 7, background: s.bg, color: s.fg, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: s.sh }}>{rank}</div>;
  return <div style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--s3)', color: 'var(--t3)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{rank}</div>;
}

function Checkbox({ checked, onChange, indeterminate }) {
  const ref = useRef();
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate || false; }, [indeterminate]);
  return (
    <div onClick={(e) => { e.stopPropagation(); onChange(); }} style={{
      width: 18, height: 18, borderRadius: 5, cursor: 'pointer', flexShrink: 0,
      border: '1.5px solid ' + (checked || indeterminate ? 'var(--brand)' : 'var(--b3)'),
      background: checked || indeterminate ? 'var(--brand)' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s',
    }}>
      {checked && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5L4.5 8L9 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      {indeterminate && !checked && <div style={{ width: 8, height: 2, background: '#fff', borderRadius: 1 }} />}
    </div>
  );
}

// Dropdown menu — fully isolated from row navigation
function ActionMenu({ batch, onAction }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const items = [
    { key: 'edit', label: 'Edit', color: 'var(--t1)' },
    { key: 'open', label: 'Open details', color: 'var(--t1)' },
    batch.status !== 'active'   && { key: 'active',   label: 'Set active', color: 'var(--green)', divider: true },
    batch.status !== 'paused'   && { key: 'paused',   label: 'Pause',      color: 'var(--amber)' },
    batch.status !== 'archived' && { key: 'archived', label: 'Archive',    color: 'var(--t2)' },
    { key: 'delete', label: 'Delete', color: 'var(--red)', divider: true },
  ].filter(Boolean);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }} style={{
        width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: open ? 'var(--t1)' : 'var(--t3)', background: open ? 'var(--s3)' : 'transparent',
        border: '1px solid ' + (open ? 'var(--b2)' : 'transparent'), transition: 'all 0.1s', cursor: 'pointer',
      }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--s3)'; e.currentTarget.style.color = 'var(--t1)'; }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t3)'; } }}>
        <svg width="16" height="16" viewBox="0 0 15 15" fill="currentColor"><circle cx="7.5" cy="3" r="1.4"/><circle cx="7.5" cy="7.5" r="1.4"/><circle cx="7.5" cy="12" r="1.4"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 34, zIndex: 60, minWidth: 160, background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 11, boxShadow: 'var(--sh-lg)', padding: 5, animation: 'fadeIn 0.12s ease' }}>
          {items.map(it => (
            <div key={it.key}>
              {it.divider && <div style={{ height: 1, background: 'var(--b1)', margin: '5px 0' }} />}
              <button onClick={(e) => { e.stopPropagation(); setOpen(false); onAction(it.key); }} style={{
                width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, color: it.color, background: 'transparent', cursor: 'pointer', transition: 'background 0.1s',
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

// ═══ Batch form modal (shared by Create + Edit) ═══════════════════════════════
function BatchModal({ mode, batch, onClose, onSaved }) {
  const isEdit = mode === 'edit';
  // If an existing source is stored as "Other: xyz", split it back into the dropdown + text
  const _srcRaw = batch?.source || '';
  const _isOther = _srcRaw.startsWith('Other:');
  const [form, setForm] = useState({
    name: batch?.name || '', batch_tag: batch?.batch_tag || '',
    source: _isOther ? 'Other' : _srcRaw,
    source_other: _isOther ? _srcRaw.replace(/^Other:\s*/, '') : '',
    thesis: batch?.thesis || '', validation_notes: batch?.validation_notes || '',
    tags: (batch?.tags || []).join(', '), changes_note: batch?.changes_note || '',
    start_date: batch?.start_date || '',
    stage: batch?.stage || 'draft',
  });
  const [subTags, setSubTags] = useState(batch?.sub_tags || []);
  const [nameIsTag, setNameIsTag] = useState(isEdit ? !batch?.batch_tag : true);
  const [changes, setChanges] = useState(batch?.changes || []);
  const [suggestion, setSuggestion] = useState(null);
  const [stores, setStores] = useState([]);
  const [storeLinks, setStoreLinks] = useState({}); // { store_id: { selected, shopify_tag } }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    api.get('/api/stores').then(setStores).catch(() => {});
    if (isEdit) return;
    api.get('/api/batches/suggest-name').then(d => {
      setSuggestion(d);
      if (d.suggested_name || d.suggested_tag) setForm(f => ({ ...f, name: d.suggested_name || f.name, batch_tag: d.suggested_tag || f.batch_tag }));
    }).catch(() => {});
  }, []);

  function toggleStore(id) {
    setStoreLinks(prev => {
      const cur = prev[id] || { selected: false, shopify_tag: '' };
      return { ...prev, [id]: { ...cur, selected: !cur.selected } };
    });
  }
  function setStoreTag(id, tag) {
    setStoreLinks(prev => ({ ...prev, [id]: { ...(prev[id] || { selected: true }), selected: true, shopify_tag: tag } }));
  }

  const toggleChange = (o) => setChanges(p => p.includes(o) ? p.filter(c => c !== o) : [...p, o]);
  const addSub = () => setSubTags(p => [...p, { tag: '', description: '' }]);
  const updSub = (i, f, v) => setSubTags(p => p.map((s, idx) => idx === i ? { ...s, [f]: v } : s));
  const rmSub = (i) => setSubTags(p => p.filter((_, idx) => idx !== i));

  async function submit() {
    if (!form.name.trim()) { setError('Batch name is required.'); return; }
    if (form.source === 'Other' && !form.source_other.trim()) { setError('You selected "Other" as source — please specify it.'); return; }
    setLoading(true); setError(null);
    try {
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      const sub = subTags.filter(s => s.tag.trim()).map(s => ({ tag: s.tag.trim(), description: s.description.trim() }));
      // Fold "Other" free-text into the saved source value
      const effectiveSource = form.source === 'Other' ? `Other: ${form.source_other.trim()}` : form.source;
      const batchTag = nameIsTag ? null : (form.batch_tag.trim() || null);
      const payload = { ...form, source: effectiveSource, batch_tag: batchTag, tags, sub_tags: sub, changes };
      delete payload.source_other;
      // On create, attach selected stores
      if (!isEdit) {
        payload.store_links = Object.entries(storeLinks)
          .filter(([, v]) => v.selected)
          .map(([store_id, v]) => ({ store_id, shopify_tag: v.shopify_tag?.trim() || null }));
      }
      const saved = isEdit
        ? await api.patch(`/api/batches/${batch.id}`, payload)
        : await api.post('/api/batches', payload);
      onSaved(saved); onClose();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,35,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, width: 580, boxShadow: 'var(--sh-xl)', maxHeight: '92vh', overflowY: 'auto', animation: 'slideUp 0.2s ease' }}>
        <div style={{ padding: '22px 26px', borderBottom: '1px solid var(--b1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: 'var(--s1)', borderRadius: '16px 16px 0 0', zIndex: 2 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.01em' }}>{isEdit ? 'Edit Batch' : 'New Batch'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--t2)', marginTop: 3 }}>{isEdit ? 'Update this batch\u2019s details.' : 'Document a product group so you can track its performance.'}</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, color: 'var(--t3)', background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {error && <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 9, padding: '10px 14px', fontSize: 12.5, color: 'var(--red)', fontWeight: 600 }}>{error}</div>}

          <div>
            <Label>Batch name</Label>
            <input placeholder="e.g. BATCH5-VIVL" value={form.name} onChange={set('name')} />
          </div>

          {/* Toggle: batch name IS the Shopify tag */}
          <div style={{ marginTop: -8 }}>
            <button
              onClick={() => setNameIsTag(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                background: 'none', border: 'none', padding: 0, textAlign: 'left',
              }}
            >
              <span style={{
                width: 38, height: 22, borderRadius: 999, flexShrink: 0,
                background: nameIsTag ? 'linear-gradient(135deg, #818CF8, #6366F1)' : 'var(--b2)',
                position: 'relative', transition: 'background 0.15s', boxShadow: nameIsTag ? 'var(--sh-brand)' : 'none',
              }}>
                <span style={{
                  position: 'absolute', top: 2, left: nameIsTag ? 18 : 2,
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--t1)' }}>
                The batch name is also the Shopify tag
              </span>
            </button>
            {!nameIsTag && (
              <div style={{ marginTop: 10 }}>
                <Label>Shopify tag</Label>
                <input placeholder="custom tag on the products" value={form.batch_tag} onChange={set('batch_tag')} style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }} />
                <div style={{ fontSize: 10.5, color: 'var(--t3)', marginTop: 4 }}>
                  Use this when the products are tagged differently from the batch name.
                </div>
              </div>
            )}
          </div>

          {!isEdit && suggestion?.last_name && (
            <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: -10 }}>Last: <span style={{ fontFamily: "'Fira Code', monospace", color: 'var(--t2)' }}>{suggestion.last_name}</span>{suggestion.suggested_name && <> · next: <span style={{ fontFamily: "'Fira Code', monospace", color: 'var(--brand)', fontWeight: 600 }}>{suggestion.suggested_name}</span></>}</div>
          )}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Label>Extra tags <span style={{ color: 'var(--t4)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>— other tags used for these products</span></Label>
              <button onClick={addSub} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand)', padding: '3px 10px', borderRadius: 6, border: '1px solid var(--brand-l)', background: 'var(--brand-l)', cursor: 'pointer' }}>+ Add tag</button>
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

          <div>
            <Label>What did you change on the products?</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 9 }}>
              {CHANGE_OPTIONS.map(o => {
                const a = changes.includes(o);
                return <button key={o} onClick={() => toggleChange(o)} style={{ fontSize: 11.5, fontWeight: 600, padding: '6px 12px', borderRadius: 7, cursor: 'pointer', transition: 'all 0.12s', background: a ? 'var(--brand)' : 'var(--s2)', color: a ? '#fff' : 'var(--t2)', border: '1px solid ' + (a ? 'var(--brand)' : 'var(--b2)'), boxShadow: a ? 'var(--sh-brand)' : 'none' }}>{o}</button>;
              })}
            </div>
            <input placeholder="Or describe something else…" value={form.changes_note} onChange={set('changes_note')} />
          </div>

          <div>
            <Label>Source</Label>
            <select value={form.source} onChange={set('source')}>
              <option value="">Where did you find these?</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {form.source === 'Other' && (
              <input
                style={{ marginTop: 8 }}
                placeholder="Specify the source…"
                value={form.source_other}
                onChange={set('source_other')}
                autoFocus
              />
            )}
          </div>
          <div>
            <Label>Start date <span style={{ fontWeight: 400, color: 'var(--t3)' }}>(when these products went live)</span></Label>
            <input type="date" value={form.start_date || ''} onChange={set('start_date')} style={{ fontFamily: "'Fira Code', monospace" }} />
          </div>
          <div>
            <Label>Stage</Label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { v: 'draft', label: 'Draft', color: 'var(--t3)' },
                { v: 'in_progress', label: 'In Progress', color: 'var(--amber)' },
                { v: 'live', label: 'Live', color: 'var(--green)' },
              ].map(opt => {
                const on = form.stage === opt.v;
                return (
                  <button key={opt.v} type="button" onClick={() => setForm(f => ({ ...f, stage: opt.v }))}
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                      fontSize: 12, fontWeight: 700,
                      border: '1px solid ' + (on ? opt.color : 'var(--b2)'),
                      background: on ? opt.color : 'var(--s1)',
                      color: on ? '#fff' : 'var(--t2)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'all 0.12s',
                    }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: on ? '#fff' : opt.color }} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div><Label>Thesis</Label><textarea rows={2} placeholder="Why you think this will perform." value={form.thesis} onChange={set('thesis')} style={{ resize: 'vertical' }} /></div>
          <div><Label>Validation</Label><textarea rows={2} placeholder="Social proof, competitor signals, trends." value={form.validation_notes} onChange={set('validation_notes')} style={{ resize: 'vertical' }} /></div>
          <div><Label>Labels (comma-separated)</Label><input placeholder="summer, impulse-buy, fashion" value={form.tags} onChange={set('tags')} /></div>

          {/* Store selection — only when creating */}
          {!isEdit && (
            <div>
              <Label>Push to stores <span style={{ color: 'var(--t4)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>— select where this batch goes</span></Label>
              {stores.length === 0 ? (
                <div style={{ fontSize: 11.5, color: 'var(--t3)', fontStyle: 'italic' }}>No stores connected yet. Add them on the Stores page.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {stores.map(s => {
                    const link = storeLinks[s.id] || {};
                    return (
                      <div key={s.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', borderRadius: 9,
                        background: link.selected ? 'var(--brand-l)' : 'var(--s2)',
                        border: '1px solid ' + (link.selected ? 'var(--brand)' : 'var(--b1)'), transition: 'all 0.12s',
                      }}>
                        <div onClick={() => toggleStore(s.id)} style={{
                          width: 18, height: 18, borderRadius: 5, cursor: 'pointer', flexShrink: 0,
                          border: '1.5px solid ' + (link.selected ? 'var(--brand)' : 'var(--b3)'),
                          background: link.selected ? 'var(--brand)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {link.selected && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5L4.5 8L9 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <div onClick={() => toggleStore(s.id)} style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{s.name}</div>
                          {s.markets?.length > 0 && <div style={{ fontSize: 10.5, color: 'var(--t3)', fontFamily: "'Fira Code', monospace" }}>{s.markets.join(', ')}</div>}
                        </div>
                        {link.selected && (
                          <input
                            placeholder="sub-tag (optional)"
                            value={link.shopify_tag || ''}
                            onChange={e => setStoreTag(s.id, e.target.value)}
                            style={{ width: 150, fontFamily: "'Fira Code', monospace", fontSize: 11.5, padding: '6px 9px' }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 26px', borderTop: '1px solid var(--b1)', display: 'flex', gap: 10, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: 'var(--s1)', borderRadius: '0 0 16px 16px' }}>
          <Btn onClick={onClose} variant="ghost">Cancel</Btn>
          <Btn onClick={submit} disabled={loading} variant="primary">{loading ? 'Saving…' : isEdit ? 'Save changes' : 'Create Batch'}</Btn>
        </div>
      </div>
    </div>
  );
}

// ═══ Batch Row (no longer a Link) ═════════════════════════════════════════════
function BatchRow({ batch, rank, maxRevenue, selected, onSelect, onAction, expanded, onToggle, onSync, syncing }) {
  const [hover, setHover] = useState(false);
  const revenue = batch.totals?.revenue || 0;
  const orders = batch.totals?.orders || 0;
  const adSpend = batch.totals?.ad_spend || 0;
  const roas = adSpend > 0 ? (revenue / adSpend) : null;
  const barPct = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;
  const stores = batch.biq_batch_stores || [];
  const totalProducts = stores.reduce((s, bs) => s + (bs.product_count || 0), 0);

  return (
    <div style={{ borderBottom: '1px solid var(--b1)', background: selected ? 'var(--brand-l)' : expanded ? 'var(--s2)' : 'transparent', transition: 'background 0.12s' }}>
      {/* Main row */}
      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ display: 'grid', gridTemplateColumns: '38px 30px 38px 100px 1fr 110px 110px 56px 80px 90px 100px', alignItems: 'center', gap: 12, padding: '13px 20px', background: hover && !expanded && !selected ? 'var(--s2)' : 'transparent', transition: 'background 0.12s' }}>
        <Checkbox checked={selected} onChange={onSelect} />
        {/* Expand chevron */}
        <button onClick={onToggle} style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t2)', background: expanded ? 'var(--s3)' : 'transparent', cursor: 'pointer', transition: 'all 0.12s' }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}><path d="M4.5 2.5L8.5 6.5L4.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <RankBadge rank={rank} />
        <div>{batch.batch_tag ? <TagChip tag={batch.batch_tag} /> : <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 10.5, color: 'var(--t4)' }}>{batch.batch_code}</span>}</div>
        <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={onToggle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{batch.name}</div>
            <StageBadge stage={batch.stage} />
          </div>
          {batch.thesis && <div style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{batch.thesis}</div>}
        </div>
        <div style={{ textAlign: 'right', fontFamily: "'Fira Code', monospace", fontSize: 14, fontWeight: 600, color: revenue > 0 ? 'var(--t1)' : 'var(--t4)' }}>{fmtCurrency(revenue)}</div>
        <div style={{ textAlign: 'right', fontFamily: "'Fira Code', monospace", fontSize: 13, color: 'var(--t2)' }}>{orders} ord</div>
        <div style={{ textAlign: 'right', fontFamily: "'Fira Code', monospace", fontSize: 12.5, fontWeight: 600, color: roas ? (roas >= 2 ? 'var(--green)' : 'var(--amber)') : 'var(--t4)' }}>{roas ? `${roas.toFixed(1)}×` : '—'}</div>
        <div style={{ padding: '0 2px' }}>
          <div style={{ height: 5, background: 'var(--s3)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${barPct}%`, background: 'linear-gradient(90deg, #818CF8, #6366F1)', borderRadius: 3, transition: 'width 0.4s ease' }} />
          </div>
        </div>
        <div><StatusDot status={batch.status} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><ActionMenu batch={batch} onAction={onAction} /></div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div style={{ padding: '4px 20px 20px 68px', animation: 'fadeIn 0.15s ease' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 12, overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--b1)', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <Pill label="Stores" value={stores.length} />
                <Pill label="Products" value={totalProducts} accent="var(--brand)" />
                <Pill label="Revenue" value={fmtCurrency(revenue)} mono />
                <Pill label="Orders" value={orders} mono />
                {batch.source && <Pill label="Source" value={batch.source} />}
                {batch.start_date && <Pill label="Live since" value={fmtDate(batch.start_date)} />}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn onClick={() => onSync(batch)} loading={syncing} variant="primary" size="sm">{syncing ? 'Syncing…' : 'Sync now'}</Btn>
                <Btn onClick={() => onAction('edit')} variant="ghost" size="sm">Edit</Btn>
              </div>
            </div>

            {/* Metadata */}
            {(batch.thesis || batch.validation_notes || batch.changes?.length > 0) && (
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--b1)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {batch.thesis && <MetaLine label="Thesis" value={batch.thesis} />}
                {batch.validation_notes && <MetaLine label="Validation" value={batch.validation_notes} />}
                {batch.changes?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Changes</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {batch.changes.map(c => <span key={c} style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand)', background: 'var(--brand-l)', borderRadius: 5, padding: '2px 9px' }}>{c}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stores */}
            <div style={{ padding: '6px 0' }}>
              {stores.length === 0 ? (
                <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>No stores linked yet. Use Edit to link stores.</div>
              ) : (
                stores.map((bs, i) => {
                  const r = (bs.biq_performance_daily || []).reduce((s, p) => s + parseFloat(p.revenue || 0), 0);
                  const o = (bs.biq_performance_daily || []).reduce((s, p) => s + (p.orders || 0), 0);
                  const tag = bs.shopify_tag || batch.batch_tag;
                  return (
                    <div key={bs.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 90px 90px', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: i > 0 ? '1px solid var(--b1)' : 'none' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{bs.biq_stores?.name || '—'}</div>
                        {bs.notes && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{bs.notes}</div>}
                      </div>
                      <div>{tag ? <TagChip tag={tag} /> : <span style={{ fontSize: 11, color: 'var(--t3)' }}>no tag</span>}</div>
                      <div style={{ textAlign: 'right', fontFamily: "'Fira Code', monospace", fontSize: 12, color: 'var(--t2)' }}>{bs.product_count || 0} prod</div>
                      <div style={{ textAlign: 'right', fontFamily: "'Fira Code', monospace", fontSize: 13, fontWeight: 600, color: r > 0 ? 'var(--green)' : 'var(--t4)' }}>{fmtCurrency(r)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({ label, value, mono, accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: accent || 'var(--t1)', fontFamily: mono ? "'Fira Code', monospace" : 'inherit' }}>{value}</span>
    </div>
  );
}

function MetaLine({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

// ═══ Dashboard ════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editBatch, setEditBatch] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState('active');
  const [sortBy, setSortBy] = useState('revenue');
  const [range, setRange] = useState('30');
  const [selected, setSelected] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);
  const [syncingId, setSyncingId] = useState(null);

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

  async function syncOneBatch(batch) {
    setSyncingId(batch.id);
    try { await api.post(`/api/sync/batch/${batch.id}`, { days: 30 }); await load(); }
    catch (err) { setError(err.message); } finally { setSyncingId(null); }
  }

  async function applyAction(batch, action) {
    if (action === 'edit') { setEditBatch(batch); return; }
    if (action === 'open') { navigate(`/batches/${batch.id}`); return; }
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

  async function bulkAction(action) {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (action === 'delete' && !confirm(`Delete ${ids.length} batch(es)? This cannot be undone.`)) return;
    try {
      await Promise.all(ids.map(id =>
        action === 'delete'
          ? api.delete(`/api/batches/${id}?hard=true`)
          : api.patch(`/api/batches/${id}`, { status: action })
      ));
      if (action === 'delete') setBatches(p => p.filter(b => !selected.has(b.id)));
      else setBatches(p => p.map(b => selected.has(b.id) ? { ...b, status: action } : b));
      setSelected(new Set());
    } catch (err) { setError(err.message); }
  }

  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

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

  const allSelected = filtered.length > 0 && filtered.every(b => selected.has(b.id));
  const someSelected = filtered.some(b => selected.has(b.id)) && !allSelected;
  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map(b => b.id)));
  }

  return (
    <div>
      <div style={{ padding: '26px 32px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.025em' }}>Batches</h1>
            <p style={{ fontSize: 13, color: 'var(--t2)', marginTop: 3 }}>Ranked product groups across all your stores.</p>
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            <Btn onClick={handleSync} loading={syncing} variant="ghost">{syncing ? 'Syncing…' : 'Sync all'}</Btn>
            <Btn onClick={() => setShowCreate(true)} variant="primary">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              New Batch
            </Btn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
          <StatCard label="Active batches" value={activeCount} accent="var(--c-violet)"
            icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2.5" y="2.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="11.5" y="2.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="2.5" y="11.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="11.5" y="11.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6"/></svg>} />
          <StatCard label="Revenue" value={fmtCurrency(totalRevenue)} accent="var(--c-emerald)" mono
            icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2v16M6 5h6a2.5 2.5 0 0 1 0 5H7a2.5 2.5 0 0 0 0 5h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>} />
          <StatCard label="Orders" value={totalOrders} accent="var(--c-blue)" mono
            icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h2l1.5 9h8L16 7H5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="7.5" cy="16.5" r="1" fill="currentColor"/><circle cx="13.5" cy="16.5" r="1" fill="currentColor"/></svg>} />
          <StatCard label="Blended ROAS" value={blendedRoas ? `${blendedRoas.toFixed(2)}×` : '—'} accent="var(--c-amber)" mono
            icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 14l4-4 3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 6h4v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--s2)', borderRadius: 10, border: '1px solid var(--b1)' }}>
            {['active', 'paused', 'archived', 'all'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer', transition: 'all 0.12s', background: filter === f ? 'var(--s1)' : 'transparent', color: filter === f ? 'var(--t1)' : 'var(--t2)', boxShadow: filter === f ? 'var(--sh-sm)' : 'none' }}>{f}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rank by</span>
              <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--s2)', borderRadius: 9, border: '1px solid var(--b1)' }}>
                {SORT_OPTIONS.map(o => (
                  <button key={o.key} onClick={() => setSortBy(o.key)} style={{ padding: '5px 11px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s', background: sortBy === o.key ? 'var(--brand)' : 'transparent', color: sortBy === o.key ? '#fff' : 'var(--t2)' }}>{o.label}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--s2)', borderRadius: 9, border: '1px solid var(--b1)' }}>
              {DATE_RANGES.map(r => (
                <button key={r.key} onClick={() => setRange(r.key)} style={{ padding: '5px 11px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap', background: range === r.key ? 'var(--s1)' : 'transparent', color: range === r.key ? 'var(--t1)' : 'var(--t2)', boxShadow: range === r.key ? 'var(--sh-sm)' : 'none' }}>{r.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && <div style={{ margin: '0 32px 16px', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 9, padding: '11px 15px', fontSize: 12.5, color: 'var(--red)', fontWeight: 600 }}>{error}</div>}

      {/* Sync in progress banner */}
      {(syncing || syncingId) && (
        <div style={{ margin: '0 32px 16px', background: 'var(--brand-l)', border: '1px solid var(--brand)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, animation: 'fadeIn 0.15s ease' }}>
          <Spinner size={16} color="var(--brand)" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>Syncing with Shopify…</div>
            <div style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 1 }}>Fetching products and orders. This can take a moment — watch the Activity tab for live detail.</div>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{ margin: '0 32px 14px', background: 'var(--s1)', border: '1px solid var(--brand)', borderRadius: 11, padding: '11px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--sh-md)', animation: 'fadeIn 0.15s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>{selected.size} selected</span>
            <button onClick={() => setSelected(new Set())} style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600, cursor: 'pointer' }}>Clear</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => bulkAction('active')} variant="subtle" size="sm">Set active</Btn>
            <Btn onClick={() => bulkAction('paused')} variant="subtle" size="sm">Pause</Btn>
            <Btn onClick={() => bulkAction('archived')} variant="subtle" size="sm">Archive</Btn>
            <Btn onClick={() => bulkAction('delete')} variant="danger" size="sm">Delete</Btn>
          </div>
        </div>
      )}

      <div style={{ margin: '0 32px 32px', background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, overflow: 'visible', boxShadow: 'var(--sh-md)' }}>
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '38px 30px 38px 100px 1fr 110px 110px 56px 80px 90px 100px', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: '1px solid var(--b1)', background: 'var(--s2)', borderRadius: '14px 14px 0 0' }}>
            <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
            <div />
            {['#', 'Tag', 'Batch', 'Revenue', 'Orders', 'ROAS', 'Relative', 'Status'].map((h) => (
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
            <BatchRow key={batch.id} batch={batch} rank={i + 1} maxRevenue={maxRevenue}
              selected={selected.has(batch.id)} onSelect={() => toggleSelect(batch.id)}
              expanded={expandedId === batch.id}
              onToggle={() => setExpandedId(prev => prev === batch.id ? null : batch.id)}
              onSync={syncOneBatch} syncing={syncingId === batch.id}
              onAction={(action) => applyAction(batch, action)} />
          ))
        )}
      </div>

      {showCreate && <BatchModal mode="create" onClose={() => setShowCreate(false)} onSaved={(b) => setBatches(p => [{ ...b, totals: { orders: 0, revenue: 0, units: 0 }, store_count: 0 }, ...p])} />}
      {editBatch && <BatchModal mode="edit" batch={editBatch} onClose={() => setEditBatch(null)} onSaved={(b) => setBatches(p => p.map(x => x.id === b.id ? { ...x, ...b } : x))} />}
    </div>
  );
}

function StatCard({ label, value, accent, mono, icon }) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, padding: '18px 20px', boxShadow: 'var(--sh-sm)', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 42, height: 42, borderRadius: 11, background: `color-mix(in srgb, ${accent} 14%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: accent }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 23, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.02em', fontFamily: mono ? "'Fira Code', monospace" : 'inherit', lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  );
}
