import { useState } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import styles from './VoteButton.module.css';

const VoteButton = ({ featureId, initialCount, initialVoted, onUpdate, large = false, accentColor, isCombined = false }) => {
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
      // Self-heal state when it's out of sync with the server
      if (err?.error === 'Already voted for this feature') {
        // POST returned 409 — we thought we hadn't voted, but we have
        setVoted(true);
        setCount(prev => prev + 1);
      } else if (err?.error === 'Vote not found or already removed') {
        // DELETE returned 404 — we thought we voted, but we haven't
        setVoted(false);
        setCount(prev => Math.max(0, prev - 1));
      } else {
        console.error('Voting failed:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const containerClass = [
    large ? styles.upvoteBoxLarge : styles.upvoteBox,
    voted ? styles.voted : '',
    isAnimating ? styles.animating : ''
  ].join(' ');

  const styleObj = accentColor ? { '--vote-accent': accentColor } : undefined;

  if (isCombined) {
    return (
      <div className={`${styles.combinedWrapper} ${voted ? styles.voted : ''}`} style={styleObj}>
        <button 
          onClick={handleVote} 
          disabled={loading}
          className={styles.combinedBtn}
          title={voted ? 'Remove Vote' : 'Upvote'}
        >
          <svg className={styles.iconCombined} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d={voted ? "M12 5v14M19 12l-7 7-7-7" : "M12 19V5M5 12l7-7 7 7"}/>
          </svg>
          <span className={styles.btnText}>{voted ? 'Undo' : 'Upvote'}</span>
        </button>
        <span className={styles.combinedCount}>{count}</span>
      </div>
    );
  }

  return (
    <button 
      onClick={handleVote} 
      disabled={loading}
      className={containerClass}
      title={voted ? 'Remove Vote' : 'Upvote'}
      style={styleObj}
    >
      <svg className={large ? styles.iconLarge : styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7"/>
      </svg>
      <span className={large ? styles.countLarge : styles.count}>{count}</span>
    </button>
  );
};

export default VoteButton;
