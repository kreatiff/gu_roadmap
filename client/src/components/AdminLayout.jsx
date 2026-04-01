import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const menuItems = [
    { path: '/admin', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { path: '/admin/sections', label: 'Sections', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
    { path: '/admin/stages', label: 'Stages', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { path: '/', label: 'Public View', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' }
  ];

  return (
    <div style={styles.adminContainer}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <h2 style={styles.brandTitle}>Admin Portal</h2>
          <p style={styles.brandSubtitle}>Feature Management</p>
        </div>

        <nav style={styles.nav}>
          {menuItems.map((item) => (
            <Link 
              key={item.path} 
              to={item.path} 
              style={{
                ...styles.navItem,
                backgroundColor: location.pathname === item.path ? '#f3f4f6' : 'transparent',
                color: location.pathname === item.path ? 'var(--gu-red)' : 'var(--text-secondary)'
              }}
            >
              <svg style={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <button onClick={logout} style={styles.logoutBtn}>
            <svg style={styles.logoutIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={styles.mainContent}>
         {children}
      </main>
    </div>
  );
};

const styles = {
  adminContainer: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#ffffff'
  },
  sidebar: {
    width: '260px',
    borderRight: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    top: 0,
    bottom: 0,
    backgroundColor: '#ffffff'
  },
  brand: {
    padding: 'var(--space-10) var(--space-8)',
    borderBottom: '1px solid var(--border-color)'
  },
  brandTitle: {
    fontSize: '1.25rem',
    fontWeight: '800',
    letterSpacing: '-0.02em',
    color: 'var(--text-primary)'
  },
  brandSubtitle: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
    marginTop: '2px'
  },
  nav: {
    flex: 1,
    padding: 'var(--space-4)'
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-3) var(--space-4)',
    borderRadius: 'var(--radius-md)',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: '600',
    marginBottom: '4px',
    transition: 'all 0.15s ease'
  },
  navIcon: {
    width: '18px',
    height: '18px'
  },
  sidebarFooter: {
    padding: 'var(--space-6)',
    borderTop: '1px solid var(--border-color)'
  },
  logoutBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-3) var(--space-4)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    fontWeight: '600',
    transition: 'background-color 0.15s ease'
  },
  logoutIcon: {
    width: '18px',
    height: '18px'
  },
  mainContent: {
    flex: 1,
    marginLeft: '260px',
    backgroundColor: '#f9fafb',
    minHeight: '100vh'
  }
};

export default AdminLayout;
