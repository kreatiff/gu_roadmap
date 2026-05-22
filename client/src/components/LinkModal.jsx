import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink } from 'lucide-react';
import styles from './LinkModal.module.css';

const LinkModal = ({ isOpen, onClose, onSave, initialUrl = '' }) => {
  const [url, setUrl] = useState(initialUrl);
  const [urlError, setUrlError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setUrl(initialUrl);
      setUrlError('');
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, initialUrl]);

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!url.trim()) {
      setUrlError('');
      onSave('');
      return;
    }

    try {
      const parsed = new URL(url);
      const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
      if (!allowedProtocols.includes(parsed.protocol)) {
        setUrlError(`Links must use ${allowedProtocols.join(', ').replace(/:/g, '')} protocol.`);
        return;
      }
    } catch {
      setUrlError('Please enter a valid URL (e.g. https://example.com)');
      return;
    }

    setUrlError('');
    onSave(url.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose} onKeyDown={handleKeyDown}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={18} className={styles.closeIcon} />
        </button>

        <div className={styles.container}>
          <div className={styles.header}>
            <div className={styles.iconWrapper}>
              <ExternalLink size={20} className={styles.linkIcon} />
            </div>
            <h2 className={styles.title}>Insert Link</h2>
            <p className={styles.subtitle}>Enter the URL for the selected text.</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="link-url" className={styles.label}>Destination URL</label>
              <input
                id="link-url"
                ref={inputRef}
                type="text"
                className={styles.input}
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoComplete="off"
              />
              {urlError && (
                <p className={styles.error}>{urlError}</p>
              )}
              <p className={styles.help}>Tip: Links will open in a new tab automatically.</p>
            </div>

            <div className={styles.footer}>
              <button 
                type="button" 
                className={styles.cancelBtn} 
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className={styles.saveBtn}
                disabled={!url.trim()}
              >
                Save Link
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LinkModal;
