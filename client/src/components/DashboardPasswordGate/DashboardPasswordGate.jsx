import { useState } from 'react';
import { unlockDashboard } from '../../api/dashboards';
import Navbar from '../Navbar';
import styles from './DashboardPasswordGate.module.css';

const DashboardPasswordGate = ({ slug, onUnlocked }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token } = await unlockDashboard(slug, password);
      sessionStorage.setItem(`dashboard_token_${slug}`, token);
      onUnlocked();
    } catch (err) {
      setError(err.error ?? 'Incorrect password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.gate}>
        <div className={styles.gateCard}>
          <div className={styles.iconWrapper}>
            <svg className={styles.lockIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2 className={styles.title}>Protected Dashboard</h2>
          <p className={styles.subtitle}>This roadmap is password protected. Please enter the password to view the contents.</p>
          
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password" 
                className={styles.input}
                autoFocus 
                autoComplete="off"
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? 'Verifying...' : 'Unlock Dashboard'}
            </button>
          </form>
        </div>
      </main>
      <footer className={styles.footer}>
        <div className="container">
          &copy; {new Date().getFullYear()} Griffith University — Roadmap
        </div>
      </footer>
    </div>
  );
};

export default DashboardPasswordGate;
