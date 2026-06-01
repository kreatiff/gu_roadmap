import React, { useEffect } from 'react';
import { Clock, X } from 'lucide-react';
import styles from './RevisionHistory.module.css';

const formatTime = (isoString) => {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-AU', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date);
};

// Map internal stage/category IDs to human names
const FieldMap = {
  title: 'Title',
  description: 'Description',
  category_id: 'Category',
  status: 'Status',
  stage_id: 'Stage',
  pinned: 'Pinned Status',
  tags: 'Tags',
  impact: 'Impact',
  effort: 'Effort',
  owner: 'Owner',
  key_stakeholder: 'Stakeholder',
  priority: 'Priority',
  is_published: 'Published Status',
  is_reviewed: 'Reviewed Status',
  internal_notes: 'Internal Notes',
  dependencies: 'Dependencies'
};

const RevisionHistory = ({ isOpen, onClose, revisions, categories = [], stages = [] }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || '(None)';
  const getStageName = (id) => stages.find(s => s.id === id)?.name || id;

  const renderChangeText = (fieldKey, changeObj) => {
    const fieldName = FieldMap[fieldKey] || fieldKey;
    
    if (changeObj.updated) {
      return <li>{fieldName} was updated</li>;
    }
    
    let { old, new: newVal } = changeObj;
    
    if (fieldKey === 'category_id') {
      old = getCategoryName(old);
      newVal = getCategoryName(newVal);
    } else if (fieldKey === 'stage_id') {
      old = getStageName(old);
      newVal = getStageName(newVal);
    } else if (typeof old === 'boolean') {
      old = old ? 'Yes' : 'No';
      newVal = newVal ? 'Yes' : 'No';
    }

    return <li>Changed {fieldName} from "{old}" to "{newVal}"</li>;
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            <Clock size={18} strokeWidth={2.3} className={styles.titleIcon} />
            Revision History
          </h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className={styles.content}>
          {!revisions || revisions.length === 0 ? (
            <div className={styles.emptyState}>No change history found for this feature.</div>
          ) : (
            <div className={styles.list}>
              {revisions.map(rev => {
                const isCreation = rev.changes?.action === 'created';
                const fields = rev.changes?.fields || {};
                
                return (
                  <div key={rev.id} className={styles.item}>
                    <div className={styles.meta}>
                      <span className={styles.user}>{rev.changed_by}</span>
                      <span>{formatTime(rev.changed_at)}</span>
                    </div>
                    <ul className={styles.changes}>
                      {isCreation ? (
                        <li>Feature was created</li>
                      ) : (
                        Object.keys(fields).map(field => (
                          <React.Fragment key={field}>
                            {renderChangeText(field, fields[field])}
                          </React.Fragment>
                        ))
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RevisionHistory;
