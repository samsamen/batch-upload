import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, fmtDate } from '../api.js';

const SCOPES = 'read_products,write_products,read_orders,read_all_orders,write_metaobjects,write_translations';

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

function Btn({ children, onClick, disabled, variant = 'ghost', full }) {
  const styles = {
    primary: { background: 'linear-gradient(135deg, #818CF8, #6366F1)', color: '#fff', border: 'none', fontWeight: 700, boxShadow: 'var(--sh-brand)' },
    ghost:   { background: 'transparent', color: 'var(--t2)', border: '1px solid var(--b2)', fontWeight: 500 },
  };
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        padding: '9px 16px', borderRadius: 5, fontSize: 12,
        cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        opacity: disabled ? 0.5 : 1, transition: 'opacity 0.1s',
        width: full ? '100%' : 'auto', ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

function CopyButton({ value, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{
        fontFamily: "'Fira Code', monospace", fontSize: 9, fontWeight: 500,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: copied ? 'var(--green)' : 'var(--t2)', background: 'none',
        border: '1px solid ' + (copied ? 'rgba(56,217,138,0.3)' : 'var(--b2)'),
        borderRadius: 3, padding: '3px 9px', cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

// ── Connect Store Modal ───────────────────────────────────────────────────────
function ConnectModal({ onClose, onConnected, savedConfig }) {
  const [form, setForm] = useState({
    shop_domain: '',
    client_id: savedConfig.shopify_client_id || '',
    client_secret: '',
    name: '',
    feed_language: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const hasSecret = savedConfig.has_secret;

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit() {
    if (!form.shop_domain.trim()) { setError('Enter the store URL.'); return; }
    setLoading(true); setError(null);
    try {
      const store = await api.post('/api/stores/connect', {
        shop_domain: form.shop_domain.trim(),
        name: form.name.trim() || undefined,
        feed_language: form.feed_language || undefined,
        client_id: form.client_id.trim() || undefined,
        client_secret: form.client_secret.trim() || undefined,
      });
      onConnected(store);
      onClose();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20,
    }}>
      <div style={{
        background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 10,
        width: 920, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 26px', borderBottom: '1px solid var(--b1)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>Connect Shopify Store</div>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--t2)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: 26 }}>

          {/* LEFT — credentials form */}
          <div style={{
            background: 'var(--s2)', border: '1px solid var(--b1)',
            borderRadius: 8, padding: 22,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>
              Shopify Credentials
            </div>
            <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 18 }}>
              Enter your Shopify app credentials below
            </div>

            {error && (
              <div style={{
                background: 'var(--red-bg)', border: '1px solid var(--red)',
                borderRadius: 7, padding: '9px 12px', marginBottom: 14, fontSize: 12, color: 'var(--red)', fontWeight: 600,
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <Label>Enter shopify store url</Label>
              <input
                placeholder="your-store.myshopify.com"
                value={form.shop_domain}
                onChange={set('shop_domain')}
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
                E.g. yourshop.myshopify.com
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <Label>Client ID</Label>
              <input
                placeholder="paste Client ID"
                value={form.client_id}
                onChange={set('client_id')}
                style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <Label>Client Secret</Label>
              <input
                type="password"
                placeholder={hasSecret ? 'saved — leave empty to reuse' : 'paste Client Secret'}
                value={form.client_secret}
                onChange={set('client_secret')}
                style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }}
              />
              {hasSecret && (
                <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 5 }}>
                  ✓ App credentials saved — you only need the store URL for new stores.
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
              <div>
                <Label>Profile Name</Label>
                <input placeholder="e.g. EmiyoSuomi" value={form.name} onChange={set('name')} />
              </div>
              <div>
                <Label>Feed Language</Label>
                <select value={form.feed_language} onChange={set('feed_language')}>
                  <option value="">Auto-detect</option>
                  <option value="en">English</option>
                  <option value="fi">Finnish</option>
                  <option value="fr">French</option>
                  <option value="pl">Polish</option>
                  <option value="nl">Dutch</option>
                  <option value="de">German</option>
                </select>
              </div>
            </div>

            <Btn onClick={submit} disabled={loading} variant="primary" full>
              {loading ? 'Connecting…' : 'Add store'}
            </Btn>
          </div>

          {/* RIGHT — instructions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: 'var(--s2)', border: '1px solid var(--b1)',
              borderRadius: 8, padding: 22,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>
                How to connect your Shopify store
              </div>
              <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 16 }}>
                One-time setup per store
              </div>
              <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
                <Step>Go to the <strong style={{ color: 'var(--gold)' }}>Shopify Dev Dashboard</strong> and create an app (once — same app works for all stores)</Step>
                <Step>Enable the required scopes below in the app configuration</Step>
                <Step><strong style={{ color: 'var(--t1)' }}>Install the app on the store</strong> (Dev Dashboard → your app → choose store) — one-time per store</Step>
                <Step>Copy Client ID + Secret here, click <strong style={{ color: 'var(--t1)' }}>Add store</strong></Step>
                <Step>Every next store: install app on it + only enter store URL here</Step>
              </ol>
            </div>

            <div style={{
              background: 'var(--s2)', border: '1px solid var(--b1)',
              borderRadius: 8, padding: 22,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Required API Scopes</div>
                <CopyButton value={SCOPES} label="Copy scopes" />
              </div>
              <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 12 }}>
                When creating your Shopify app, make sure to enable the following scopes:
              </div>
              <div style={{
                background: 'var(--bg)', border: '1px solid var(--b1)',
                borderRadius: 5, padding: '10px 12px',
                fontFamily: "'Fira Code', monospace", fontSize: 11,
                color: 'var(--gold)', lineHeight: 1.7, wordBreak: 'break-word',
              }}>
                {SCOPES}
              </div>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 10, lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--t2)' }}>read_all_orders</strong> is a protected scope — Shopify only gives 60 days of order history without it. For a custom app on your own store it's usually granted on install.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ children }) {
  return <li style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6, paddingLeft: 4 }}>{children}</li>;
}

// ── Edit Store Modal ──────────────────────────────────────────────────────────
function EditStoreModal({ store, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: store.name || '',
    currency: store.currency || 'EUR',
    markets: (store.markets || []).join(', '),
    client_id: '',
    client_secret: '',
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setLoading(true); setError(null);
    try {
      const markets = form.markets.split(',').map(m => m.trim().toUpperCase()).filter(Boolean);
      const body = { name: form.name.trim(), currency: form.currency.trim() || 'EUR', markets };
      if (form.client_id.trim()) body.client_id = form.client_id.trim();
      if (form.client_secret.trim()) body.client_secret = form.client_secret.trim();
      const updated = await api.patch(`/api/stores/${store.id}`, body);
      onSaved(updated); onClose();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function refreshMarkets() {
    setRefreshing(true); setError(null); setOkMsg(null);
    try {
      const r = await api.post(`/api/stores/${store.id}/refresh-markets`, {});
      const mk = (r.markets || []);
      setForm(f => ({ ...f, markets: mk.join(', ') }));
      setOkMsg(mk.length ? `Pulled ${mk.length} market(s) from Shopify.` : 'No markets returned (check read_markets scope).');
    } catch (err) { setError(err.message); } finally { setRefreshing(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,35,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 14, width: 480, padding: 26, boxShadow: 'var(--sh-xl)', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)' }}>Edit store</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, color: 'var(--t3)', background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>✕</button>
        </div>

        {error && <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 9, padding: '9px 13px', marginBottom: 14, fontSize: 12.5, color: 'var(--red)', fontWeight: 600 }}>{error}</div>}
        {okMsg && <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 9, padding: '9px 13px', marginBottom: 14, fontSize: 12.5, color: 'var(--green)', fontWeight: 600 }}>{okMsg}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'Fira Code', monospace" }}>{store.shop_domain}</div>
          <div><Label>Store name</Label><input value={form.name} onChange={set('name')} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><Label>Currency</Label><input value={form.currency} onChange={set('currency')} style={{ fontFamily: "'Fira Code', monospace" }} /></div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Label>Markets</Label>
                <button onClick={refreshMarkets} disabled={refreshing} style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-l)', border: '1px solid var(--brand-l)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
                  {refreshing ? 'Pulling…' : 'Pull from Shopify'}
                </button>
              </div>
              <input placeholder="FI, SE" value={form.markets} onChange={set('markets')} style={{ fontFamily: "'Fira Code', monospace" }} />
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--t3)' }}>Country codes, comma-separated (e.g. FI, SE, NO). "Pull from Shopify" reads them from your store's Markets (needs read_markets scope).</div>

          <div style={{ height: 1, background: 'var(--b1)', margin: '2px 0' }} />
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--t2)' }}>App credentials <span style={{ fontWeight: 500, color: 'var(--t3)' }}>(leave empty to keep current)</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><Label>Client ID</Label><input placeholder="paste to update" value={form.client_id} onChange={set('client_id')} style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }} /></div>
            <div><Label>Client Secret</Label><input type="password" placeholder="paste to update" value={form.client_secret} onChange={set('client_secret')} style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }} /></div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <Btn onClick={onClose} variant="ghost">Cancel</Btn>
          <Btn onClick={save} disabled={loading} variant="primary">{loading ? 'Saving…' : 'Save changes'}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Stores Page ───────────────────────────────────────────────────────────────
export default function Stores() {
  const [stores, setStores]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [successMsg, setSuccess]  = useState(null);
  const [showConnect, setConnect] = useState(false);
  const [config, setConfig]       = useState({ shopify_client_id: '', has_secret: false });
  const [syncingId, setSyncingId] = useState(null);
  const [editStore, setEditStore] = useState(null);
  const [searchParams]            = useSearchParams();

  useEffect(() => {
    const c = searchParams.get('connected');
    if (c) { setSuccess(`${decodeURIComponent(c)} connected.`); window.history.replaceState({}, '', '/stores'); }
    load(); loadConfig();
  }, []);

  async function load() {
    try { setLoading(true); setStores(await api.get('/api/stores')); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  async function loadConfig() {
    try { setConfig(await api.get('/api/config')); } catch {}
  }

  function onConnected(store) {
    setSuccess(`${store.name} connected.`);
    loadConfig();
    load();
  }

  async function syncStore(id, name) {
    setSyncingId(id);
    setError(null);
    try {
      const r = await api.post(`/api/sync/store/${id}`, { days: 30 });
      const errs = r.errors?.length ? ` (${r.errors.length} error${r.errors.length > 1 ? 's' : ''})` : '';
      setSuccess(`${name}: synced ${r.synced} day(s)${errs}. Check Activity for detail.`);
    } catch (err) { setError(err.message); } finally { setSyncingId(null); }
  }

  async function disconnect(id, name) {
    if (!confirm(`Disconnect ${name}?`)) return;
    try { await api.delete(`/api/stores/${id}`); setStores(p => p.filter(s => s.id !== id)); }
    catch (err) { setError(err.message); }
  }

  function onStoreSaved(updated) {
    setStores(p => p.map(s => s.id === updated.id ? { ...s, ...updated } : s));
    setSuccess(`${updated.name} updated.`);
  }

  // Detect markets covered by more than one store
  const marketCount = {};
  for (const s of stores) {
    for (const m of (s.markets || [])) {
      marketCount[m] = (marketCount[m] || 0) + 1;
    }
  }
  const overlapping = Object.entries(marketCount).filter(([, n]) => n > 1).map(([m]) => m);

  return (
    <div>
      <div style={{
        padding: '24px 32px 20px', borderBottom: '1px solid var(--b1)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--t1)' }}>Stores</div>
          <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>
            Connect each store with your app credentials. No login required.
          </div>
        </div>
        <Btn onClick={() => setConnect(true)} variant="primary">Connect Store</Btn>
      </div>

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 920 }}>
        {successMsg && (
          <div style={{
            background: 'rgba(56,217,138,0.06)', border: '1px solid rgba(56,217,138,0.2)',
            borderRadius: 5, padding: '10px 14px', fontSize: 12, color: 'var(--green)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            {successMsg}
            <button onClick={() => setSuccess(null)} style={{ background: 'none', color: 'var(--green)', fontSize: 16 }}>×</button>
          </div>
        )}
        {error && (
          <div style={{
            background: 'rgba(239,80,80,0.06)', border: '1px solid rgba(239,80,80,0.2)',
            borderRadius: 5, padding: '10px 14px', fontSize: 12, color: 'var(--red)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            {error}
            <button onClick={() => setError(null)} style={{ background: 'none', color: 'var(--red)', fontSize: 16 }}>×</button>
          </div>
        )}

        {/* Market overlap warning */}
        {overlapping.length > 0 && (
          <div style={{
            background: 'rgba(232,184,75,0.07)', border: '1px solid rgba(232,184,75,0.25)',
            borderRadius: 5, padding: '10px 14px', fontSize: 12, color: 'var(--gold)',
          }}>
            <strong>Market overlap:</strong> {overlapping.join(', ')} {overlapping.length === 1 ? 'is' : 'are'} covered by more than one store. Avoid sending the same products to stores sharing a market.
          </div>
        )}

        {/* Connected stores */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--b1)', fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>
            Connected stores ({stores.length})
          </div>
          {loading ? (
            <div style={{ padding: '32px 20px', color: 'var(--t3)', fontFamily: "'Fira Code', monospace", fontSize: 11 }}>Loading…</div>
          ) : stores.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
              No stores connected yet. Click "Connect Store" to add your first one.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--b1)' }}>
                  {['Store', 'Domain', 'Markets', 'Currency', 'Connected', ''].map(h => (
                    <th key={h} style={{ padding: '8px 20px', textAlign: 'left', fontSize: 9, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stores.map((s, i) => (
                  <tr key={s.id}
                    style={{ borderBottom: i < stores.length - 1 ? '1px solid var(--b1)' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--s2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '11px 20px', fontWeight: 600, color: 'var(--t1)', fontSize: 13 }}>{s.name}</td>
                    <td style={{ padding: '11px 20px', fontFamily: "'Fira Code', monospace", fontSize: 11, color: 'var(--t2)' }}>{s.shop_domain}</td>
                    <td style={{ padding: '11px 20px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(s.markets && s.markets.length > 0) ? s.markets.map(m => (
                          <span key={m} style={{
                            fontFamily: "'Fira Code', monospace", fontSize: 10, fontWeight: 500,
                            padding: '1px 6px', borderRadius: 3,
                            background: overlapping.includes(m) ? 'rgba(232,184,75,0.15)' : 'var(--s2)',
                            color: overlapping.includes(m) ? 'var(--gold)' : 'var(--t2)',
                            border: '1px solid ' + (overlapping.includes(m) ? 'rgba(232,184,75,0.3)' : 'var(--b1)'),
                          }}>
                            {m}
                          </span>
                        )) : <span style={{ fontSize: 11, color: 'var(--t3)' }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: '11px 20px', fontSize: 12, color: 'var(--t2)' }}>{s.currency || 'EUR'}</td>
                    <td style={{ padding: '11px 20px', fontSize: 11, color: 'var(--t2)', fontFamily: "'Fira Code', monospace" }}>{fmtDate(s.connected_at)}</td>
                    <td style={{ padding: '11px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => syncStore(s.id, s.name)} disabled={syncingId === s.id}
                          style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #818CF8, #6366F1)', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', boxShadow: 'var(--sh-brand)', opacity: syncingId === s.id ? 0.7 : 1, transition: 'transform 0.1s', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          onMouseEnter={e => { if (syncingId !== s.id) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                          {syncingId === s.id && <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />}
                          {syncingId === s.id ? 'Syncing…' : 'Sync'}
                        </button>
                        <button onClick={() => setEditStore(s)}
                          style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', transition: 'all 0.12s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--s3)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--s1)'; }}>
                          Edit
                        </button>
                        <button onClick={() => disconnect(s.id, s.name)}
                          style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', transition: 'all 0.12s' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.background = 'var(--red-bg)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--t1)'; e.currentTarget.style.borderColor = 'var(--b2)'; e.currentTarget.style.background = 'var(--s1)'; }}>
                          Disconnect
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

      {showConnect && (
        <ConnectModal
          onClose={() => setConnect(false)}
          onConnected={onConnected}
          savedConfig={config}
        />
      )}
      {editStore && (
        <EditStoreModal
          store={editStore}
          onClose={() => setEditStore(null)}
          onSaved={onStoreSaved}
        />
      )}
    </div>
  );
}
