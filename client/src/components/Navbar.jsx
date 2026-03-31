import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const Navbar = () => {
  const { user, isAuthenticated, login, logout, isAdmin } = useAuth();

  return (
    <nav style={styles.nav}>
      <div className="container" style={styles.container}>
        <Link to="/" style={styles.logo}>
          <span style={styles.logoRed}>GU</span>
          <span style={styles.logoGold}> Roadmap</span>
        </Link>
        
        <div style={styles.actions}>
          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Link to="/admin" style={styles.adminBadge}>Admin Panel</Link>
              )}
              <span style={styles.userEmail}>{user.email}</span>
              <button onClick={logout} style={styles.buttonSecondary}>Logout</button>
            </>
          ) : (
            <button onClick={login} style={styles.buttonPrimary}>Sign In</button>
          )}
        </div>
      </div>
    </nav>
  );
};

const styles = {
  nav: {
    height: 'var(--space-16)',
    zIndex: 10,
    backgroundColor: 'var(--gu-black)',
    borderBottom: '2px solid var(--gu-red)', // Strong branding
    position: 'sticky',
    top: 0
  },
  container: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  logo: {
    fontSize: 'var(--space-6)',
    fontWeight: 'var(--font-weight-bold)',
    textTransform: 'uppercase',
    letterSpacing: '-1px'
  },
  logoRed: { color: 'var(--gu-red)' },
  logoGold: { color: 'var(--gu-gold)' },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-4)'
  },
  adminBadge: {
    backgroundColor: 'var(--gu-gold)',
    color: '#000',
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  userEmail: {
    color: 'var(--text-muted)',
    fontSize: '0.875rem'
  },
  buttonPrimary: {
    backgroundColor: 'var(--gu-red)',
    color: '#fff',
    padding: '0.5rem 1rem',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    border: '2px solid transparent'
  },
  buttonSecondary: {
    color: 'var(--gu-red)',
    padding: '0.5rem 1rem',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    border: '2px solid var(--gu-red)'
  }
};

export default Navbar;
