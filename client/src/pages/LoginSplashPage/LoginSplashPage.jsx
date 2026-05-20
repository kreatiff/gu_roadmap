import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './LoginSplashPage.module.css';

const MicrosoftIcon = () => (
  <svg className={styles.icon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21">
    <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
    <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
    <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
  </svg>
);

const Spinner = () => (
  <svg className={styles.spinner} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle className={styles.spinnerTrack} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className={styles.spinnerArc} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const LoginSplashPage = () => {
  const { login, navigateToLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (loginError) setLoginError(null);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (loginError) setLoginError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Local validation
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setLoginError('Please enter both email and password.');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      setLoginError('Please enter a valid email address.');
      return;
    }

    setLoginError(null);
    setIsSubmitting(true);

    try {
      await login(trimmedEmail, password);
    } catch (err) {
      setLoginError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.content}>
        <div className={styles.brand}>
          <h1><span className={styles.logoGu}>GU</span> ROADMAP</h1>
          <p>Sign in to view features and propose your own ideas for campus technology.</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>Email Address</label>
            <input
              id="email"
              type="email"
              className={styles.input}
              placeholder="e.g. user@griffith.edu.au"
              value={email}
              onChange={handleEmailChange}
              disabled={isSubmitting}
              autoComplete="email"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <input
              id="password"
              type="password"
              className={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={handlePasswordChange}
              disabled={isSubmitting}
              autoComplete="current-password"
              required
            />
          </div>

          {loginError && (
            <div className={styles.errorAlert} role="alert">
              <span className={styles.errorIcon}>⚠️</span>
              <span className={styles.errorMessage}>{loginError}</span>
            </div>
          )}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner />
                <span>Signing In...</span>
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className={styles.divider}>
          <span className={styles.dividerLine}></span>
          <span className={styles.dividerText}>or</span>
          <span className={styles.dividerLine}></span>
        </div>

        <button
          type="button"
          className={styles.ssoButton}
          onClick={navigateToLogin}
          disabled={isSubmitting}
        >
          <MicrosoftIcon />
          <span>Sign in with Microsoft</span>
        </button>

        <div className={styles.footer}>
          For Griffith University staff and students only.
        </div>
      </div>
    </div>
  );
};

export default LoginSplashPage;
