import { useState } from 'react';
import { Lock } from 'lucide-react';
import { unlockDashboard } from '../../api/dashboards';
import { setDashboardToken } from '../../utils/dashboardTokens';
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
      setDashboardToken(slug, token);
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
            <Lock size={48} strokeWidth={2} className={styles.lockIcon} />
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
