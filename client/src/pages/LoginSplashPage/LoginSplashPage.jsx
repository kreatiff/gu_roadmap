import { useAuth } from '../../contexts/AuthContext';
import styles from './LoginSplashPage.module.css';

const LoginSplashPage = () => {
  const { login } = useAuth();

  return (
    <div className={styles.pageContainer}>
      <div className={styles.content}>
        <div className={styles.brand}>
          <h1><span>GU</span> ROADMAP</h1>
          <p>Sign in to view features and propose your own ideas for campus technology.</p>
        </div>
        <button className={styles.button} onClick={login}>
          <svg className={styles.icon} viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
          Sign In with University SSO
        </button>
        <div className={styles.footer}>
          For Griffith University staff and students only.
        </div>
      </div>
    </div>
  );
};

export default LoginSplashPage;
