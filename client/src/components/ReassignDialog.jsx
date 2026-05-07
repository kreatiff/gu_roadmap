import { useEffect } from 'react';
import dialogStyles from './ConfirmDialog.module.css';
import styles from './ReassignDialog.module.css';

const ReassignDialog = ({
  title,
  message,
  options,
  value,
  onChange,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
  isLoading = false
}) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return (
    <div className={dialogStyles.overlay} onClick={onCancel}>
      <div className={dialogStyles.dialog} onClick={e => e.stopPropagation()}>
        <h3 className={dialogStyles.title}>{title}</h3>
        <p className={dialogStyles.message}>{message}</p>
        <select
          className={styles.select}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className={dialogStyles.actions}>
          <button className={dialogStyles.cancelBtn} onClick={onCancel} disabled={isLoading}>
            {cancelText}
          </button>
          <button
            className={`${dialogStyles.confirmBtn} ${variant === 'danger' ? dialogStyles.danger : dialogStyles.primary}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReassignDialog;
