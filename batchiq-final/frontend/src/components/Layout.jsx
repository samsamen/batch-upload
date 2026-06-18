import { NavLink } from 'react-router-dom';
import { useTheme } from '../theme.jsx';

export default function Layout({ children }) {
  const { theme, toggle } = useTheme();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <aside style={{
        width: 232, flexShrink: 0,
        background: 'var(--s1)',
        borderRight: '1px solid var(--b1)',
        display: 'flex', flexDirection: 'column',
        position: 'relative', zIndex: 2,
      }}>
        {/* Brand */}
        <div style={{ padding: '22px 20px 20px', display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'linear-gradient(135deg, #818CF8 0%, #6366F1 100%)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            gap: 2, padding: '7px 6px', boxShadow: 'var(--sh-brand)',
          }}>
            <span style={{ width: 3.5, height: 8,  background: 'rgba(255,255,255,0.7)', borderRadius: 2 }} />
            <span style={{ width: 3.5, height: 13, background: 'rgba(255,255,255,0.85)', borderRadius: 2 }} />
            <span style={{ width: 3.5, height: 18, background: '#fff', borderRadius: 2 }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.02em' }}>
              BatchIQ
            </div>
            <div style={{ fontSize: 9, color: 'var(--t3)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1 }}>
              Intelligence
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--b1)', margin: '0 20px' }} />

        {/* Nav */}
        <nav style={{ flex: 1, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SectionLabel>Workspace</SectionLabel>
          <NavItem to="/" icon={<IconGrid />}>Batches</NavItem>
          <NavItem to="/research" icon={<IconBulb />}>Research</NavItem>
          <NavItem to="/activity" icon={<IconActivity />}>Activity</NavItem>
          <SectionLabel>Configure</SectionLabel>
          <NavItem to="/stores" icon={<IconStore />}>Stores</NavItem>
        </nav>

        {/* Footer */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--b1)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={toggle} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 11px', borderRadius: 9, background: 'var(--s2)',
            border: '1px solid var(--b1)', color: 'var(--t2)', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s', width: '100%',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--s3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--s2)'; }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {theme === 'dark' ? <IconMoon /> : <IconSun />}
              {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
            <Toggle active={theme === 'dark'} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }} />
            <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: "'Fira Code', monospace", letterSpacing: '0.02em' }}>
              Sync 06:00 UTC
            </span>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg-grad)' }}>
        {children}
      </main>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ padding: '12px 14px 5px', fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.11em' }}>
      {children}
    </div>
  );
}

function NavItem({ to, icon, children }) {
  return (
    <NavLink to={to} style={({ isActive }) => ({
      display: 'flex', alignItems: 'center', gap: 11,
      padding: '9px 12px', borderRadius: 9, fontSize: 13.5,
      fontWeight: isActive ? 700 : 500,
      color: isActive ? 'var(--brand)' : 'var(--t2)',
      background: isActive ? 'var(--brand-l)' : 'transparent',
      transition: 'all 0.13s', position: 'relative',
    })}>
      {({ isActive }) => (
        <>
          <span style={{ display: 'flex', color: isActive ? 'var(--brand)' : 'var(--t3)', transition: 'color 0.13s' }}>{icon}</span>
          {children}
        </>
      )}
    </NavLink>
  );
}

function Toggle({ active }) {
  return (
    <div style={{ width: 30, height: 17, borderRadius: 9, background: active ? 'var(--brand)' : 'var(--b3)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2, left: active ? 15 : 2, width: 13, height: 13, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </div>
  );
}

const IconGrid = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>
);
const IconStore = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 6.5V13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M1.5 4.2 2.6 2.3a1 1 0 0 1 .87-.5h9.06a1 1 0 0 1 .87.5l1.1 1.9a2 2 0 0 1-3.5 1.9 2 2 0 0 1-3.46 0 2 2 0 0 1-3.46 0 2 2 0 0 1-3.5-1.9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
);
const IconBulb = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 13h4M6.5 11h3M5 7.5a3 3 0 1 1 6 0c0 1.2-.7 2-1.3 2.6-.4.4-.7.7-.7 1.4h-2c0-.7-.3-1-.7-1.4C5.7 9.5 5 8.7 5 7.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
);
const IconActivity = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.5 8h3l1.5-4.5L9 12l1.5-4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const IconSun = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.9 3.1l-1 1M4.1 11.9l-1 1M12.9 12.9l-1-1M4.1 4.1l-1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
);
const IconMoon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
);
