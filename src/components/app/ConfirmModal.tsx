import React from 'react';
import type { MouseEvent } from 'react';
import type { SoftTheme } from '../../types';

interface ConfirmModalProps {
  isOpen: boolean;
  message?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  theme?: SoftTheme;
}

/**
 * ConfirmModal - Custom confirmation dialog with CSS animations
 */
function ConfirmModal({ isOpen, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', theme }: ConfirmModalProps) {
  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="anim-fade-in"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001
      }}
    >
      <div
        className="anim-fade-slide-down"
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
        }}
      >
        <p style={{
          margin: '0 0 24px 0',
          fontSize: '15px',
          lineHeight: '1.5',
          color: '#1f2937'
        }}>
          {message}
        </p>
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              background: 'white',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e: MouseEvent<HTMLButtonElement>) => {
              (e.target as HTMLButtonElement).style.background = '#f9fafb';
            }}
            onMouseOut={(e: MouseEvent<HTMLButtonElement>) => {
              (e.target as HTMLButtonElement).style.background = 'white';
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              background: theme?.primary || '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e: MouseEvent<HTMLButtonElement>) => {
              (e.target as HTMLButtonElement).style.opacity = '0.9';
            }}
            onMouseOut={(e: MouseEvent<HTMLButtonElement>) => {
              (e.target as HTMLButtonElement).style.opacity = '1';
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
