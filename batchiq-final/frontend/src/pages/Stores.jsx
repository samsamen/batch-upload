import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, fmtDate } from '../api.js';

const SCOPES = 'read_products,write_products,read_orders,read_all_orders,read_markets,write_metaobjects,write_translations';

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

function InlineGadsAccountPicker({ store, onPicked, onError }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [val, setVal] = useState('');
  const [localErr, setLocalErr] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setLocalErr(null);
    try {
      const r = await api.get(`/api/google-ads/accounts?store_id=${store.id}`);
      setAccounts(r.accounts || []);
    } catch (e) { setLocalErr(e.message); } finally { setLoading(false); }
  }

  async function pick(cid) {
    if (!cid) return;
    setSaving(true); setLocalErr(null);
    try {
      await api.patch(`/api/google-ads/store/${store.id}`, { gads_customer_id: cid });
      onPicked(cid);
    } catch (e) { setLocalErr(e.message); onError && onError(e.message); } finally { setSaving(false); }
  }

  return (
    <div style={{ marginTop: 4, padding: '7px 9px', background: 'var(--brand-l)', borderRadius: 8, border: '1px solid var(--brand-l)', minWidth: 220 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Choose Google Ads account</div>
      {loading ? (
        <div style={{ fontSize: 11, color: 'var(--t2)' }}>Loading accounts…</div>
      ) : localErr ? (
        <div style={{ fontSize: 10.5, color: 'var(--red)', lineHeight: 1.4 }}>
          {localErr}
          <button onClick={load} style={{ display: 'block', marginTop: 4, fontSize: 10, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 700 }}>Retry</button>
        </div>
      ) : accounts.length === 0 ? (
        <div style={{ fontSize: 10.5, color: 'var(--t3)' }}>No accounts found for this login.</div>
      ) : (
        <select value={val} disabled={saving} onChange={(e) => { setVal(e.target.value); pick(e.target.value); }}
          style={{ width: '100%', fontFamily: "'Fira Code', monospace", fontSize: 11.5, padding: '5px 7px', borderRadius: 6 }}>
          <option value="">{saving ? 'Saving…' : '— select —'}</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id} disabled={a.manager}>{a.name} · {a.id}{a.manager ? ' (manager)' : ''}{a.currency ? ` · ${a.currency}` : ''}</option>
          ))}
        </select>
      )}
    </div>
  );
}

function GadsGlyph({ light }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M12 11v2.6h4.3c-.2 1.1-1.4 3.2-4.3 3.2a4.8 4.8 0 1 1 0-9.6c1.4 0 2.4.6 3 1.1l1.8-1.7C15.6 5.5 14 4.8 12 4.8a7.2 7.2 0 1 0 0 14.4c4.2 0 7-2.9 7-7 0-.5 0-.8-.1-1.2H12z" fill={light ? '#fff' : '#34A853'} />
    </svg>
  );
}

function StatusDot({ on, label, onText, offText }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: on ? 'var(--green)' : 'var(--t4, #9aa0ac)',
        boxShadow: on ? '0 0 0 3px rgba(56,217,138,0.18)' : 'none',
      }} />
      <span style={{ fontSize: 10.5, color: 'var(--t2)' }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: on ? 'var(--green)' : 'var(--t3)', marginLeft: 5, fontWeight: 600 }}>{on ? onText : offText}</span>
      </span>
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = 'ghost', full }) {
  const styles = {
    primary: { background: 'linear-gradient(135deg, #818CF8, #6366F1)', color: '#fff', border: 'none', fontWeight: 700, boxShadow: 'var(--sh-brand)' },
    ghost:   { background: 'var(--s1)', color: 'var(--t1)', border: '1px solid var(--b2)', fontWeight: 600 },
  };
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        padding: '9px 16px', borderRadius: 9, fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        opacity: disabled ? 0.6 : 1, transition: 'transform 0.1s, opacity 0.1s',
        width: full ? '100%' : 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        ...styles[variant],
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
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
    client_id: '',
    client_secret: '',
    name: '',
    feed_language: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit() {
    if (!form.shop_domain.trim()) { setError('Enter the store URL.'); return; }
    if (!form.client_id.trim() || !form.client_secret.trim()) { setError('Enter this store\u2019s own Client ID and Secret.'); return; }
    setLoading(true); setError(null);
    try {
      const store = await api.post('/api/stores/connect', {
        shop_domain: form.shop_domain.trim(),
        name: form.name.trim() || undefined,
        feed_language: form.feed_language || undefined,
        client_id: form.client_id.trim(),
        client_secret: form.client_secret.trim(),
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
                placeholder="paste this store's Client Secret"
                value={form.client_secret}
                onChange={set('client_secret')}
                style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }}
              />
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
                <Step>In the store admin: <strong style={{ color: 'var(--gold)' }}>Settings → Apps and sales channels → Develop apps</strong> → Create an app</Step>
                <Step>Open <strong style={{ color: 'var(--t1)' }}>Configuration</strong> → enable all the scopes listed below (including <strong style={{ color: 'var(--t1)' }}>read_markets</strong>)</Step>
                <Step><strong style={{ color: 'var(--t1)' }}>Install app</strong> on the store (top right). If you change scopes later, you must Install/Update again or the token won't have them.</Step>
                <Step>Open <strong style={{ color: 'var(--t1)' }}>API credentials</strong> → copy this store's Client ID + Client Secret here</Step>
                <Step>Each store has its OWN app and its OWN keys — repeat per store.</Step>
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
                <strong style={{ color: 'var(--t2)' }}>read_all_orders</strong> gives full order history (without it Shopify caps at 60 days). <strong style={{ color: 'var(--t2)' }}>read_markets</strong> lets BatchIQ read which countries each store sells to, so it can warn about overlap and auto-fill markets.
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
    shop_domain: store.shop_domain || '',
    currency: store.currency || 'EUR',
    markets: (store.markets || []).join(', '),
    gads_customer_id: store.gads_customer_id || '',
    client_id: '',
    client_secret: '',
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);
  const [gadsAccounts, setGadsAccounts] = useState([]);
  const [gadsLoading, setGadsLoading] = useState(false);
  const [gadsErr, setGadsErr] = useState(null);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  // Auto-load accounts when opening an edit for a gads-connected store
  useEffect(() => {
    if (store.gads_connected) loadGadsAccounts();
  }, []);

  async function loadGadsAccounts() {
    setGadsLoading(true); setGadsErr(null);
    try {
      const r = await api.get(`/api/google-ads/accounts?store_id=${store.id}`);
      setGadsAccounts(r.accounts || []);
    } catch (e) { setGadsErr(e.message); } finally { setGadsLoading(false); }
  }

  async function save() {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.shop_domain.trim()) { setError('Store URL is required.'); return; }
    setLoading(true); setError(null);
    try {
      const markets = form.markets.split(',').map(m => m.trim().toUpperCase()).filter(Boolean);
      const body = { name: form.name.trim(), currency: form.currency.trim() || 'EUR', markets };
      if (form.shop_domain.trim() !== store.shop_domain) body.shop_domain = form.shop_domain.trim();
      if (form.client_id.trim()) body.client_id = form.client_id.trim();
      if (form.client_secret.trim()) body.client_secret = form.client_secret.trim();
      const updated = await api.patch(`/api/stores/${store.id}`, body);
      // Save Google Ads account id separately
      const gadsId = form.gads_customer_id.replace(/\D/g, '');
      if (gadsId !== (store.gads_customer_id || '')) {
        await api.patch(`/api/google-ads/store/${store.id}`, { gads_customer_id: gadsId });
      }
      onSaved({ ...updated, gads_customer_id: gadsId }); onClose();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function refreshMarkets() {
    setRefreshing(true); setError(null); setOkMsg(null);
    try {
      const r = await api.post(`/api/stores/${store.id}/refresh-markets`, {});
      const mk = (r.markets || []);
      setForm(f => ({ ...f, markets: mk.join(', ') }));
      if (mk.length) setOkMsg(`Pulled ${mk.length} market(s) from Shopify.`);
      else if (r.marketError) setError(`Shopify: ${r.marketError}`);
      else setOkMsg('No markets configured in this Shopify store.');
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
          <div><Label>Shopify store URL</Label><input value={form.shop_domain} onChange={set('shop_domain')} style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }} placeholder="your-store.myshopify.com" /></div>
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
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Label>Google Ads account</Label>
              {store.gads_connected && (
                <button onClick={loadGadsAccounts} disabled={gadsLoading} style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-l)', border: '1px solid var(--brand-l)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
                  {gadsLoading ? 'Loading…' : 'Load accounts'}
                </button>
              )}
            </div>
            {!store.gads_connected ? (
              <div style={{ fontSize: 11, color: 'var(--t3)', padding: '8px 0' }}>
                Not connected to Google Ads yet. Close this and click <strong style={{ color: 'var(--t2)' }}>Connect Google Ads</strong> on the store row first.
              </div>
            ) : gadsAccounts.length > 0 ? (
              <select value={form.gads_customer_id} onChange={set('gads_customer_id')} style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }}>
                <option value="">— select an account —</option>
                {gadsAccounts.map(a => (
                  <option key={a.id} value={a.id} disabled={a.manager}>
                    {a.name} · {a.id}{a.manager ? ' (manager)' : ''}{a.currency ? ` · ${a.currency}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input placeholder="click 'Load accounts' or type the ID" value={form.gads_customer_id} onChange={set('gads_customer_id')} style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }} />
            )}
            <div style={{ fontSize: 10.5, color: 'var(--t3)', marginTop: 4 }}>Spend &amp; ROAS pull from this account on each sync.</div>
            {gadsErr && <div style={{ fontSize: 10.5, color: 'var(--red)', marginTop: 4 }}>{gadsErr}</div>}
          </div>

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

// ── One-time Google Ads OAuth credentials (collapsible) ─────────────────────────
function GadsCredentialsBlock({ cfg, onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ client_id: '', client_secret: '', developer_token: '', login_customer_id: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (cfg) setForm(f => ({ ...f, client_id: cfg.client_id || '', login_customer_id: cfg.login_customer_id || '' }));
  }, [cfg]);

  // When keys are managed by server env vars, there's nothing to configure here.
  if (cfg?.env_managed) return null;

  const ready = cfg?.ready;
  const redirectUri = `${window.location.origin}/api/google-ads/callback`;

  async function save() {
    setSaving(true); setErr(null); setMsg(null);
    try { await api.post('/api/google-ads/config', form); setMsg('Saved.'); onSaved && onSaved(); }
    catch (e) { setErr(e.message); } finally { setSaving(false); }
  }

  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px', background: 'none', border: 'none', cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: ready ? 'var(--green)' : 'var(--amber)', boxShadow: ready ? '0 0 0 3px rgba(56,217,138,0.18)' : 'none' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Google Ads API keys</span>
          <span style={{ fontSize: 11, color: 'var(--t3)' }}>{ready ? 'configured — one-time setup done' : 'one-time setup required to use Google Ads'}</span>
        </div>
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', color: 'var(--t3)' }}>▸</span>
      </button>

      {open && (
        <div style={{ padding: '4px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {msg && <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>{msg}</div>}
          {err && <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>{err}</div>}
          {cfg?.env_managed ? (
            <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>
              Keys are managed securely on the server (environment variables). Nothing to enter here — just use <strong style={{ color: 'var(--t1)' }}>Connect Google Ads</strong> on each store.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6 }}>
                These are your Google Cloud OAuth app keys — entered once, shared by all stores. Each store then connects its own Google account with its own button below. For production, set these as Railway environment variables (GADS_CLIENT_ID, GADS_CLIENT_SECRET, GADS_DEVELOPER_TOKEN, GADS_LOGIN_CUSTOMER_ID) and this block disappears.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><Label>OAuth Client ID</Label><input value={form.client_id} onChange={set('client_id')} placeholder="…apps.googleusercontent.com" style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }} /></div>
                <div><Label>OAuth Client Secret</Label><input type="password" value={form.client_secret} onChange={set('client_secret')} placeholder={cfg?.has_client_secret ? 'saved — paste to change' : 'GOCSPX-…'} style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }} /></div>
                <div><Label>Developer Token</Label><input type="password" value={form.developer_token} onChange={set('developer_token')} placeholder={cfg?.has_developer_token ? 'saved — paste to change' : 'developer token'} style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }} /></div>
                <div><Label>MCC / Login Customer ID</Label><input value={form.login_customer_id} onChange={set('login_customer_id')} placeholder="123930783" style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }} /></div>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--t3)', lineHeight: 1.6 }}>
                Add this redirect URI to your OAuth client in Google Cloud Console: <span style={{ fontFamily: "'Fira Code', monospace", color: 'var(--t2)' }}>{redirectUri}</span>
              </div>
              <div><Btn onClick={save} disabled={saving} variant="primary">{saving ? 'Saving…' : 'Save keys'}</Btn></div>
            </>
          )}
        </div>
      )}
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
  const [syncingAll, setSyncingAll] = useState(false);
  const [editStore, setEditStore] = useState(null);
  const [gadsCfg, setGadsCfg] = useState(null);
  const [gadsConnecting, setGadsConnecting] = useState(null);
  const [searchParams]            = useSearchParams();

  useEffect(() => {
    const c = searchParams.get('connected');
    if (c) { setSuccess(`${decodeURIComponent(c)} connected.`); window.history.replaceState({}, '', '/stores'); }
    const gc = searchParams.get('gads_connected');
    if (gc) { setSuccess('Google Ads connected for the store. Now pick the account ID in Edit.'); window.history.replaceState({}, '', '/stores'); }
    const ge = searchParams.get('gads_error');
    if (ge) { setError(`Google Ads: ${decodeURIComponent(ge)}`); window.history.replaceState({}, '', '/stores'); }
    load(); loadConfig(); loadGadsCfg();
  }, []);

  async function load() {
    try { setLoading(true); setStores(await api.get('/api/stores?include=all')); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  async function loadConfig() {
    try { setConfig(await api.get('/api/config')); } catch {}
  }
  async function loadGadsCfg() {
    try { setGadsCfg(await api.get('/api/google-ads/config')); } catch {}
  }

  async function connectGads(storeId) {
    setGadsConnecting(storeId); setError(null);
    try {
      const { url } = await api.get(`/api/google-ads/auth-url?store_id=${storeId}`);
      window.location.href = url;
    } catch (err) { setError(err.message); setGadsConnecting(null); }
  }

  async function disconnectGads(storeId, name) {
    if (!confirm(`Disconnect ${name} from Google Ads?`)) return;
    try {
      await api.post(`/api/google-ads/store/${storeId}/disconnect`, {});
      setStores(p => p.map(s => s.id === storeId ? { ...s, gads_connected: false, gads_linked: false, gads_customer_id: null } : s));
    } catch (err) { setError(err.message); }
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

  async function syncAllStores() {
    setSyncingAll(true);
    setError(null); setSuccess(null);
    try {
      // Refresh markets for every active store, then run the global performance sync
      await Promise.all(stores.filter(s => s.active).map(s =>
        api.post(`/api/stores/${s.id}/refresh-markets`, {}).catch(() => null)
      ));
      const r = await api.post('/api/sync', { days: 30 });
      const errs = r.errors?.length ? ` (${r.errors.length} error${r.errors.length > 1 ? 's' : ''})` : '';
      setSuccess(`Synced all ${stores.length} store(s): ${r.synced} day(s) updated${errs}. Check Activity for detail.`);
      await load();
    } catch (err) { setError(err.message); } finally { setSyncingAll(false); }
  }

  async function reconnect(id, name) {
    setSyncingId(id); setError(null); setSuccess(null);
    try {
      const r = await api.post(`/api/stores/${id}/reconnect`, {});
      setStores(p => p.map(s => s.id === id ? { ...s, ...r.store } : s));
      setSuccess(`${name}: reconnected with a fresh token${r.markets?.length ? ` (markets: ${r.markets.join(', ')})` : ''}.`);
    } catch (err) { setError(err.message); } finally { setSyncingId(null); }
  }

  async function disconnect(id, name) {
    if (!confirm(`Disconnect ${name}? It's hidden but kept — its data and batch links stay, and you can reconnect later.`)) return;
    try { await api.delete(`/api/stores/${id}`); setStores(p => p.map(s => s.id === id ? { ...s, active: false } : s)); }
    catch (err) { setError(err.message); }
  }

  async function removePermanently(id, name) {
    if (!confirm(`Permanently delete ${name}? This removes the store and its data for good. This cannot be undone.`)) return;
    try { await api.delete(`/api/stores/${id}?hard=true`); setStores(p => p.filter(s => s.id !== id)); }
    catch (err) { setError(err.message); }
  }

  function onStoreSaved(updated) {
    setStores(p => p.map(s => s.id === updated.id
      ? { ...s, ...updated, gads_linked: !!updated.gads_customer_id }
      : s));
    setSuccess(`${updated.name} updated.`);
  }

  // Detect markets covered by more than one active store
  const activeStores = stores.filter(s => s.active);
  const marketCount = {};
  for (const s of activeStores) {
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
        <div style={{ display: 'flex', gap: 9 }}>
          <Btn onClick={syncAllStores} disabled={syncingAll || activeStores.length === 0} variant="ghost">
            {syncingAll && <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--brand)', borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />}
            {syncingAll ? 'Syncing all…' : 'Sync all stores'}
          </Btn>
          <Btn onClick={() => setConnect(true)} variant="primary">Connect Store</Btn>
        </div>
      </div>

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1280, margin: '0 auto', width: '100%' }}>
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

        {/* One-time Google Ads OAuth credentials */}
        <GadsCredentialsBlock cfg={gadsCfg} onSaved={loadGadsCfg} />

        {/* Connected stores */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--b1)', fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>
            Connected stores ({activeStores.length})
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
                  {['Store', 'Domain', 'Status', 'Markets', 'Currency', 'Connected', ''].map(h => (
                    <th key={h} style={{ padding: '8px 20px', textAlign: 'left', fontSize: 9, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stores.map((s, i) => (
                  <tr key={s.id}
                    style={{ borderBottom: i < stores.length - 1 ? '1px solid var(--b1)' : 'none', opacity: s.active ? 1 : 0.55 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--s2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '11px 20px', fontWeight: 600, color: 'var(--t1)', fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {s.name}
                        {!s.active && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', background: 'var(--s3)', borderRadius: 5, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Disconnected</span>}
                      </div>
                    </td>
                    <td style={{ padding: '11px 20px', fontFamily: "'Fira Code', monospace", fontSize: 11, color: 'var(--t2)' }}>{s.shop_domain}</td>
                    <td style={{ padding: '11px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <StatusDot on={s.shopify_verified} label="Shopify" onText="Verified" offText="Not verified" />
                        <StatusDot on={s.gads_linked} label="Google Ads" onText="Active" offText={s.gads_connected ? 'Pick account' : 'Not connected'} />
                        {s.gads_connected && !s.gads_linked && (
                          <InlineGadsAccountPicker store={s} onPicked={(cid) => {
                            setStores(p => p.map(x => x.id === s.id ? { ...x, gads_customer_id: cid, gads_linked: true } : x));
                            setSuccess(`${s.name}: Google Ads account linked.`);
                          }} onError={setError} />
                        )}
                      </div>
                    </td>
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
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {s.active ? (
                          <>
                            <button onClick={() => syncStore(s.id, s.name)} disabled={syncingId === s.id}
                              style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #818CF8, #6366F1)', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', boxShadow: 'var(--sh-brand)', opacity: syncingId === s.id ? 0.7 : 1, transition: 'transform 0.1s', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                              onMouseEnter={e => { if (syncingId !== s.id) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                              {syncingId === s.id && <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />}
                              {syncingId === s.id ? 'Syncing…' : 'Sync'}
                            </button>
                            <button onClick={() => reconnect(s.id, s.name)} disabled={syncingId === s.id}
                              style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', transition: 'all 0.12s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--s3)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'var(--s1)'; }}>
                              Reconnect
                            </button>
                            <button onClick={() => setEditStore(s)}
                              style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', transition: 'all 0.12s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--s3)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'var(--s1)'; }}>
                              Edit
                            </button>
                            {s.gads_connected ? (
                              <button onClick={() => disconnectGads(s.id, s.name)}
                                style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', transition: 'all 0.12s', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--s3)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'var(--s1)'; }}>
                                <GadsGlyph /> Google Ads connected
                              </button>
                            ) : (
                              <button onClick={() => connectGads(s.id)} disabled={!gadsCfg?.ready || gadsConnecting === s.id}
                                style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #34A853, #1a7a3a)', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: gadsCfg?.ready ? 'pointer' : 'not-allowed', opacity: gadsCfg?.ready ? 1 : 0.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                title={gadsCfg?.ready ? '' : 'Enter the Google Ads API keys first (block above)'}>
                                <GadsGlyph light /> {gadsConnecting === s.id ? 'Opening…' : 'Connect Google Ads'}
                              </button>
                            )}
                            <button onClick={() => disconnect(s.id, s.name)}
                              style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', transition: 'all 0.12s' }}
                              onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.background = 'var(--red-bg)'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--t1)'; e.currentTarget.style.borderColor = 'var(--b2)'; e.currentTarget.style.background = 'var(--s1)'; }}>
                              Disconnect
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => reconnect(s.id, s.name)} disabled={syncingId === s.id}
                              style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #818CF8, #6366F1)', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', boxShadow: 'var(--sh-brand)', opacity: syncingId === s.id ? 0.7 : 1, transition: 'transform 0.1s', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                              onMouseEnter={e => { if (syncingId !== s.id) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                              {syncingId === s.id && <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />}
                              {syncingId === s.id ? 'Reconnecting…' : 'Reconnect'}
                            </button>
                            <button onClick={() => removePermanently(s.id, s.name)}
                              style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', transition: 'all 0.12s' }}
                              onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.background = 'var(--red-bg)'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--t1)'; e.currentTarget.style.borderColor = 'var(--b2)'; e.currentTarget.style.background = 'var(--s1)'; }}>
                              Delete permanently
                            </button>
                          </>
                        )}
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
