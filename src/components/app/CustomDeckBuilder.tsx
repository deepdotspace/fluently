import React, { useState, useEffect, useMemo } from 'react';
import type { ChangeEvent, FocusEvent, MouseEvent } from 'react';
import GlassCard from './GlassCard';
import CustomDropdown from './CustomDropdown';
import { POS_OPTIONS } from '../../utils/dataset';
import LucideIcon from './LucideIcon';
import type { DeckMap, SoftTheme } from '../../types';

/** Parameters emitted to `onGenerate` when the user submits the builder. */
interface GenerateParams {
  language: string;
  pos: string;
  difficulty: string;
  selectedLevels: string[];
  count: number;
  name: string;
  subcategory: string;
  targetDeckId: string | null;
}

interface CustomDeckBuilderProps {
  theme: SoftTheme;
  onGenerate: (params: GenerateParams) => void;
  onClose: () => void;
  availableLanguages: string[];
  decks?: DeckMap;
}

interface FormErrors {
  language?: string | null;
  pos?: string | null;
  level?: string | null;
  cardCount?: string | null;
}

function CustomDeckBuilder({ theme, onGenerate, onClose, availableLanguages, decks }: CustomDeckBuilderProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [selectedPos, setSelectedPos] = useState<string | null>(null);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [cardCount, setCardCount] = useState<number | string>(100);
  const [errors, setErrors] = useState<FormErrors>({});
  const [importMode, setImportMode] = useState('new'); // 'new' or 'existing'
  const [selectedExistingDeck, setSelectedExistingDeck] = useState<string | null>(null);

  // Get existing deck options
  const existingDeckOptions = useMemo(() => {
    if (!decks) return [];
    return Object.values(decks).map(d => ({
      value: d.id,
      label: d.name
    }));
  }, [decks]);

  // Check if form is valid (all required fields filled)
  const isFormValid = useMemo(() => {
    const baseValid = (
      selectedLanguage !== null &&
      selectedPos !== null &&
      selectedLevels.length > 0 &&
      (cardCount as number) >= 10 &&
      (cardCount as number) <= 1000
    );

    // If adding to existing deck, must have selected a deck
    if (importMode === 'existing' && !selectedExistingDeck) {
      return false;
    }

    return baseValid;
  }, [selectedLanguage, selectedPos, selectedLevels, cardCount, importMode, selectedExistingDeck]);

  // Language options
  const languageOptions = availableLanguages.map(lang => ({
    value: lang,
    label: lang.charAt(0).toUpperCase() + lang.slice(1)
  }));

  // CEFR Level options (individual levels only for multi-select)
  const levelOptions = [
    { value: 'A1', label: 'A1 (Beginner)' },
    { value: 'A2', label: 'A2 (Elementary)' },
    { value: 'B1', label: 'B1 (Intermediate)' },
    { value: 'B2', label: 'B2 (Upper Intermediate)' },
    { value: 'C1', label: 'C1 (Advanced)' },
    { value: 'C2', label: 'C2 (Proficient)' }
  ];

  // Part of Speech options (excluding 'all')
  const posOptions = POS_OPTIONS.filter(opt => opt.value !== 'all');

  // Prevent body scrolling when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Toggle CEFR level selection
  const toggleLevel = (level: string) => {
    setSelectedLevels(prev => {
      if (prev.includes(level)) {
        return prev.filter(l => l !== level);
      } else {
        return [...prev, level];
      }
    });
    if (errors.level) {
      setErrors(prev => ({ ...prev, level: null }));
    }
  };

  // Validate form
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!selectedLanguage) {
      newErrors.language = 'Please select a language';
    }

    if (!selectedPos) {
      newErrors.pos = 'Please select a part of speech';
    }

    if (!selectedLevels || selectedLevels.length === 0) {
      newErrors.level = 'Please select at least one CEFR level';
    }

    if (!cardCount || (cardCount as number) < 10 || (cardCount as number) > 1000) {
      newErrors.cardCount = 'Please enter a number between 10 and 1000';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGenerate = () => {
    if (!validate()) return;

    // Combine selected levels into a comma-separated string for the difficulty parameter
    // The generation function will handle this by using the levels directly
    const levelsString = selectedLevels.sort().join(',');

    const params: GenerateParams = {
      language: selectedLanguage!,
      pos: selectedPos!,
      difficulty: levelsString, // Pass as comma-separated string, will be parsed in generation
      selectedLevels: selectedLevels, // Also pass as array for direct use
      count: parseInt(String(cardCount)),
      name: `${selectedLanguage!.charAt(0).toUpperCase() + selectedLanguage!.slice(1)} ${selectedPos!.charAt(0).toUpperCase() + selectedPos!.slice(1)}s (${levelsString})`,
      subcategory: selectedPos!.toLowerCase(),
      targetDeckId: importMode === 'existing' ? selectedExistingDeck : null
    };

    onGenerate(params);
  };

  const hexToRgba = (hex: string, opacity: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  return (
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
        zIndex: 10003,
        padding: '20px'
      }}
      onClick={onClose}
      key="overlay"
    >
      <div
        className="anim-fade-slide-down"
        style={{ width: '100%', maxWidth: '600px' }}
        onClick={(e) => e.stopPropagation()}
        key="content"
      >
        <GlassCard
          theme={theme}
          opaque={true}
          style={{
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            margin: 'auto',
            border: `1px solid ${theme?.cardBorder || '#e2e8f0'}`,
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none'
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '16px'
            }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: theme.textPrimary,
                margin: 0,
                flex: 1,
                background: `linear-gradient(135deg, ${theme.primary}, ${theme.primary}dd)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Create Custom Deck
              </h2>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: theme.textSecondary,
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
                  (e.target as HTMLElement).style.background = theme.cardBorder + '20';
                  (e.target as HTMLElement).style.color = theme.textPrimary;
                }}
                onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
                  (e.target as HTMLElement).style.background = 'none';
                  (e.target as HTMLElement).style.color = theme.textSecondary;
                }}
              >
                <LucideIcon name="X" size={20} />
              </button>
            </div>
            <p style={{
              fontSize: '14px',
              color: theme.textSecondary,
              margin: 0,
              lineHeight: '1.6'
            }}>
              Choose your language, part of speech, level, and card count to generate a personalized deck.
            </p>
          </div>

          {/* Form */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            flex: 1,
            padding: '0 4px',
            paddingBottom: '16px'
          }}>
            {/* Import Options - Moved to top */}
            <div style={{
              padding: '16px',
              background: '#f8fafc',
              border: `1px solid ${theme?.cardBorder || '#e2e8f0'}`,
              borderRadius: '12px'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: theme.textPrimary,
                marginBottom: '12px'
              }}>
                Deck Options
              </div>

              {/* Mode Selection */}
              <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setImportMode('new');
                    setSelectedExistingDeck(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: importMode === 'new' ? '#ffffff' : 'transparent',
                    border: `1px solid ${importMode === 'new' ? theme.primary : theme?.cardBorder || '#e2e8f0'}`,
                    borderRadius: '10px',
                    color: importMode === 'new' ? theme.primary : theme.textSecondary,
                    fontSize: '14px',
                    fontWeight: importMode === 'new' ? '600' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
                    if (importMode !== 'new') {
                      (e.target as HTMLElement).style.borderColor = theme.primary;
                      (e.target as HTMLElement).style.color = theme.primary;
                    }
                  }}
                  onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
                    if (importMode !== 'new') {
                      (e.target as HTMLElement).style.borderColor = theme.cardBorder;
                      (e.target as HTMLElement).style.color = theme.textSecondary;
                    }
                  }}
                >
                  Create New Deck
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setImportMode('existing');
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: importMode === 'existing' ? hexToRgba(theme.primary, 0.15) : 'transparent',
                    border: `1px solid ${importMode === 'existing' ? theme.primary : theme.cardBorder}`,
                    borderRadius: '10px',
                    color: importMode === 'existing' ? theme.primary : theme.textSecondary,
                    fontSize: '14px',
                    fontWeight: importMode === 'existing' ? '600' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
                    if (importMode !== 'existing') {
                      (e.target as HTMLElement).style.borderColor = theme.primary;
                      (e.target as HTMLElement).style.color = theme.primary;
                    }
                  }}
                  onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
                    if (importMode !== 'existing') {
                      (e.target as HTMLElement).style.borderColor = theme.cardBorder;
                      (e.target as HTMLElement).style.color = theme.textSecondary;
                    }
                  }}
                >
                  Add to Existing Deck
                </button>
              </div>

              {/* Existing Deck Selector */}
              {importMode === 'existing' && (
                <div>
                  <div style={{
                    fontSize: '13px',
                    color: theme.textSecondary,
                    marginBottom: '8px'
                  }}>
                    Select deck to add cards to:
                  </div>
                  <CustomDropdown
                    value={selectedExistingDeck}
                    options={existingDeckOptions}
                    onChange={setSelectedExistingDeck}
                    placeholder="Choose a deck..."
                    theme={theme}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>

            {/* Language */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.textPrimary,
                marginBottom: '8px'
              }}>
                Language
              </label>
              <CustomDropdown
                value={selectedLanguage}
                options={languageOptions}
                onChange={setSelectedLanguage}
                placeholder="Select language"
                theme={theme}
                style={{ width: '100%' }}
              />
              {errors.language && (
                <div style={{
                  fontSize: '12px',
                  color: '#ef4444',
                  marginTop: '6px'
                }}>
                  {errors.language}
                </div>
              )}
            </div>

            {/* Part of Speech */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.textPrimary,
                marginBottom: '8px'
              }}>
                Part of Speech
              </label>
              <CustomDropdown
                value={selectedPos}
                options={posOptions}
                onChange={setSelectedPos}
                placeholder="Select part of speech"
                theme={theme}
                style={{ width: '100%' }}
              />
              {errors.pos && (
                <div style={{
                  fontSize: '12px',
                  color: '#ef4444',
                  marginTop: '6px'
                }}>
                  {errors.pos}
                </div>
              )}
            </div>

            {/* CEFR Level */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.textPrimary,
                marginBottom: '8px'
              }}>
                CEFR Level (Select multiple)
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px',
                padding: '12px',
                background: '#f8fafc',
                border: `1px solid ${errors.level ? '#ef4444' : theme?.cardBorder || '#e2e8f0'}`,
                borderRadius: '12px'
              }} onClick={(e) => e.stopPropagation()}>
                {levelOptions.map((option) => {
                  const isSelected = selectedLevels.includes(option.value);
                  return (
                    <label
                      key={option.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderRadius: '8px',
                        transition: 'all 0.2s',
                        background: isSelected ? hexToRgba(theme.primary, 0.1) : 'transparent',
                        border: `1px solid ${isSelected ? theme.primary : 'transparent'}`
                      }}
                      onMouseEnter={(e: MouseEvent<HTMLLabelElement>) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = hexToRgba(theme.primary, 0.05);
                        }
                      }}
                      onMouseLeave={(e: MouseEvent<HTMLLabelElement>) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleLevel(option.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '16px',
                          height: '16px',
                          cursor: 'pointer',
                          accentColor: theme.primary
                        }}
                      />
                      <span style={{
                        fontSize: '14px',
                        color: isSelected ? theme.primary : theme.textPrimary,
                        fontWeight: isSelected ? '600' : '400'
                      }}>
                        {option.label}
                      </span>
                    </label>
                  );
                })}
              </div>
              {errors.level && (
                <div style={{
                  fontSize: '12px',
                  color: '#ef4444',
                  marginTop: '6px'
                }}>
                  {errors.level}
                </div>
              )}
            </div>

            {/* Card Count */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.textPrimary,
                marginBottom: '8px'
              }}>
                Number of Cards
              </label>
              <input
                type="number"
                min="10"
                max="1000"
                value={cardCount}
                onClick={(e) => e.stopPropagation()}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  e.stopPropagation();
                  const value = parseInt(e.target.value) || '';
                  setCardCount(value);
                  if (errors.cardCount) {
                    setErrors(prev => ({ ...prev, cardCount: null }));
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#ffffff',
                  border: `1px solid ${errors.cardCount ? '#ef4444' : theme?.cardBorder || '#e2e8f0'}`,
                  borderRadius: '12px',
                  color: theme.textPrimary,
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e: FocusEvent<HTMLInputElement>) => {
                  e.stopPropagation();
                  (e.target as HTMLElement).style.borderColor = theme.primary;
                  (e.target as HTMLElement).style.boxShadow = `0 0 0 3px ${hexToRgba(theme.primary, 0.2)}`;
                }}
                onBlur={(e: FocusEvent<HTMLInputElement>) => {
                  (e.target as HTMLElement).style.borderColor = errors.cardCount ? '#ef4444' : theme.cardBorder;
                  (e.target as HTMLElement).style.boxShadow = 'none';
                }}
                placeholder="Enter number (10-1000)"
              />
              {errors.cardCount && (
                <div style={{
                  fontSize: '12px',
                  color: '#ef4444',
                  marginTop: '6px'
                }}>
                  {errors.cardCount}
                </div>
              )}
              <div style={{
                fontSize: '12px',
                color: theme.textSecondary,
                marginTop: '6px'
              }}>
                Recommended: 50-200 cards for optimal learning
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            marginTop: '32px'
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: 'none',
                border: `1px solid ${theme.primary}40`,
                borderRadius: '12px',
                color: theme.textSecondary,
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
                (e.target as HTMLElement).style.background = hexToRgba(theme.primary, 0.1);
                (e.target as HTMLElement).style.borderColor = theme.primary;
                (e.target as HTMLElement).style.color = theme.primary;
              }}
              onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
                (e.target as HTMLElement).style.background = 'none';
                (e.target as HTMLElement).style.borderColor = theme.primary + '40';
                (e.target as HTMLElement).style.color = theme.textSecondary;
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={!isFormValid}
              style={{
                padding: '10px 20px',
                background: !isFormValid ? theme.cardBorder : theme.primary,
                border: 'none',
                borderRadius: '12px',
                color: !isFormValid ? theme.textSecondary : '#ffffff',
                fontSize: '14px',
                fontWeight: '600',
                cursor: !isFormValid ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: !isFormValid ? 'none' : `0 4px 12px ${theme.primary}40`,
                opacity: !isFormValid ? 0.7 : 1
              }}
              onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
                if (isFormValid) {
                  (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                  (e.target as HTMLElement).style.boxShadow = `0 6px 16px ${theme.primary}50`;
                }
              }}
              onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
                if (isFormValid) {
                  (e.target as HTMLElement).style.transform = 'translateY(0)';
                  (e.target as HTMLElement).style.boxShadow = `0 4px 12px ${theme.primary}40`;
                }
              }}
            >
              {importMode === 'existing' ? 'Add to Deck' : 'Generate Deck'}
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

export default CustomDeckBuilder;
