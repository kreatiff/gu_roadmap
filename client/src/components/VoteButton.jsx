import { useAuth } from '../contexts/AuthContext';

const VoteButton = ({ count, userVoted, onVote, onUnvote, loading }) => {
  const { isAuthenticated, login } = useAuth();

  const handleClick = (e) => {
    e.stopPropagation();
    if (!isAuthenticated) return login();
    
    if (userVoted) {
      onUnvote();
    } else {
      onVote();
    }
  };

  return (
    <button 
      onClick={handleClick} 
      disabled={loading}
      style={{
        ...styles.wrapper,
        borderColor: userVoted ? 'var(--gu-red)' : 'var(--border-color)',
        backgroundColor: userVoted ? 'var(--gu-red)' : 'transparent',
        color: userVoted ? '#fff' : 'var(--gu-red)'
      }}
    >
      <svg style={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M12 19V5M12 5L5 12M12 5L19 12" />
      </svg>
      <span style={styles.count}>{count}</span>
    </button>
  );
};

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '12px 8px',
    minWidth: 'var(--space-12)',
    border: '2px solid',
    borderRadius: 'var(--radius-sm)',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  icon: {
    width: 'var(--space-6)',
    height: 'var(--space-6)',
  },
  count: {
    fontSize: '1.125rem',
    fontWeight: 'var(--font-weight-bold)',
  }
};

export default VoteButton;
