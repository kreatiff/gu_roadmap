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
          <MicrosoftIcon />
          Sign in with Microsoft
        </button>
        <div className={styles.footer}>
          For Griffith University staff and students only.
        </div>
      </div>
    </div>
  );
};

export default LoginSplashPage;
