import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{children}</div>;
}

function Btn({ children, onClick, disabled, variant = 'ghost' }) {
  const styles = {
    primary: { background: 'linear-gradient(135deg, #818CF8, #6366F1)', color: '#fff', border: 'none', fontWeight: 700, boxShadow: 'var(--sh-brand)' },
    ghost: { background: 'var(--s1)', color: 'var(--t1)', border: '1px solid var(--b2)', fontWeight: 600 },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '9px 16px', borderRadius: 9, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 7, ...styles[variant],
    }}>{children}</button>
  );
}

export default function Settings() {
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState({ client_id: '', client_secret: '', developer_token: '', login_customer_id: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [params] = useSearchParams();

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (params.get('gads_connected')) { setMsg('Google Ads connected.'); window.history.replaceState({}, '', '/settings'); }
    const e = params.get('gads_error'); if (e) { setErr(decodeURIComponent(e)); window.history.replaceState({}, '', '/settings'); }
    load();
  }, []);

  async function load() {
    try {
      const c = await api.get('/api/google-ads/config');
      setCfg(c);
      setForm(f => ({ ...f, client_id: c.client_id || '', login_customer_id: c.login_customer_id || '' }));
    } catch (e) { setErr(e.message); }
  }

  async function saveCreds() {
    setSaving(true); setErr(null); setMsg(null);
    try {
      await api.post('/api/google-ads/config', form);
      setMsg('Credentials saved.');
      await load();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  }

  async function connect() {
    setErr(null);
    try {
      const { url } = await api.get('/api/google-ads/auth-url');
      window.location.href = url;
    } catch (e) { setErr(e.message); }
  }

  return (
    <div>
      <div style={{ padding: '24px 32px 20px', borderBottom: '1px solid var(--b1)' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--t1)' }}>Settings</div>
        <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>Connect Google Ads to track spend and ROAS per store and market.</div>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {msg && <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 9, padding: '10px 14px', fontSize: 12.5, color: 'var(--green)', fontWeight: 600 }}>{msg}</div>}
        {err && <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 9, padding: '10px 14px', fontSize: 12.5, color: 'var(--red)', fontWeight: 600 }}>{err}</div>}

        <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Google Ads</div>
            {cfg?.connected
              ? <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', background: 'var(--green-bg)', borderRadius: 6, padding: '4px 10px' }}>Connected</span>
              : <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', background: 'var(--s3)', borderRadius: 6, padding: '4px 10px' }}>Not connected</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><Label>OAuth Client ID</Label><input value={form.client_id} onChange={set('client_id')} placeholder="…apps.googleusercontent.com" style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }} /></div>
            <div><Label>OAuth Client Secret</Label><input type="password" value={form.client_secret} onChange={set('client_secret')} placeholder={cfg?.has_client_secret ? 'saved — paste to change' : 'GOCSPX-…'} style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Label>Developer Token</Label><input type="password" value={form.developer_token} onChange={set('developer_token')} placeholder={cfg?.has_developer_token ? 'saved — paste to change' : 'developer token'} style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }} /></div>
              <div><Label>MCC / Login Customer ID</Label><input value={form.login_customer_id} onChange={set('login_customer_id')} placeholder="123930783" style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }} /></div>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--t3)', lineHeight: 1.6 }}>
              Add the redirect URI <span style={{ fontFamily: "'Fira Code', monospace", color: 'var(--t2)' }}>{`${window.location.origin}/api/google-ads/callback`}</span> to your OAuth client in Google Cloud Console.
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Btn onClick={saveCreds} disabled={saving} variant="ghost">{saving ? 'Saving…' : 'Save credentials'}</Btn>
              <Btn onClick={connect} disabled={!cfg?.has_client_id} variant="primary">{cfg?.connected ? 'Reconnect Google Ads' : 'Connect Google Ads'}</Btn>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--t3)', lineHeight: 1.7 }}>
          After connecting, open each store on the <strong style={{ color: 'var(--t2)' }}>Stores</strong> page and set its Google Ads account ID (the customer ID, digits only). Spend is then pulled per store and per market on each sync, and ROAS is computed against Shopify revenue.
        </div>
      </div>
    </div>
  );
}
