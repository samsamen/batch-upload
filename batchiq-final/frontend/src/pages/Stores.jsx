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
    primary: { background: 'var(--gold)', color: '#0E0F14', border: 'none', fontWeight: 700 },
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
                background: 'rgba(239,80,80,0.08)', border: '1px solid rgba(239,80,80,0.25)',
                borderRadius: 5, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: 'var(--red)',
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

// ── Stores Page ───────────────────────────────────────────────────────────────
export default function Stores() {
  const [stores, setStores]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [successMsg, setSuccess]  = useState(null);
  const [showConnect, setConnect] = useState(false);
  const [config, setConfig]       = useState({ shopify_client_id: '', has_secret: false });
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

  async function disconnect(id, name) {
    if (!confirm(`Disconnect ${name}?`)) return;
    try { await api.delete(`/api/stores/${id}`); setStores(p => p.filter(s => s.id !== id)); }
    catch (err) { setError(err.message); }
  }

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
                  {['Store', 'Domain', 'Country', 'Currency', 'Connected', ''].map(h => (
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
                    <td style={{ padding: '11px 20px', fontSize: 12, color: 'var(--t2)' }}>{s.country || '—'}</td>
                    <td style={{ padding: '11px 20px', fontSize: 12, color: 'var(--t2)' }}>{s.currency || 'EUR'}</td>
                    <td style={{ padding: '11px 20px', fontSize: 11, color: 'var(--t2)', fontFamily: "'Fira Code', monospace" }}>{fmtDate(s.connected_at)}</td>
                    <td style={{ padding: '11px 20px', textAlign: 'right' }}>
                      <button onClick={() => disconnect(s.id, s.name)}
                        style={{ fontFamily: "'Fira Code', monospace", fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', background: 'none', border: '1px solid var(--b1)', borderRadius: 3, padding: '3px 9px', cursor: 'pointer', transition: 'all 0.1s' }}
                        onMouseEnter={e => { e.target.style.color = 'var(--red)'; e.target.style.borderColor = 'rgba(239,80,80,0.3)'; }}
                        onMouseLeave={e => { e.target.style.color = 'var(--t3)'; e.target.style.borderColor = 'var(--b1)'; }}>
                        Disconnect
                      </button>
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
    </div>
  );
}
