import React from 'react';
import type { SoftTheme } from '../../types';

interface MediaNotification {
  type: 'error' | 'success';
  message: string;
}

interface NotificationsProps {
  errorMessage?: string | null;
  successMessage?: string | null;
  mediaNotification?: MediaNotification | null;
  currentTheme: SoftTheme;
}

function Notifications({ errorMessage, successMessage, mediaNotification, currentTheme }: NotificationsProps) {
  return (
    <>
      {errorMessage && (
        <div
          className="anim-notification"
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            padding: '8px 16px',
            background: 'rgba(239, 68, 68, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'white',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
            maxWidth: '90%'
          }}
        >
          {'\u26A0\uFE0F'} {errorMessage}
        </div>
      )}
      {successMessage && (
        <div
          className="anim-notification"
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            padding: '8px 16px',
            background: `${currentTheme.primary}`,
            backdropFilter: 'blur(10px)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'white',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
            maxWidth: '90%'
          }}
        >
          {'\u2713'} {successMessage}
        </div>
      )}
      {mediaNotification && (
        <div
          className="anim-notification"
          style={{
            position: 'fixed',
            top: (errorMessage || successMessage) ? '60px' : '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            padding: '8px 16px',
            background: mediaNotification.type === 'success' ? `${currentTheme.primary}` : 'rgba(239, 68, 68, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'white',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
            maxWidth: '90%'
          }}
        >
          {mediaNotification.type === 'success' ? '\u2713' : '\u26A0\uFE0F'} {mediaNotification.message}
        </div>
      )}
    </>
  );
}

export default Notifications;
