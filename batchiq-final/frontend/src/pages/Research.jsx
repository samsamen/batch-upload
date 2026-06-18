import { useState, useEffect, useRef } from 'react';
import { api, fmtDate } from '../api.js';

const SOURCES = ['AliExpress spy', 'Competitor store', 'TikTok trend', 'Google Trends', 'Manual research', 'Supplier suggestion', 'Other'];
const COLUMNS = [
  { key: 'backlog',     label: 'Backlog',     accent: 'var(--c-blue)' },
  { key: 'in_progress', label: 'In progress', accent: 'var(--c-amber)' },
  { key: 'done',        label: 'Done',        accent: 'var(--c-emerald)' },
];

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{children}</div>;
}

function Btn({ children, onClick, disabled, variant = 'ghost', size = 'md' }) {
  const v = {
    primary: { background: 'linear-gradient(135deg, #818CF8, #6366F1)', color: '#fff', border: 'none', boxShadow: 'var(--sh-brand)', fontWeight: 700 },
    ghost:   { background: 'var(--s1)', color: 'var(--t1)', border: '1px solid var(--b2)', fontWeight: 600 },
    danger:  { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)', fontWeight: 600 },
  };
  const s = { md: { padding: '9px 16px', fontSize: 13 }, sm: { padding: '6px 12px', fontSize: 12 } };
  return <button onClick={onClick} disabled={disabled} style={{ borderRadius: 9, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'transform 0.1s', display: 'inline-flex', alignItems: 'center', gap: 7, ...v[variant], ...s[size] }}
    onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-1px)'; }}
    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>{children}</button>;
}

// ═══ Idea Modal (create + edit) ═══════════════════════════════════════════════
function IdeaModal({ idea, batches, onClose, onSaved }) {
  const isEdit = !!idea?.id;
  const [form, setForm] = useState({
    title: idea?.title || '', note: idea?.note || '', status: idea?.status || 'backlog',
    source: idea?.source || '', results: idea?.results || '',
    tags: (idea?.tags || []).join(', '), batch_id: idea?.batch_id || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit() {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setLoading(true); setError(null);
    try {
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      const payload = { ...form, tags, batch_id: form.batch_id || null };
      const saved = isEdit ? await api.patch(`/api/research/${idea.id}`, payload) : await api.post('/api/research', payload);
      onSaved(saved); onClose();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,35,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, width: 540, boxShadow: 'var(--sh-xl)', maxHeight: '92vh', overflowY: 'auto', animation: 'slideUp 0.2s ease' }}>
        <div style={{ padding: '22px 26px', borderBottom: '1px solid var(--b1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: 'var(--s1)', borderRadius: '16px 16px 0 0', zIndex: 2 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)' }}>{isEdit ? 'Edit Idea' : 'New Idea'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--t2)', marginTop: 3 }}>Brainstorm, test, and keep it for the future.</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, color: 'var(--t3)', background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {error && <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 9, padding: '10px 14px', fontSize: 12.5, color: 'var(--red)', fontWeight: 600 }}>{error}</div>}

          <div><Label>Idea title</Label><input placeholder="e.g. Heated scarf for Nordic winter" value={form.title} onChange={set('title')} /></div>
          <div><Label>Note</Label><textarea rows={3} placeholder="Write down the idea, why it could work, anything…" value={form.note} onChange={set('note')} style={{ resize: 'vertical' }} /></div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><Label>Status</Label><select value={form.status} onChange={set('status')}>{COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
            <div><Label>Source</Label><select value={form.source} onChange={set('source')}><option value="">Where you saw it</option>{SOURCES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>

          <div><Label>Results <span style={{ color: 'var(--t4)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>— after testing</span></Label><textarea rows={2} placeholder="Tested this → these are the results…" value={form.results} onChange={set('results')} style={{ resize: 'vertical' }} /></div>

          <div><Label>Link to batch <span style={{ color: 'var(--t4)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></Label>
            <select value={form.batch_id} onChange={set('batch_id')}>
              <option value="">No batch</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name}{b.batch_tag ? ` (${b.batch_tag})` : ''}</option>)}
            </select>
          </div>

          <div><Label>Tags (comma-separated)</Label><input placeholder="winter, accessories, impulse" value={form.tags} onChange={set('tags')} /></div>
        </div>

        <div style={{ padding: '16px 26px', borderTop: '1px solid var(--b1)', display: 'flex', gap: 10, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: 'var(--s1)', borderRadius: '0 0 16px 16px' }}>
          <Btn onClick={onClose} variant="ghost">Cancel</Btn>
          <Btn onClick={submit} disabled={loading} variant="primary">{loading ? 'Saving…' : isEdit ? 'Save' : 'Add Idea'}</Btn>
        </div>
      </div>
    </div>
  );
}

// ═══ Idea Card ════════════════════════════════════════════════════════════════
function IdeaCard({ idea, onEdit, onDelete, onDragStart, dragging }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, idea)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 11,
        padding: 14, marginBottom: 10, cursor: 'grab', boxShadow: hover ? 'var(--sh-md)' : 'var(--sh-sm)',
        opacity: dragging ? 0.4 : 1, transition: 'box-shadow 0.15s, opacity 0.15s', position: 'relative',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.35 }}>{idea.title}</div>
        <div style={{ display: 'flex', gap: 2, opacity: hover ? 1 : 0, transition: 'opacity 0.12s' }}>
          <button onClick={() => onEdit(idea)} style={iconBtn} title="Edit">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9.5 2.5l2 2M2 12l.5-2.5 7-7 2 2-7 7L2 12Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
          </button>
          <button onClick={() => onDelete(idea)} style={iconBtn} title="Delete">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2.5 4h9M5 4V2.5h4V4M3.5 4l.5 8h6l.5-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      {idea.note && <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 6, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{idea.note}</div>}

      {idea.results && (
        <div style={{ marginTop: 8, padding: '7px 10px', background: 'var(--green-bg)', borderRadius: 7, fontSize: 11, color: 'var(--green)', lineHeight: 1.45 }}>
          <span style={{ fontWeight: 700 }}>Results: </span>{idea.results}
        </div>
      )}

      {(idea.tags?.length > 0 || idea.source || idea.biq_batches) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10, alignItems: 'center' }}>
          {idea.biq_batches && (
            <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 10, fontWeight: 600, color: 'var(--brand)', background: 'var(--brand-l)', borderRadius: 5, padding: '2px 7px' }}>
              ↳ {idea.biq_batches.batch_tag || idea.biq_batches.name}
            </span>
          )}
          {idea.source && <span style={{ fontSize: 10, color: 'var(--t2)', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 5, padding: '2px 7px' }}>{idea.source}</span>}
          {(idea.tags || []).slice(0, 3).map(t => (
            <span key={t} style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--s2)', borderRadius: 5, padding: '2px 7px' }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

const iconBtn = {
  width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--t3)', background: 'var(--s2)', cursor: 'pointer', border: '1px solid var(--b1)',
};

// ═══ Research Page ════════════════════════════════════════════════════════════
export default function Research() {
  const [ideas, setIdeas] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalIdea, setModalIdea] = useState(undefined); // undefined=closed, null=new, obj=edit
  const [dragId, setDragId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const [i, b] = await Promise.all([api.get('/api/research'), api.get('/api/batches?range=all')]);
      setIdeas(i); setBatches(b);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  function onSaved(saved) {
    setIdeas(prev => {
      const exists = prev.find(x => x.id === saved.id);
      return exists ? prev.map(x => x.id === saved.id ? saved : x) : [saved, ...prev];
    });
  }

  async function onDelete(idea) {
    if (!confirm(`Delete "${idea.title}"?`)) return;
    try { await api.delete(`/api/research/${idea.id}`); setIdeas(p => p.filter(x => x.id !== idea.id)); }
    catch (err) { setError(err.message); }
  }

  function onDragStart(e, idea) { setDragId(idea.id); e.dataTransfer.effectAllowed = 'move'; }

  async function onDrop(colKey) {
    setDragOverCol(null);
    const idea = ideas.find(x => x.id === dragId);
    setDragId(null);
    if (!idea || idea.status === colKey) return;
    // optimistic
    setIdeas(p => p.map(x => x.id === idea.id ? { ...x, status: colKey } : x));
    try { await api.patch(`/api/research/${idea.id}`, { status: colKey }); }
    catch (err) { setError(err.message); load(); }
  }

  return (
    <div>
      <div style={{ padding: '26px 32px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.025em' }}>Research</h1>
            <p style={{ fontSize: 13, color: 'var(--t2)', marginTop: 3 }}>Brainstorm ideas, drag them across stages, keep them for the future.</p>
          </div>
          <Btn onClick={() => setModalIdea(null)} variant="primary">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            New Idea
          </Btn>
        </div>
      </div>

      {error && <div style={{ margin: '0 32px 16px', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 9, padding: '11px 15px', fontSize: 12.5, color: 'var(--red)', fontWeight: 600 }}>{error}</div>}

      {loading ? (
        <div style={{ padding: '60px 32px', color: 'var(--t3)', fontFamily: "'Fira Code', monospace", fontSize: 12 }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: '0 32px 32px', alignItems: 'start' }}>
          {COLUMNS.map(col => {
            const colIdeas = ideas.filter(i => i.status === col.key);
            const isOver = dragOverCol === col.key;
            return (
              <div key={col.key}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
                onDragLeave={() => setDragOverCol(c => c === col.key ? null : c)}
                onDrop={() => onDrop(col.key)}
                style={{
                  background: isOver ? 'var(--brand-l)' : 'var(--s2)',
                  border: '1px solid ' + (isOver ? 'var(--brand)' : 'var(--b1)'),
                  borderRadius: 14, padding: 14, minHeight: 200, transition: 'background 0.15s, border-color 0.15s',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '0 2px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.accent }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{col.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', background: 'var(--s3)', borderRadius: 20, padding: '1px 8px', marginLeft: 'auto' }}>{colIdeas.length}</span>
                </div>

                {colIdeas.length === 0 ? (
                  <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 11.5, color: 'var(--t3)', border: '1px dashed var(--b2)', borderRadius: 10 }}>
                    {isOver ? 'Drop here' : 'No ideas yet'}
                  </div>
                ) : (
                  colIdeas.map(idea => (
                    <IdeaCard key={idea.id} idea={idea} onEdit={setModalIdea} onDelete={onDelete}
                      onDragStart={onDragStart} dragging={dragId === idea.id} />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalIdea !== undefined && (
        <IdeaModal idea={modalIdea} batches={batches} onClose={() => setModalIdea(undefined)} onSaved={onSaved} />
      )}
    </div>
  );
}
