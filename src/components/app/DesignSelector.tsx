import React, { useMemo } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { cardDesigns, getDesignCategories } from '../../utils/cardDesigns';
import type { CardDesign } from '../../utils/cardDesigns';
import LucideIcon from './LucideIcon';
import type { SoftTheme } from '../../types';

interface DesignSelectorProps {
  selectedDesignId?: string | null;
  onSelectDesign: (designId: string) => void;
  theme: SoftTheme;
}

/**
 * DesignSelector - Horizontal scrollable component for selecting card designs
 * Shows preview cards with design backgrounds and allows selection
 */
function DesignSelector({ selectedDesignId, onSelectDesign, theme }: DesignSelectorProps) {
  const categories = useMemo(() => getDesignCategories(), []);
  const designsByCategory = useMemo(() => {
    const grouped: Record<string, CardDesign[]> = {};
    categories.forEach(category => {
      grouped[category] = cardDesigns.filter(d => d.category === category);
    });
    return grouped;
  }, [categories]);

  return (
    <div>
      <div style={{
        fontSize: '16px',
        fontWeight: '600',
        color: theme.textPrimary,
        marginBottom: '16px'
      }}>
        Choose a Design
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {categories.map(category => (
          <div key={category}>
            <div style={{
              fontSize: '13px',
              fontWeight: '600',
              color: theme.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px',
              paddingLeft: '4px'
            }}>
              {category}
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              overflowX: 'auto',
              paddingTop: '8px',
              paddingBottom: '8px',
              scrollbarWidth: 'thin',
              scrollbarColor: `${theme.cardBorder} transparent`
            }}>
              {designsByCategory[category].map(design => (
                <DesignPreviewCard
                  key={design.id}
                  design={design}
                  isSelected={selectedDesignId === design.id}
                  onSelect={() => onSelectDesign(design.id)}
                  theme={theme}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface DesignPreviewCardProps {
  design: CardDesign;
  isSelected: boolean;
  onSelect: () => void;
  theme: SoftTheme;
}

/**
 * DesignPreviewCard - Individual design preview card
 */
function DesignPreviewCard({ design, isSelected, onSelect, theme }: DesignPreviewCardProps) {
  const previewStyle: CSSProperties = {
    background: design.preview.background || design.preview.backgroundColor || '#ffffff',
    backgroundColor: design.preview.backgroundColor,
    backgroundSize: design.preview.backgroundSize,
    color: design.preview.textColor || theme.textPrimary,
    border: design.preview.border || `1px solid ${theme.cardBorder}`
  };

  return (
    <div
      onClick={onSelect}
      style={{
        flexShrink: 0,
        width: '160px',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
    >
      <div style={{
        width: '160px',
        height: '100px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: isSelected
          ? `3px solid ${theme.primary}`
          : `2px solid ${isSelected ? theme.primary : theme.cardBorder}`,
        boxShadow: isSelected
          ? `0 4px 12px ${theme.primary}40`
          : '0 2px 8px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s',
        position: 'relative'
      }}
      onMouseEnter={(e: MouseEvent<HTMLDivElement>) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = theme.primary;
          e.currentTarget.style.boxShadow = `0 4px 12px ${theme.primary}30`;
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e: MouseEvent<HTMLDivElement>) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = theme.cardBorder;
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
      >
        {/* Design Preview */}
        <div style={{
          width: '100%',
          height: '100%',
          ...previewStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: '600',
          padding: '8px',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.7)',
            padding: '4px 8px',
            borderRadius: '6px',
            backdropFilter: 'blur(4px)',
            fontSize: '11px',
            fontWeight: '600',
            color: previewStyle.color
          }}>
            (FIELD NAME)
          </div>
        </div>

        {/* Selected Indicator */}
        {isSelected && (
          <div style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: theme.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 2px 8px ${theme.primary}60`
          }}>
            <LucideIcon name="Check" size={14} color="white" />
          </div>
        )}
      </div>

      {/* Design Name */}
      <div style={{
        marginTop: '8px',
        fontSize: '12px',
        fontWeight: '500',
        color: isSelected ? theme.primary : theme.textPrimary,
        textAlign: 'center',
        transition: 'color 0.2s'
      }}>
        {design.name}
      </div>
    </div>
  );
}

export default DesignSelector;
