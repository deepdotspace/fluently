import React, { useState, useEffect } from 'react';
import { setToastCallback } from '../../utils/toast';

/**
 * ToastContainer - Displays toast notifications with CSS animations
 */
function ToastContainer({ theme }) {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setToastCallback((toastData) => {
      setToast(toastData);
      setTimeout(() => setToast(null), 3000);
    });
    return () => setToastCallback(null);
  }, []);

  const getBackgroundColor = (type) => {
    switch (type) {
      case 'error': return 'rgba(239, 68, 68, 0.95)';
      case 'success': return 'rgba(34, 197, 94, 0.95)';
      default: return 'rgba(59, 130, 246, 0.95)';
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'error': return '⚠️';
      case 'success': return '✓';
      default: return 'ℹ️';
    }
  };

  if (!toast) return null;

  return (
    <div
      key={toast.message}
      className="anim-toast"
      style={{
        position: 'fixed',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        padding: '12px 20px',
        background: getBackgroundColor(toast.type),
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        fontSize: '14px',
        color: 'white',
        fontWeight: '500',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        whiteSpace: 'nowrap',
        maxWidth: '90%'
      }}
    >
      {getIcon(toast.type)} {toast.message}
    </div>
  );
}

export default ToastContainer;
