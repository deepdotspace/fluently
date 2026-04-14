import React, { useState, useMemo, useEffect } from 'react';
import GlassCard from './GlassCard';
import CustomDropdown from './CustomDropdown';
import LucideIcon from './LucideIcon';

function DeckPreviewModal({ deck, cards, onClose, onImport, theme, decks, initialImportMode, initialSelectedDeck }) {
  const [showAllWords, setShowAllWords] = useState(false);
  const [importMode, setImportMode] = useState(initialImportMode || 'new'); // 'new' or 'existing'
  const [selectedExistingDeck, setSelectedExistingDeck] = useState(initialSelectedDeck || null);

  // Prevent body scrolling when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Extract words from cards
  const words = useMemo(() => {
    if (!cards || !Array.isArray(cards)) return [];
    return cards.map(card => {
      // Try multiple field name possibilities
      const fields = card.content?.fields || {};

      // Priority order: Front, Word, then first available field
      let word = fields.Front || fields.Word || '';

      // If still empty, get the first field value
      if (!word && Object.keys(fields).length > 0) {
        const firstFieldKey = Object.keys(fields)[0];
        word = fields[firstFieldKey] || '';
      }

      // Strip HTML tags if present
      if (word && typeof word === 'string') {
        word = word.replace(/<[^>]*>/g, '').trim();
      }

      return word;
    }).filter(Boolean);
  }, [cards]);

  const displayedWords = showAllWords ? words : words.slice(0, 50);
  const hasMore = words.length > 50;

  // Get existing deck options
  const existingDeckOptions = useMemo(() => {
    if (!decks) return [];
    return Object.values(decks).map(d => ({
      value: d.id,
      label: d.name
    }));
  }, [decks]);

  // Check if import is valid
  const isImportValid = useMemo(() => {
    // Must have deck and cards
    if (!deck || !cards || !Array.isArray(cards) || cards.length === 0) {
      return false;
    }
    // If adding to existing deck, must have selected a deck
    if (importMode === 'existing' && !selectedExistingDeck) {
      return false;
    }
    return true;
  }, [deck, cards, importMode, selectedExistingDeck]);

  // Handle import with selected mode
  const handleImportClick = () => {
    // Safety check - don't proceed if validation fails
    if (!isImportValid) return;

    const targetDeckId = importMode === 'existing' ? selectedExistingDeck : null;
    onImport(targetDeckId);
  };

  if (!deck) return null;

  // Convert hex to rgba for overlay
  const hexToRgba = (hex, opacity) => {
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
        zIndex: 10000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="anim-fade-slide-down"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
        key="content"
      >
        <GlassCard
          theme={theme}
          opaque={true}
          style={{
            maxWidth: '600px',
            width: '100%',
            maxHeight: '85vh',
            overflow: 'visible',
            display: 'flex',
            flexDirection: 'column',
            margin: 'auto',
            border: `1px solid ${theme?.cardBorder || '#e2e8f0'}`,
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            position: 'relative'
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85vh',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Scrollable Content */}
            <div
              className="no-scrollbar"
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ marginBottom: '24px' }}>
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
                    {deck.name}
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
                    onMouseEnter={(e) => {
                      e.target.style.background = theme.cardBorder + '20';
                      e.target.style.color = theme.textPrimary;
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'none';
                      e.target.style.color = theme.textSecondary;
                    }}
                  >
                    <LucideIcon name="X" size={20} />
                  </button>
                </div>

                {deck.description && (
                  <p style={{
                    fontSize: '14px',
                    color: theme.textSecondary,
                    margin: '0 0 16px 0',
                    lineHeight: '1.6'
                  }}>
                    {deck.description}
                  </p>
                )}

                <div style={{
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    fontSize: '13px',
                    color: theme.primary,
                    background: '#f1f5f9',
                    padding: '6px 12px',
                    borderRadius: '12px',
                    border: `1px solid ${theme.primary}30`,
                    fontWeight: '600'
                  }}>
                    {deck.cardCount || cards?.length || 0} cards
                  </div>
                  {deck.difficulty && (
                    <div style={{
                      fontSize: '13px',
                      color: theme.primary,
                      background: '#f1f5f9',
                      padding: '6px 12px',
                      borderRadius: '12px',
                      border: `1px solid ${theme.primary}30`,
                      fontWeight: '600'
                    }}>
                      {deck.difficulty}
                    </div>
                  )}
                  {deck.estimatedStudyTime && (
                    <div style={{
                      fontSize: '13px',
                      color: theme.primary,
                      background: '#f1f5f9',
                      padding: '6px 12px',
                      borderRadius: '12px',
                      border: `1px solid ${theme.primary}30`,
                      fontWeight: '600'
                    }}>
                      {deck.estimatedStudyTime}
                    </div>
                  )}
                </div>
              </div>

              {/* Word List */}
              <div style={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                marginBottom: '24px'
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: theme.textPrimary,
                  margin: '0 0 12px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{
                    width: '4px',
                    height: '16px',
                    background: theme.primary,
                    borderRadius: '2px'
                  }} />
                  Words in this deck ({words.length})
                </h3>

                <div
                  className="no-scrollbar"
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    padding: '16px',
                    maxHeight: '300px',
                    border: `1px solid ${theme.primary}20`,
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    {displayedWords.map((word, index) => (
                      <span
                        key={index}
                        style={{
                          fontSize: '13px',
                          color: theme.textPrimary,
                          background: '#ffffff',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: `1px solid ${theme.primary}30`,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}
                      >
                        {word}
                      </span>
                    ))}
                  </div>

                  {hasMore && !showAllWords && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAllWords(true);
                      }}
                      style={{
                        marginTop: '12px',
                        background: 'none',
                        border: 'none',
                        color: theme.primary,
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                        padding: '8px',
                        textAlign: 'center',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      Show all {words.length} words <LucideIcon name="ArrowRight" size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Import Options - Always Visible */}
            <div style={{
              marginBottom: '24px',
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '12px',
              border: `1px solid ${theme.primary}20`,
              flexShrink: 0
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: theme.textPrimary,
                marginBottom: '12px'
              }}>
                Import Options
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
                    background: importMode === 'new' ? hexToRgba(theme.primary, 0.15) : 'transparent',
                    border: `1px solid ${importMode === 'new' ? theme.primary : theme.cardBorder}`,
                    borderRadius: '10px',
                    color: importMode === 'new' ? theme.primary : theme.textSecondary,
                    fontSize: '14px',
                    fontWeight: importMode === 'new' ? '600' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (importMode !== 'new') {
                      e.target.style.borderColor = theme.primary;
                      e.target.style.color = theme.primary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (importMode !== 'new') {
                      e.target.style.borderColor = theme.cardBorder;
                      e.target.style.color = theme.textSecondary;
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
                  onMouseEnter={(e) => {
                    if (importMode !== 'existing') {
                      e.target.style.borderColor = theme.primary;
                      e.target.style.color = theme.primary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (importMode !== 'existing') {
                      e.target.style.borderColor = theme.cardBorder;
                      e.target.style.color = theme.textSecondary;
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

            {/* Actions - Always Visible */}
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              flexShrink: 0,
              marginTop: 'auto'
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
                onMouseEnter={(e) => {
                  e.target.style.background = hexToRgba(theme.primary, 0.1);
                  e.target.style.borderColor = theme.primary;
                  e.target.style.color = theme.primary;
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'none';
                  e.target.style.borderColor = theme.primary + '40';
                  e.target.style.color = theme.textSecondary;
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleImportClick}
                disabled={!isImportValid}
                style={{
                  padding: '10px 20px',
                  background: !isImportValid ? theme.cardBorder : theme.primary,
                  border: 'none',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: !isImportValid ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: !isImportValid ? 'none' : `0 4px 12px ${theme.primary}40`,
                  opacity: !isImportValid ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (isImportValid) {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = `0 6px 16px ${theme.primary}50`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (isImportValid) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = `0 4px 12px ${theme.primary}40`;
                  }
                }}
              >
                {importMode === 'existing' ? 'Add to Deck' : 'Import Deck'}
              </button>
            </div>
          </div>

        </GlassCard>
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
  );
}

export default DeckPreviewModal;

