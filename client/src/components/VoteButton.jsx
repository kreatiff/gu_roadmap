import { useState } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import styles from './VoteButton.module.css';

const VoteButton = ({ featureId, initialCount, initialVoted, onUpdate, large = false }) => {
  const { isAuthenticated, login } = useAuth();
  const [voted, setVoted] = useState(initialVoted);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleVote = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!isAuthenticated) {
      login();
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      if (voted) {
        await api(`/api/features/${featureId}/vote`, { method: 'DELETE' });
        setVoted(false);
        setCount(prev => prev - 1);
      } else {
        await api(`/api/features/${featureId}/vote`, { method: 'POST' });
        setVoted(true);
        setCount(prev => prev + 1);
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 600);
      }
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Voting failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const containerClass = [
    large ? styles.upvoteBoxLarge : styles.upvoteBox,
    voted ? styles.voted : '',
    isAnimating ? styles.animating : ''
  ].join(' ');

  return (
    <button 
      onClick={handleVote} 
      disabled={loading}
      className={containerClass}
      title={voted ? 'Remove Vote' : 'Upvote'}
    >
      <svg className={large ? styles.iconLarge : styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 15l-6-6-6 6"/>
      </svg>
      <span className={large ? styles.countLarge : styles.count}>{count}</span>
    </button>
  );
};

export default VoteButton;
