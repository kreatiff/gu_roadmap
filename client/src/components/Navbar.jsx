import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const { user, login, logout, isAdmin } = useAuth();

  return (
    <nav style={styles.nav}>
      <div className="container" style={styles.container}>
        <Link to="/" style={styles.logo}>
          <span style={styles.logoGu}>GU</span>
          <span style={styles.logoRoadmap}>ROADMAP</span>
        </Link>
        <div style={styles.actions}>
          {isAdmin && (
            <Link to="/admin" style={styles.adminBtn}>
              ADMIN PANEL
            </Link>
          )}
          {user ? (
            <div style={styles.userSection}>
              <span style={styles.userEmail}>{user.email}</span>
              <button onClick={logout} style={styles.logoutBtn}>
                LOGOUT
              </button>
            </div>
          ) : (
            <button onClick={login} style={styles.loginBtn}>
              SIGN IN
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

const styles = {
  nav: {
    height: '64px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid var(--border-color)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center'
  },
  container: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '1.25rem',
    fontWeight: '800',
    textDecoration: 'none',
    letterSpacing: '-0.02em'
  },
  logoGu: {
    color: 'var(--gu-red)'
  },
  logoRoadmap: {
    color: 'var(--text-primary)'
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-6)'
  },
  adminBtn: {
    fontSize: '0.75rem',
    fontWeight: '700',
    textDecoration: 'none',
    color: 'var(--gu-red)',
    border: '1.5px solid var(--gu-red)',
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
    transition: 'all 0.15s ease'
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-4)'
  },
  userEmail: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    fontWeight: '500'
  },
  logoutBtn: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    textDecoration: 'none',
    transition: 'color 0.15s ease'
  },
  loginBtn: {
    backgroundColor: 'var(--gu-red)',
    color: '#ffffff',
    padding: '8px 16px',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: '600'
  }
};

export default Navbar;
