import { useState, useEffect } from 'react';
import { createUser, updateUser } from '../../../api/users';
import styles from './AdminUsersPage.module.css';

const InviteUserPanel = ({ isOpen, mode, user, onClose, onSuccess, currentUser }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [status, setStatus] = useState('active');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSelf = currentUser?.id === user?.id;

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && user) {
        setName(user.name || '');
        setEmail(user.email || '');
        setRole(user.role || 'user');
        setStatus(user.status || 'active');
        setPassword('');
        setError(null);
      } else {
        setName('');
        setEmail('');
        setRole('user');
        setStatus('active');
        setPassword('');
        setError(null);
      }
    }
  }, [user, mode, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail) {
      setError('Please fill in Name and Email.');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (mode === 'invite' && (!password || password.length < 8)) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === 'invite') {
        await createUser({
          name: trimmedName,
          email: trimmedEmail,
          role,
          password
        });
      } else {
        await updateUser(user.id, {
          name: trimmedName,
          role,
          status
        });
      }
      onSuccess();
    } catch (err) {
      setError(err.message || 'Operation failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{mode === 'invite' ? 'Invite New User' : 'Edit User Details'}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          {error && (
            <div className={styles.errorAlert}>
              <span className={styles.errorIcon}>⚠️</span>
              <span className={styles.errorMessage}>{error}</span>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="modal-name" className={styles.label}>Full Name</label>
            <input
              id="modal-name"
              type="text"
              className={styles.input}
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="modal-email" className={styles.label}>Email Address</label>
            <input
              id="modal-email"
              type="email"
              className={styles.input}
              placeholder="e.g. j.doe@griffith.edu.au"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
              disabled={isSubmitting || mode === 'edit'}
              required
            />
            {mode === 'edit' && (
              <span className={styles.inputHint}>Email address is Cosmos DB partition key and cannot be changed.</span>
            )}
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="modal-role" className={styles.label}>System Role</label>
              <select
                id="modal-role"
                className={styles.select}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={isSubmitting || isSelf}
              >
                <option value="user">User</option>
                <option value="admin">Administrator</option>
              </select>
              {isSelf && (
                <span className={styles.inputHint}>You cannot demote yourself.</span>
              )}
            </div>

            {mode === 'edit' && (
              <div className={styles.formGroup}>
                <label htmlFor="modal-status" className={styles.label}>Account Status</label>
                <select
                  id="modal-status"
                  className={styles.select}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={isSubmitting || isSelf}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                {isSelf && (
                  <span className={styles.inputHint}>You cannot deactivate yourself.</span>
                )}
              </div>
            )}
          </div>

          {mode === 'invite' && (
            <div className={styles.formGroup}>
              <label htmlFor="modal-password" className={styles.label}>Temporary Password</label>
              <input
                id="modal-password"
                type="password"
                className={styles.input}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
                disabled={isSubmitting}
                required
              />
            </div>
          )}

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.buttonPrimary}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : mode === 'invite' ? 'Send Invitation' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteUserPanel;
