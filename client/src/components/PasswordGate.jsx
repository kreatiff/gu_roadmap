import React, { useState, useEffect } from 'react';
import styles from './PasswordGate.module.css';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';

/**
 * PasswordGate component to provide a simple barrier for the application.
 * Password: VLEROADMAP
 */
const PasswordGate = ({ children }) => {
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Check if user was previously authorized
    const authStatus = localStorage.getItem('roadmap_authorized');
    if (authStatus === 'true') {
      setIsAuthorized(true);
    }
    setLoading(false);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === 'VLEROADMAP') {
      localStorage.setItem('roadmap_authorized', 'true');
      setIsAuthorized(true);
      setError(false);
    } else {
      setError(true);
      // Reset error after animation
      setTimeout(() => setError(false), 500);
    }
  };

  if (loading) return null;

  if (isAuthorized) {
    return children;
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.iconWrapper}>
          <Lock className={styles.icon} />
        </div>
        
        <h1 className={styles.title}>Private Access</h1>
        <p className={styles.subtitle}>Enter the access key to view the Roadmap</p>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <input
              type={showPassword ? "text" : "password"}
              className={`${styles.input} ${error ? styles.error : ''}`}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {/* Optional: Add a toggle to show password if needed, but keeping it simple for now */}
          </div>
          
          <button type="submit" className={styles.submitBtn}>
            Continue to Roadmap
          </button>
          
          <div className={styles.errorMsg}>
            {error && "Incorrect access key. Please try again."}
          </div>
        </form>
        
        <footer className={styles.footer}>
          &copy; {new Date().getFullYear()} VLE Roadmap. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default PasswordGate;
