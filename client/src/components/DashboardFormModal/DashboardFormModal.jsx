import { useEffect, useState, useRef, useCallback } from 'react';
import TagAutocomplete from '../TagAutocomplete/TagAutocomplete';
import MultiSelectFilter from '../MultiSelectFilter/MultiSelectFilter';
import styles from './DashboardFormModal.module.css';

const DashboardFormModal = ({ isOpen, onClose, onSubmit, dashboard = null, categories = [], stages = [], availableTags = [] }) => {
  const isEditing = Boolean(dashboard);
  const modalRef = useRef(null);
  const firstErrorRef = useRef(null);

  const [form, setForm] = useState({
    name: '',
    tags: [],
    category_ids: [],
    stage_slugs: [],
    password: '',
    passwordConfirm: ''
  });
  const [editingProtected, setEditingProtected] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setErrors({});
      setSubmitting(false);
      if (dashboard) {
        setForm({
          name: dashboard.name,
          tags: dashboard.filters?.tags ?? [],
          category_ids: dashboard.filters?.category_ids ?? (dashboard.filters?.category_id ? [dashboard.filters.category_id] : []),
          stage_slugs: dashboard.filters?.stage_slugs ?? (dashboard.filters?.stage_slug ? [dashboard.filters.stage_slug] : []),
          password: '',
          passwordConfirm: ''
        });
        setEditingProtected(dashboard.is_protected === true);
        setPasswordTouched(false);
      } else {
        setForm({
          name: '',
          tags: [],
          category_ids: [],
          stage_slugs: [],
          password: '',
          passwordConfirm: ''
        });
        setEditingProtected(false);
        setPasswordTouched(false);
      }
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, dashboard]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  // Basic focus trap
  useEffect(() => {
    if (!isOpen) return;
    const modal = modalRef.current;
    if (!modal) return;

    const focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTab);
    // Focus first input after animation
    const timer = setTimeout(() => {
      const nameInput = modal.querySelector('input[name="name"]');
      if (nameInput) nameInput.focus();
    }, 100);

    return () => {
      document.removeEventListener('keydown', handleTab);
      clearTimeout(timer);
    };
  }, [isOpen]);

  const validate = useCallback(() => {
    const nextErrors = {};
    if (!form.name.trim()) {
      nextErrors.name = 'Dashboard name is required';
    }
    if (form.password && form.password !== form.passwordConfirm) {
      nextErrors.passwordConfirm = 'Passwords do not match';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [form.name, form.password, form.passwordConfirm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      // Focus first error field
      setTimeout(() => {
        firstErrorRef.current?.focus();
      }, 0);
      return;
    }

    const payload = {
      name: form.name.trim(),
      filters: {
        tags: form.tags,
        category_ids: form.category_ids.length > 0 ? form.category_ids : null,
        stage_slugs: form.stage_slugs.length > 0 ? form.stage_slugs : null
      },
      password: isEditing
        ? (passwordTouched ? form.password : undefined)
        : (form.password || undefined)
    };

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) onClose();
  };

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (field === 'password' || field === 'passwordConfirm') {
      if (isEditing) setPasswordTouched(true);
    }
  };

  if (!isOpen) return null;

  const slugPreview = form.name
    ? '/' + form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : '/your-dashboard';

  return (
    <div className={styles.overlay} onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="dashboard-modal-title">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} ref={modalRef}>
        <button className={styles.closeBtn} onClick={handleClose} aria-label="Close" disabled={submitting} type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.closeIcon} aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
          <h2 id="dashboard-modal-title" className={styles.modalTitle}>{isEditing ? 'Edit Dashboard' : 'Create New Dashboard'}</h2>
          <p className={styles.modalSubtitle}>
            {isEditing
              ? 'Update the filters, name, or password for this dashboard preset.'
              : 'Configure filters and an optional password to create a shareable dashboard view.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          {/* Name & Slug Preview */}
          <div className={styles.formGroup}>
            <label htmlFor="dashboard-name" className={styles.label}>
              Dashboard Name
            </label>
            <input
              id="dashboard-name"
              name="name"
              type="text"
              placeholder="e.g. OSU Roadmap, VLE Updates…"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
              spellCheck={false}
              autoComplete="off"
              ref={errors.name ? firstErrorRef : null}
            />
            {errors.name && <span className={styles.errorText} role="alert">{errors.name}</span>}
            {!isEditing && form.name && (
              <span className={styles.slugPreview}>URL will be: <code>{slugPreview}</code></span>
            )}
          </div>

          {/* Filters Section */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Filters</legend>
            <p className={styles.fieldsetHelp}>Choose which features appear on this dashboard. Leave all empty to show everything.</p>
            <div className={styles.filterStack}>
              <div className={styles.filterGroup}>
                <label htmlFor="dashboard-tags" className={styles.filterLabel}>Tags</label>
                <div id="dashboard-tags">
                  <TagAutocomplete
                    selected={form.tags}
                    onChange={(tags) => updateField('tags', tags)}
                    suggestions={availableTags}
                  />
                </div>
              </div>

              <div className={styles.filterGroup}>
                <label htmlFor="dashboard-categories" className={styles.filterLabel}>Categories</label>
                <div id="dashboard-categories">
                  <MultiSelectFilter
                    options={categories.map(c => ({ id: c.id, label: c.name }))}
                    selectedValues={form.category_ids}
                    onChange={(ids) => updateField('category_ids', ids)}
                  />
                </div>
              </div>

              <div className={styles.filterGroup}>
                <label htmlFor="dashboard-stages" className={styles.filterLabel}>Stages</label>
                <div id="dashboard-stages">
                  <MultiSelectFilter
                    options={stages.map(s => ({ id: s.slug, label: s.name }))}
                    selectedValues={form.stage_slugs}
                    onChange={(slugs) => updateField('stage_slugs', slugs)}
                  />
                </div>
              </div>
            </div>
          </fieldset>

          {/* Password Section */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Access Control</legend>
            {isEditing && editingProtected && !passwordTouched && (
              <div className={styles.infoBanner} role="status">
                <svg className={styles.infoIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>This dashboard is currently password protected. Type a new password below to replace it, or leave both fields empty to remove protection.</span>
              </div>
            )}
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="dashboard-password" className={styles.label}>
                  Password <span className={styles.optional}>— optional</span>
                </label>
                <input
                  id="dashboard-password"
                  name="password"
                  type="password"
                  placeholder={isEditing && editingProtected && !passwordTouched ? 'Enter new password to change…' : 'Leave blank for public access…'}
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className={styles.input}
                  autoComplete="new-password"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="dashboard-password-confirm" className={styles.label}>
                  Confirm Password
                </label>
                <input
                  id="dashboard-password-confirm"
                  name="passwordConfirm"
                  type="password"
                  placeholder="Re-enter password…"
                  value={form.passwordConfirm}
                  onChange={(e) => updateField('passwordConfirm', e.target.value)}
                  className={`${styles.input} ${errors.passwordConfirm ? styles.inputError : ''}`}
                  autoComplete="off"
                  ref={errors.passwordConfirm ? firstErrorRef : null}
                />
                {errors.passwordConfirm && <span className={styles.errorText} role="alert">{errors.passwordConfirm}</span>}
              </div>
            </div>
          </fieldset>

          {/* Actions */}
          <div className={styles.formActions}>
            <button type="submit" className={styles.buttonPrimary} disabled={submitting}>
              {submitting ? (
                <>
                  <span className={styles.spinnerInline} aria-hidden="true"></span>
                  {isEditing ? 'Updating…' : 'Creating…'}
                </>
              ) : (
                isEditing ? 'Update Dashboard' : 'Create Dashboard'
              )}
            </button>
            <button type="button" onClick={handleClose} className={styles.buttonSecondary} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default DashboardFormModal;
