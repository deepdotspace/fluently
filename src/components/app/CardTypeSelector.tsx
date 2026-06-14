import React, { useState, useRef, useEffect, useMemo } from 'react';
import LucideIcon from './LucideIcon';
import useIsMobile from '../../hooks/useIsMobile';
import type { CardType, CardTypeMap, SoftTheme } from '../../types';

interface CardTypeSelectorProps {
  cardTypes?: CardTypeMap;
  selectedCardTypeId?: string;
  onCardTypeChange?: (id: string) => void;
  onEditClick?: () => void;
  onEditCardType?: (cardType: CardType) => void;
  theme?: SoftTheme;
}

/**
 * CardTypeSelector - Dropdown for selecting card types
 * Shows available card types with option to edit/create new card types
 */
function CardTypeSelector({
  cardTypes = {},
  selectedCardTypeId,
  onCardTypeChange,
  onEditClick,
  onEditCardType,
  theme
}: CardTypeSelectorProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const cardTypesList = useMemo(() => {
    return Object.values(cardTypes || {}).sort((a, b) => {
      // Put default types first
      const defaultTypes = ['basic', 'basic-reversed', 'cloze'];
      const aIsDefault = defaultTypes.includes(a.id);
      const bIsDefault = defaultTypes.includes(b.id);
      if (aIsDefault && !bIsDefault) return -1;
      if (!aIsDefault && bIsDefault) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [cardTypes]);

  const selectedCardType = (selectedCardTypeId ? cardTypes?.[selectedCardTypeId] : undefined) || cardTypesList[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {/* Selector Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            flex: 1,
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: '600',
            background: 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${theme?.cardBorder || '#e5e7eb'}`,
            borderRadius: '10px',
            color: theme?.textPrimary || '#1f2937',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s',
            boxShadow: isOpen ? `0 4px 12px ${theme?.primary || '#3b82f6'}30` : 'none'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.borderColor = theme?.primary || '#3b82f6';
          }}
          onMouseLeave={(e) => {
            if (!isOpen) {
              (e.target as HTMLElement).style.borderColor = theme?.cardBorder || '#e5e7eb';
            }
          }}
        >
          <span>{selectedCardType?.name || 'Select Card Type'}</span>
          <LucideIcon
            name="chevron-down"
            size={14}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            color={theme?.textSecondary}
          />
        </button>

        {/* Create New Button - hidden on mobile */}
        {onEditClick && !isMobile && (
          <button
            onClick={onEditClick}
            title="Create New Card Type"
            style={{
              padding: '12px',
              fontSize: '16px',
              background: 'rgba(255, 255, 255, 0.5)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${theme?.cardBorder || '#e5e7eb'}`,
              borderRadius: '10px',
              color: theme?.textPrimary || '#1f2937',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '44px'
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = theme?.primary || '#3b82f6';
              (e.target as HTMLElement).style.color = 'white';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.6)';
              (e.target as HTMLElement).style.color = theme?.textPrimary || '#1f2937';
            }}
          >
            <LucideIcon name="plus" size={20} color="currentColor" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          right: 0,
          maxHeight: '300px',
          overflowY: 'auto',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '12px',
          border: `1px solid ${theme?.cardBorder || '#e5e7eb'}`,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          zIndex: 1000,
          padding: '8px'
        }}>
          {cardTypesList.length === 0 ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: theme?.textSecondary || '#6b7280',
              fontSize: '14px'
            }}>
              No card types available
            </div>
          ) : (
            cardTypesList.map(cardType => {
              const isSelected = cardType.id === selectedCardTypeId;
              const isDefault = ['basic', 'basic-reversed', 'cloze', 'pronunciation', 'vocabulary'].includes(cardType.id);

              return (
                <div
                  key={cardType.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginBottom: '4px'
                  }}
                >
                  <button
                    onClick={() => {
                      onCardTypeChange?.(cardType.id);
                      setIsOpen(false);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      textAlign: 'left',
                      background: isSelected
                        ? `${theme?.primary || '#3b82f6'}15`
                        : 'transparent',
                      border: `1px solid ${isSelected ? (theme?.primary || '#3b82f6') : 'transparent'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        (e.target as HTMLElement).style.background = 'rgba(0, 0, 0, 0.03)';
                        (e.target as HTMLElement).style.borderColor = theme?.cardBorder || '#e5e7eb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        (e.target as HTMLElement).style.background = 'transparent';
                        (e.target as HTMLElement).style.borderColor = 'transparent';
                      }
                    }}
                  >
                    <div>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: theme?.textPrimary || '#1f2937',
                        marginBottom: '4px'
                      }}>
                        {cardType.name}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: theme?.textSecondary || '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '4px'
                      }}>
                        {cardType.fields?.length || 0} field{cardType.fields?.length !== 1 ? 's' : ''}
                        {cardType.reversible && (
                          <>
                            <LucideIcon name="Dot" size={12} />
                            Reversible
                          </>
                        )}
                        {cardType.isCloze && (
                          <>
                            <LucideIcon name="Dot" size={12} />
                            Cloze
                          </>
                        )}
                      </div>
                    </div>
                    {isDefault && (
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: theme?.primary || '#3b82f6',
                        borderRadius: '4px',
                        fontWeight: '600'
                      }}>
                        Built-in
                      </span>
                    )}
                  </button>

                  {/* Edit button for custom card types - hidden on mobile */}
                  {!isDefault && onEditCardType && !isMobile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditCardType(cardType);
                        setIsOpen(false);
                      }}
                      title="Edit this card type"
                      style={{
                        padding: '8px',
                        fontSize: '14px',
                        background: 'transparent',
                        border: `1px solid ${theme?.cardBorder || '#e5e7eb'}`,
                        borderRadius: '6px',
                        color: theme?.textSecondary || '#6b7280',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.background = theme?.primary || '#3b82f6';
                        (e.target as HTMLElement).style.color = 'white';
                        (e.target as HTMLElement).style.borderColor = theme?.primary || '#3b82f6';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.background = 'transparent';
                        (e.target as HTMLElement).style.color = theme?.textSecondary || '#6b7280';
                        (e.target as HTMLElement).style.borderColor = theme?.cardBorder || '#e5e7eb';
                      }}
                    >
                      <LucideIcon name="edit" size={14} color="currentColor" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default CardTypeSelector;
