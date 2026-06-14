import React from 'react';
import type { ReactNode, CSSProperties } from 'react';
import type { SoftTheme } from '../../types';

interface GlassCardProps {
  children?: ReactNode;
  style?: CSSProperties;
  theme: SoftTheme;
  opaque?: boolean;
  // `flat` drops the per-card backdrop-filter blur in favor of a solid
  // translucent background. Use it on grids where many cards render at once
  // (stacked blur layers are expensive to composite); single-use glass
  // (modals) should keep the default frosted look.
  flat?: boolean;
}

const GlassCard = React.memo(({ children, style = {}, theme, opaque = false, flat = false }: GlassCardProps) => {
  return (
    <div
      style={{
        background: opaque ? '#ffffff' : flat ? 'rgba(255, 255, 255, 0.92)' : theme.cardBg,
        backdropFilter: opaque || flat ? 'none' : `blur(${theme.backdropBlur})`,
        WebkitBackdropFilter: opaque || flat ? 'none' : `blur(${theme.backdropBlur})`,
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
