import { useEffect, useState } from 'react';
import styles from './ConfirmDialog.module.css';

/**
 * ConfirmDialog — general-purpose confirmation modal.
 *
 * Props:
 *   confirmWord  {string}  Optional. When provided, the user must type this
 *                          exact word before the confirm button becomes active.
 *                          Use for destructive/irreversible actions.
 */
const ConfirmDialog = ({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
  isLoading = false,
  confirmWord = null,
}) => {
  const [typed, setTyped] = useState('');
  const wordMatch = confirmWord ? typed === confirmWord : true;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.iconWrap}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>

        {confirmWord && (
          <div className={styles.typeConfirm}>
            <label className={styles.typeLabel}>
              Type <strong>{confirmWord}</strong> to confirm
            </label>
            <input
              className={`${styles.typeInput} ${typed && !wordMatch ? styles.typeInputError : ''}`}
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={confirmWord}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel} disabled={isLoading}>{cancelText}</button>
          <button
            className={`${styles.confirmBtn} ${variant === 'danger' ? styles.danger : styles.primary}`}
            onClick={onConfirm}
            disabled={isLoading || !wordMatch}
          >
            {isLoading ? 'Processing…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
