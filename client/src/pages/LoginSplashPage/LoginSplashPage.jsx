import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import styles from './LoginSplashPage.module.css';

const SSO_ERROR_MESSAGES = {
  domain_restricted: 'This Google account is not authorised. Please sign in with your @griffith.edu.au account.',
  inactive: 'Your account is inactive. Please contact an administrator.',
  no_email: 'Google did not return an email address. Please try again.',
  auth_failed: 'Sign-in failed. Please try again.',
  server_error: 'Something went wrong. Please try again.',
};

const GoogleIcon = () => (
  <svg className={styles.icon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const errorCode = searchParams.get('error');
    if (errorCode) {
      setLoginError(SSO_ERROR_MESSAGES[errorCode] ?? 'Sign-in failed. Please try again.');
      setSearchParams({}, { replace: true });
    }
  }, []);

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
          <GoogleIcon />
          <span>Sign in with Google</span>
        </button>

        <div className={styles.footer}>
          For Griffith University staff and students only.
        </div>
      </div>
    </div>
  );
};

export default LoginSplashPage;
