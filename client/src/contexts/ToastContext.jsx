import { createContext, useContext, useState, useCallback } from 'react';
import styles from './ToastContext.module.css';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
    setToasts(prev => [...prev, { id, message, type }]);

    // Auto dismiss after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast Container */}
      <div className={styles.container}>
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`${styles.toast} ${toast.type === 'error' ? styles.error : ''} ${toast.type === 'success' ? styles.success : ''}`}
          >
            <div className={styles.message}>{toast.message}</div>
            <button onClick={() => removeToast(toast.id)} className={styles.closeBtn}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};
