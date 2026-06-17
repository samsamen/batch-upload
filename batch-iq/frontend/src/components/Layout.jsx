import { NavLink } from 'react-router-dom';

export default function Layout({ children }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: 192,
        flexShrink: 0,
        background: 'var(--s1)',
        borderRight: '1px solid var(--b1)',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Wordmark */}
        <div style={{
          padding: '22px 24px 20px',
          borderBottom: '1px solid var(--b1)',
        }}>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--t1)',
            letterSpacing: '0.01em',
          }}>
            BatchIQ
          </div>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 9,
            color: 'var(--t3)',
            marginTop: 3,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            Product Intelligence
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px 0' }}>
          <SectionLabel>Overview</SectionLabel>
          <NavItem to="/">Batches</NavItem>
          <SectionLabel>Settings</SectionLabel>
          <NavItem to="/stores">Stores</NavItem>
        </nav>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--b1)',
        }}>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 9,
            color: 'var(--t3)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            lineHeight: 1.7,
          }}>
            Auto-sync<br />06:00 UTC daily
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
        {children}
      </main>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      padding: '12px 24px 4px',
      fontSize: 9,
      fontWeight: 600,
      color: 'var(--t3)',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
    }}>
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
        gap: 10,
        padding: '7px 24px',
        fontSize: 13,
        fontWeight: isActive ? 600 : 400,
        color: isActive ? 'var(--t1)' : 'var(--t2)',
        borderLeft: isActive ? '2px solid var(--gold)' : '2px solid transparent',
        transition: 'color 0.1s, border-color 0.1s',
        background: isActive ? 'rgba(232,184,75,0.04)' : 'transparent',
      })}
    >
      {children}
    </NavLink>
  );
}
