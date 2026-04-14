import React from 'react';
import LucideIcon from './LucideIcon';

/**
 * CardTypeOptionSelector - Visual selection for card type options within CardTypeEditor
 * 
 * Used ONLY inside CardTypeEditor dialog to choose between:
 * - Basic: Single direction (Front → Back)
 * - Basic + Reversed: Bidirectional (Front ⇄ Back, creates 2 cards)
 * - Cloze: Fill-in-the-blank style
 * 
 * Note: This is different from CardTypeSelector which is used for selecting existing card types
 */
function CardTypeOptionSelector({ value, onChange, theme }) {
  const cardTypes = [
    {
      id: 'basic',
      icon: 'Book',
      name: 'Basic',
      description: 'One-way card',
      diagram: 'Front → Back',
      reversible: false,
      isCloze: false
    },
    {
      id: 'basic-reversed',
      icon: 'Repeat',
      name: 'Basic + Reversed',
      description: 'Creates 2 cards',
      diagram: 'Front ⇄ Back',
      reversible: true,
      isCloze: false
    },
    {
      id: 'cloze',
      icon: 'Pencil',
      name: 'Cloze',
      description: 'Fill-in-the-blank',
      diagram: 'Text with {{gaps}}',
      reversible: false,
      isCloze: true
    }
  ];

  // Normalize value with defaults (undefined values default to false)
  const normalizedValue = {
    reversible: value?.reversible ?? false,
    isCloze: value?.isCloze ?? false
  };

  const currentType = cardTypes.find(
    t => t.reversible === normalizedValue.reversible && t.isCloze === normalizedValue.isCloze
  ) || cardTypes[0];

  const handleSelect = (type) => {
    onChange({
      reversible: type.reversible,
      isCloze: type.isCloze
    });
  };

  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: '14px',
        fontWeight: '600',
        color: theme.textPrimary,
        marginBottom: '12px',
        letterSpacing: '0.3px'
      }}>
        Card Type
      </label>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px'
      }}>
        {cardTypes.map(type => {
          const isSelected = type.id === currentType.id;
          
          return (
            <button
              key={type.id}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(type);
              }}
              style={{
                padding: '20px 16px',
                background: isSelected 
                  ? `linear-gradient(135deg, ${theme.primary}15, ${theme.primary}08)` 
                  : 'rgba(255, 255, 255, 0.6)',
                border: `2px solid ${isSelected ? theme.primary : theme.cardBorder}`,
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isSelected 
                  ? `0 4px 12px ${theme.primary}20` 
                  : '0 2px 4px rgba(0, 0, 0, 0.04)'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = `0 6px 16px ${theme.primary}15`;
                  e.currentTarget.style.borderColor = `${theme.primary}80`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.04)';
                  e.currentTarget.style.borderColor = theme.cardBorder;
                }
              }}
            >
              <div style={{ padding: '8px', lineHeight: 1 }}>
                <LucideIcon name={type.icon} size={32} color={isSelected ? theme.primary : theme.textSecondary} />
              </div>
              
              <div style={{
                fontSize: '15px',
                fontWeight: '700',
                color: isSelected ? theme.primary : theme.textPrimary,
                letterSpacing: '0.2px'
              }}>
                {type.name}
              </div>
              
              <div style={{
                fontSize: '12px',
                color: theme.textSecondary,
                lineHeight: '1.4'
              }}>
                {type.description}
              </div>
              
              <div style={{
                marginTop: '4px',
                padding: '6px 10px',
                background: isSelected 
                  ? `${theme.primary}15` 
                  : 'rgba(0, 0, 0, 0.04)',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '600',
                color: isSelected ? theme.primary : theme.textSecondary,
                fontFamily: 'monospace',
                letterSpacing: '0.3px'
              }}>
                {type.diagram}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CardTypeOptionSelector;


