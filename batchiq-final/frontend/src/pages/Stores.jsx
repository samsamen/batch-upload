import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, startShopifyOAuth, fmtDate } from '../api.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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
    primary: { background: 'var(--gold)', color: '#0E0F14', border: 'none', fontWeight: 700 },
    ghost:   { background: 'transparent', color: 'var(--t2)', border: '1px solid var(--b2)', fontWeight: 500 },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '7px 14px', borderRadius: 4, fontSize: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--sans)', opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.1s', ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

function CopyField({ value }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'var(--bg)', border: '1px solid var(--b1)',
      borderRadius: 4, padding: '7px 12px',
    }}>
      <code style={{
        flex: 1, fontFamily: 'var(--mono)', fontSize: 11,
        color: 'var(--t1)', wordBreak: 'break-all',
      }}>
        {value}
      </code>
      <button
        onClick={handleCopy}
        style={{
          fontFamily: 'var(--mono)', fontSize: 9, textTransform: 'uppercase',
          letterSpacing: '0.08em', fontWeight: 500,
          color: copied ? 'var(--green)' : 'var(--t2)',
          background: 'none',
          border: '1px solid ' + (copied ? 'rgba(56,217,138,0.3)' : 'var(--b2)'),
          borderRadius: 3, padding: '2px 8px', cursor: 'pointer',
          transition: 'all 0.15s', flexShrink: 0,
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export default function Stores() {
  const [stores, setStores]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [shopDomain, setShopDomain]   = useState('');
  const [connecting, setConnecting]   = useState(false);
  const [error, setError]             = useState(null);
  const [successMsg, setSuccessMsg]   = useState(null);
  const [searchParams]                = useSearchParams();

  // Shopify keys config (stored in Supabase)
  const [cfg, setCfg]                 = useState({ shopify_client_id: '', app_url: '', has_secret: false });
  const [cfgForm, setCfgForm]         = useState({ shopify_client_id: '', shopify_client_secret: '', app_url: '' });
  const [savingCfg, setSavingCfg]     = useState(false);
  const [cfgSaved, setCfgSaved]       = useState(false);

  useEffect(() => {
    const connected = searchParams.get('connected');
    if (connected) {
      setSuccessMsg(`${decodeURIComponent(connected)} connected successfully.`);
      window.history.replaceState({}, '', '/stores');
    }
    load();
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const data = await api.get('/api/config');
      setCfg(data);
      setCfgForm({
        shopify_client_id: data.shopify_client_id || '',
        shopify_client_secret: '',
        app_url: data.app_url || window.location.origin,
      });
    } catch (err) { /* config table may not exist yet */ }
  }

  async function saveConfig() {
    setSavingCfg(true);
    setError(null);
    try {
      await api.patch('/api/config', cfgForm);
      setCfgSaved(true);
      setTimeout(() => setCfgSaved(false), 2500);
      await loadConfig();
    } catch (err) { setError(err.message); }
    finally { setSavingCfg(false); }
  }

  async function load() {
    try { setLoading(true); setStores(await api.get('/api/stores')); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  function handleConnect() {
    if (!shopDomain.trim()) return;
    setConnecting(true);
    let domain = shopDomain.trim().replace(/https?:\/\//, '').replace(/\/$/, '');
    if (!domain.includes('.myshopify.com')) domain = `${domain}.myshopify.com`;
    startShopifyOAuth(domain);
  }

  async function handleDisconnect(id, name) {
    if (!confirm(`Disconnect ${name}?`)) return;
    try { await api.delete(`/api/stores/${id}`); setStores(prev => prev.filter(s => s.id !== id)); }
    catch (err) { setError(err.message); }
  }

  return (
    <div>
      {/* Page header */}
      <div style={{
        padding: '24px 32px 20px',
        borderBottom: '1px solid var(--b1)',
      }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--t1)' }}>Stores</div>
        <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>
          Connect each Shopify store once. BatchIQ syncs order data automatically.
        </div>
      </div>

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860 }}>

        {/* Feedback banners */}
        {successMsg && (
          <div style={{
            background: 'rgba(56,217,138,0.06)', border: '1px solid rgba(56,217,138,0.2)',
            borderRadius: 4, padding: '10px 14px', fontSize: 12, color: 'var(--green)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            {successMsg}
            <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', color: 'var(--green)', fontSize: 16 }}>×</button>
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(239,80,80,0.06)', border: '1px solid rgba(239,80,80,0.2)',
            borderRadius: 4, padding: '10px 14px', fontSize: 12, color: 'var(--red)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            {error}
            <button onClick={() => setError(null)} style={{ background: 'none', color: 'var(--red)', fontSize: 16 }}>×</button>
          </div>
        )}

        {/* Shopify keys — stored in Supabase */}
        <div style={{
          background: 'var(--s1)', border: '1px solid var(--b1)',
          borderRadius: 5, padding: 20,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>
            Shopify app keys
          </div>
          <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 16 }}>
            Create a Custom App at partners.shopify.com, then paste the keys here. Stored securely in your database.
          </div>

          {/* The URLs to paste into Shopify Partners */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            <div>
              <Label>App URL — paste this into your Shopify app</Label>
              <CopyField value={cfgForm.app_url || window.location.origin} />
            </div>
            <div>
              <Label>Redirect URL — paste this into your Shopify app</Label>
              <CopyField value={`${cfgForm.app_url || window.location.origin}/api/shopify/callback`} />
            </div>
            <div>
              <Label>Required scopes</Label>
              <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold)' }}>
                read_orders, read_products
              </code>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--b1)', margin: '4px 0 18px' }} />

          {/* The keys to enter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Label>Client ID</Label>
              <input
                placeholder="paste Client ID from Shopify"
                value={cfgForm.shopify_client_id}
                onChange={e => setCfgForm(f => ({ ...f, shopify_client_id: e.target.value }))}
                style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
              />
            </div>
            <div>
              <Label>Client Secret {cfg.has_secret && '(saved — leave blank to keep)'}</Label>
              <input
                type="password"
                placeholder={cfg.has_secret ? '••••••••••••' : 'paste Client Secret from Shopify'}
                value={cfgForm.shopify_client_secret}
                onChange={e => setCfgForm(f => ({ ...f, shopify_client_secret: e.target.value }))}
                style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <Btn onClick={saveConfig} disabled={savingCfg} variant="primary">
                {savingCfg ? 'Saving…' : cfgSaved ? 'Saved' : 'Save keys'}
              </Btn>
            </div>
          </div>
        </div>

        {/* Connect form */}
        <div style={{
          background: 'var(--s1)', border: '1px solid var(--b1)',
          borderRadius: 5, padding: 20,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', marginBottom: 14 }}>
            Connect a store
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              placeholder="emiyosuomi.myshopify.com"
              value={shopDomain}
              onChange={e => setShopDomain(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              style={{ flex: 1 }}
            />
            <Btn
              onClick={handleConnect}
              disabled={connecting || !shopDomain.trim()}
              variant="primary"
            >
              {connecting ? 'Redirecting…' : 'Connect via Shopify'}
            </Btn>
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 8 }}>
            You will be redirected to Shopify to approve access, then returned here automatically.
          </div>
        </div>

        {/* Stores list */}
        <div style={{
          background: 'var(--s1)', border: '1px solid var(--b1)',
          borderRadius: 5, overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 20px', borderBottom: '1px solid var(--b1)',
            fontSize: 12, fontWeight: 600, color: 'var(--t1)',
          }}>
            Connected stores ({stores.length})
          </div>

          {loading ? (
            <div style={{ padding: '32px 20px', color: 'var(--t3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
              Loading…
            </div>
          ) : stores.length === 0 ? (
            <div style={{ padding: '32px 20px', color: 'var(--t3)', fontSize: 12 }}>
              No stores connected yet.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--b1)' }}>
                  {['Store', 'Domain', 'Country', 'Currency', 'Connected', ''].map(h => (
                    <th key={h} style={{
                      padding: '8px 20px', textAlign: 'left',
                      fontSize: 9, fontWeight: 600, color: 'var(--t3)',
                      textTransform: 'uppercase', letterSpacing: '0.09em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stores.map((store, i) => (
                  <tr
                    key={store.id}
                    style={{ borderBottom: i < stores.length - 1 ? '1px solid var(--b1)' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--s2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '11px 20px', fontWeight: 600, color: 'var(--t1)', fontSize: 13 }}>
                      {store.name}
                    </td>
                    <td style={{ padding: '11px 20px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--t2)' }}>
                      {store.shop_domain}
                    </td>
                    <td style={{ padding: '11px 20px', fontSize: 12, color: 'var(--t2)' }}>
                      {store.country || '—'}
                    </td>
                    <td style={{ padding: '11px 20px', fontSize: 12, color: 'var(--t2)' }}>
                      {store.currency || 'EUR'}
                    </td>
                    <td style={{ padding: '11px 20px', fontSize: 11, color: 'var(--t2)', fontFamily: 'var(--mono)' }}>
                      {fmtDate(store.connected_at)}
                    </td>
                    <td style={{ padding: '11px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDisconnect(store.id, store.name)}
                        style={{
                          fontFamily: 'var(--mono)', fontSize: 9, textTransform: 'uppercase',
                          letterSpacing: '0.08em', color: 'var(--t3)', background: 'none',
                          border: '1px solid var(--b1)', borderRadius: 3, padding: '2px 8px',
                          cursor: 'pointer', transition: 'all 0.1s',
                        }}
                        onMouseEnter={e => { e.target.style.color = 'var(--red)'; e.target.style.borderColor = 'rgba(239,80,80,0.3)'; }}
                        onMouseLeave={e => { e.target.style.color = 'var(--t3)'; e.target.style.borderColor = 'var(--b1)'; }}
                      >
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
    </div>
  );
}

function SetupStep({ n, text, children }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 500,
          color: 'var(--t3)', flexShrink: 0, paddingTop: 1,
        }}>
          {n}.
        </span>
        <span style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>{text}</span>
      </div>
      {children && <div style={{ marginTop: 6, marginLeft: 18 }}>{children}</div>}
    </div>
  );
}
