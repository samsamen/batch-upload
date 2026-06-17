import { NavLink } from 'react-router-dom';
import { useTheme } from '../theme.jsx';

export default function Layout({ children }) {
  const { theme, toggle } = useTheme();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 210,
        flexShrink: 0,
        background: 'var(--s1)',
        borderRight: '1px solid var(--b1)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow)',
      }}>

        {/* Logo */}
        <div style={{
          padding: '20px 22px 18px',
          borderBottom: '1px solid var(--b1)',
        }}>
          <div style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--t1)',
            letterSpacing: '-0.01em',
          }}>
            BatchIQ
          </div>
          <div style={{
            fontSize: 9,
            color: 'var(--t3)',
            marginTop: 3,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            Product Intelligence
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 0' }}>
          <NavSection label="Overview">
            <NavItem to="/">Batches</NavItem>
          </NavSection>
          <NavSection label="Settings">
            <NavItem to="/stores">Stores</NavItem>
          </NavSection>
        </nav>

        {/* Footer */}
        <div style={{
          padding: '14px 22px',
          borderTop: '1px solid var(--b1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {/* Theme toggle */}
          <button
            onClick={toggle}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 10px',
              borderRadius: 6,
              background: 'var(--s2)',
              border: '1px solid var(--b1)',
              color: 'var(--t2)',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
              width: '100%',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--b2)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--b1)'}
          >
            <span>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
            <ToggleTrack active={theme === 'dark'} />
          </button>

          <div style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: 9,
            color: 'var(--t3)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            Sync 06:00 UTC
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {children}
      </main>
    </div>
  );
}

function NavSection({ label, children }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        padding: '10px 22px 4px',
        fontSize: 9,
        fontWeight: 700,
        color: 'var(--t3)',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        padding: '7px 22px',
        fontSize: 13,
        fontWeight: isActive ? 600 : 400,
        color: isActive ? 'var(--t1)' : 'var(--t2)',
        borderLeft: `2px solid ${isActive ? 'var(--gold)' : 'transparent'}`,
        background: isActive ? 'rgba(232,184,75,0.06)' : 'transparent',
        transition: 'all 0.1s',
      })}
    >
      {children}
    </NavLink>
  );
}

function ToggleTrack({ active }) {
  return (
    <div style={{
      width: 28,
      height: 16,
      borderRadius: 8,
      background: active ? 'var(--gold)' : 'var(--b2)',
      position: 'relative',
      transition: 'background 0.2s',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute',
        top: 2,
        left: active ? 14 : 2,
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}
