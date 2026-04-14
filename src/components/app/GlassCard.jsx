import React from 'react';

const GlassCard = React.memo(({ children, style = {}, theme, opaque = false }) => {
  return (
    <div
      style={{
        background: opaque ? '#ffffff' : theme.cardBg,
        backdropFilter: opaque ? 'none' : `blur(${theme.backdropBlur})`,
        WebkitBackdropFilter: opaque ? 'none' : `blur(${theme.backdropBlur})`,
        border: `1px solid ${theme.cardBorder}`,
        borderRadius: '24px',
        padding: '36px',
        boxShadow: opaque ? '0 20px 60px rgba(0, 0, 0, 0.3)' : '0 8px 32px rgba(0, 0, 0, 0.06)',
        ...style
      }}
    >
      {children}
    </div>
  );
});

GlassCard.displayName = 'GlassCard';

export default GlassCard;

