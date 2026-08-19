import { useEffect, useState } from 'react';
import RichTextEditor from '../RichTextEditor';
import dialogStyles from '../ConfirmDialog.module.css';
import styles from './RejectionReasonDialog.module.css';

/**
 * RejectionReasonDialog — prompts an admin for a "reason for not proceeding"
 * whenever an item moves into (or already sits in) a stage flagged as a
 * rejection stage. Serves two flows via `mode`:
 *
 *   mode="move" — opened right after a drag/dropdown stage change. The move
 *     itself is already applied optimistically by the caller; Cancel undoes
 *     it, Skip commits the move with no reason, Save & Move commits it with
 *     the reason typed here.
 *
 *   mode="edit" — opened after the fact, on an item already sitting in a
 *     rejection stage, to add or change its reason without touching the
 *     stage. Prefilled from initialReason/initialPublic.
 */
const RejectionReasonDialog = ({
  mode = 'move',
  stageName,
  featureTitle,
  initialReason = '',
  initialPublic = false,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const [reason, setReason] = useState(initialReason);
  const [isPublic, setIsPublic] = useState(initialPublic);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const hasExistingReason = mode === 'edit' && initialReason && initialReason.trim() !== '';

  return (
    <div className={dialogStyles.overlay} onClick={onCancel}>
      <div className={`${dialogStyles.dialog} ${styles.dialog}`} onClick={(e) => e.stopPropagation()}>
        <h3 className={dialogStyles.title}>Reason for Not Proceeding</h3>
        <p className={dialogStyles.message}>
          {mode === 'move' ? (
            <>
              "{featureTitle}" is moving to <strong>{stageName}</strong>. Add a reason
              for not proceeding — it can be shown on the public roadmap, or kept
              internal.
            </>
          ) : (
            <>
              "{featureTitle}" is in <strong>{stageName}</strong>. Add or update the
              reason for not proceeding shown on the item's details.
            </>
          )}
        </p>

        <div className={styles.editorWrapper}>
          <RichTextEditor
            value={reason}
            onChange={setReason}
            placeholder="Explain why this item isn't moving forward..."
          />
        </div>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          Show this reason on the public roadmap
        </label>

        <div className={dialogStyles.actions}>
          <button className={dialogStyles.cancelBtn} onClick={onCancel} disabled={isLoading}>
            Cancel
          </button>
          {mode === 'move' && (
            <button
              className={`${dialogStyles.confirmBtn} ${dialogStyles.primary}`}
              onClick={() => onConfirm('', false)}
              disabled={isLoading}
            >
              Skip
            </button>
          )}
          {hasExistingReason && (
            <button
              className={`${dialogStyles.confirmBtn} ${dialogStyles.danger}`}
              onClick={() => onConfirm('', false)}
              disabled={isLoading}
            >
              Clear Reason
            </button>
          )}
          <button
            className={`${dialogStyles.confirmBtn} ${dialogStyles.primary}`}
            onClick={() => onConfirm(reason, isPublic)}
            disabled={isLoading}
          >
            {isLoading ? 'Saving…' : mode === 'move' ? 'Save & Move' : 'Save Reason'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RejectionReasonDialog;
