import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from './Navbar.module.css';

const Navbar = () => {
  const { user, logout, isAdmin } = useAuth();

  return (
    <nav className={styles.nav}>
      <div className={`container ${styles.containerWrapper}`}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoGu}>GU</span>
          <span className={styles.logoRoadmap}>ROADMAP</span>
        </Link>
        <div className={styles.actions}>
          {isAdmin && (
            <Link to="/admin" className={styles.adminBtn}>
              ADMIN PANEL
            </Link>
          )}
          {user ? (
            <div className={styles.userSection}>
              <span className={styles.userEmail}>{user.email}</span>
              <button onClick={logout} className={styles.logoutBtn}>
                LOGOUT
              </button>
            </div>
          ) : (
            <Link to="/" className={styles.loginBtn}>
              SIGN IN
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
