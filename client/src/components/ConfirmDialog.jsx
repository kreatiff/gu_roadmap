import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
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
          <AlertTriangle size={32} strokeWidth={2} />
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
