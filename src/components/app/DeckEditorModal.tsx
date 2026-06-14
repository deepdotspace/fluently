import React, { useState, useEffect, useRef } from 'react';
import type { ChangeEvent, FocusEvent, KeyboardEvent, MouseEvent } from 'react';
import { LANGUAGES } from '../../utils/languages';
import DesignSelector from './DesignSelector';
import LucideIcon from './LucideIcon';
import type { Deck, SoftTheme } from '../../types';

/** Form state edited by the modal and emitted to `onSave`. */
interface DeckFormData {
  name: string;
  targetLang: string;
  nativeLang: string;
  designId: string | null;
}

interface DeckEditorModalProps {
  isOpen: boolean;
  deck?: Deck | null; // null for create, deck object for edit
  onSave: (formData: DeckFormData) => void;
  onCancel: () => void;
  theme: SoftTheme;
}

/**
 * DeckEditorModal - Modal for creating or editing decks
 * Includes: name, target/native languages, and design selection
 */
function DeckEditorModal({
  isOpen,
  deck, // null for create, deck object for edit
  onSave,
  onCancel,
  theme
}: DeckEditorModalProps) {
  const [formData, setFormData] = useState<DeckFormData>({
    name: '',
    targetLang: 'es',
    nativeLang: 'en',
    designId: null
  });

  const nameInputRef = useRef<HTMLInputElement>(null);
  const isEditMode = !!deck;

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen) {
      if (deck) {
        // Edit mode - populate with existing deck data
        setFormData({
          name: deck.name || '',
          targetLang: deck.targetLang || 'es',
          nativeLang: deck.nativeLang || 'en',
          designId: deck.designId || null
        });
      } else {
        // Create mode - reset to defaults
        setFormData({
          name: '',
          targetLang: 'es',
          nativeLang: 'en',
          designId: null
        });
      }

      // Focus name input after a short delay
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, deck]);

  const handleSave = () => {
    if (!formData.name.trim()) return;
    onSave(formData);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && formData.name.trim()) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isOpen) return null;

  const overlayContent = (
    <div
      className="anim-fade-in"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
      onClick={onCancel}
    >
      <div
        className="anim-fade-slide-down no-scrollbar"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          border: `1px solid ${theme?.cardBorder || '#e2e8f0'}`
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px 32px',
          borderBottom: `1px solid ${theme?.cardBorder || '#e2e8f0'}`,
          background: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: theme.textPrimary,
            margin: 0,
            letterSpacing: '-0.5px'
          }}>
            {isEditMode ? 'Edit Deck' : 'Create New Deck'}
          </h2>
          <button
            onClick={onCancel}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: `1px solid ${theme.cardBorder}`,
              background: 'rgba(255, 255, 255, 0.6)',
              color: theme.textSecondary,
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.background = theme.highlight;
              e.currentTarget.style.color = theme.textPrimary;
            }}
            onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)';
              e.currentTarget.style.color = theme.textSecondary;
            }}
          >
            <LucideIcon name="X" size={20} />
          </button>
        </div>

        {/* Content - Scrollable with no scrollbar */}
        <div
          className="no-scrollbar"
          style={{
            padding: '32px',
            overflowY: 'auto',
            flex: 1,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Deck Name */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.textPrimary,
                marginBottom: '10px',
                letterSpacing: '0.3px'
              }}>
                Deck Name
              </label>
              <input
                ref={nameInputRef}
                type="text"
                value={formData.name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                onKeyDown={handleKeyDown}
                placeholder="e.g., Spanish Verbs"
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  fontSize: '15px',
                  border: `1px solid ${theme?.cardBorder || '#e2e8f0'}`,
                  borderRadius: '12px',
                  outline: 'none',
                  transition: 'all 0.3s',
                  boxSizing: 'border-box',
                  background: '#f8fafc',
                  color: theme.textPrimary
                }}
                onFocus={(e: FocusEvent<HTMLInputElement>) => {
                  (e.target as HTMLElement).style.borderColor = theme.primary;
                  (e.target as HTMLElement).style.boxShadow = `0 0 0 3px ${theme.primary}20`;
                }}
                onBlur={(e: FocusEvent<HTMLInputElement>) => {
                  (e.target as HTMLElement).style.borderColor = theme.cardBorder;
                  (e.target as HTMLElement).style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Languages */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: theme.textPrimary,
                  marginBottom: '10px',
                  letterSpacing: '0.3px'
                }}>
                  Target Language
                </label>
                <select
                  value={formData.targetLang}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, targetLang: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '14px 50px 14px 18px',
                    fontSize: '15px',
                    border: `1px solid ${theme?.cardBorder || '#e2e8f0'}`,
                    borderRadius: '12px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#f8fafc',
                    color: theme.textPrimary,
                    cursor: 'pointer',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'%3E%3Cpath fill='${encodeURIComponent(theme.textPrimary)}' d='M7 10L2 5h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 14px center',
                    transition: 'all 0.3s'
                  }}
                  onFocus={(e: FocusEvent<HTMLSelectElement>) => {
                    e.target.style.borderColor = theme.primary;
                    e.target.style.boxShadow = `0 0 0 3px ${theme.primary}20`;
                  }}
                  onBlur={(e: FocusEvent<HTMLSelectElement>) => {
                    e.target.style.borderColor = theme.cardBorder;
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: theme.textPrimary,
                  marginBottom: '10px',
                  letterSpacing: '0.3px'
                }}>
                  Native Language
                </label>
                <select
                  value={formData.nativeLang}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, nativeLang: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '14px 50px 14px 18px',
                    fontSize: '15px',
                    border: `1px solid ${theme?.cardBorder || '#e2e8f0'}`,
                    borderRadius: '12px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#f8fafc',
                    color: theme.textPrimary,
                    cursor: 'pointer',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'%3E%3Cpath fill='${encodeURIComponent(theme.textPrimary)}' d='M7 10L2 5h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 14px center',
                    transition: 'all 0.3s'
                  }}
                  onFocus={(e: FocusEvent<HTMLSelectElement>) => {
                    e.target.style.borderColor = theme.primary;
                    e.target.style.boxShadow = `0 0 0 3px ${theme.primary}20`;
                  }}
                  onBlur={(e: FocusEvent<HTMLSelectElement>) => {
                    e.target.style.borderColor = theme.cardBorder;
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Design Selector */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.textPrimary,
                marginBottom: '10px',
                letterSpacing: '0.3px'
              }}>
                Card Design (Optional)
              </label>
              <div style={{
                padding: '24px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: `1px solid ${theme?.cardBorder || '#e2e8f0'}`
              }}>
                <DesignSelector
                  selectedDesignId={formData.designId}
                  onSelectDesign={(designId) => setFormData({ ...formData, designId })}
                  theme={theme}
                />
                {formData.designId && (
                  <button
                    onClick={() => setFormData({ ...formData, designId: null })}
                    style={{
                      marginTop: '12px',
                      padding: '8px 16px',
                      background: 'rgba(255, 255, 255, 0.7)',
                      color: theme.textSecondary,
                      border: `1px solid ${theme.cardBorder}`,
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
                      (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 1)';
                    }}
                    onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
                      (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.7)';
                    }}
                  >
                    Clear Design
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          padding: '24px 32px',
          borderTop: `1px solid ${theme?.cardBorder || '#e2e8f0'}`,
          background: '#ffffff',
          justifyContent: 'flex-end',
          flexShrink: 0
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '14px 32px',
              backgroundColor: '#ffffff',
              color: theme.textPrimary,
              border: `1px solid ${theme?.cardBorder || '#e2e8f0'}`,
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
              (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 1)';
            }}
            onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
              (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.7)';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!formData.name.trim()}
            style={{
              padding: '14px 32px',
              background: formData.name.trim() ? theme.primary : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: formData.name.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s',
              boxShadow: formData.name.trim() ? `0 4px 20px ${theme.primary}40` : 'none',
              opacity: formData.name.trim() ? 1 : 1
            }}
            onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
              if (formData.name.trim()) {
                (e.target as HTMLElement).style.transform = 'translateY(-2px)';
                (e.target as HTMLElement).style.boxShadow = `0 8px 28px ${theme.primary}50`;
              }
            }}
            onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
              if (formData.name.trim()) {
                (e.target as HTMLElement).style.transform = 'translateY(0)';
                (e.target as HTMLElement).style.boxShadow = `0 4px 20px ${theme.primary}40`;
              }
            }}
          >
            {isEditMode ? 'Save Changes' : 'Create Deck'}
          </button>
        </div>

        <style>{`
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
            .no-scrollbar {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `}</style>
      </div>
    </div>
  );

  return overlayContent;
}

export default DeckEditorModal;
