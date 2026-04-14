import React, { useState, useCallback, useMemo } from 'react';
import { generateId, formatDate } from '../../utils/storage';
import { getLanguageName } from '../../utils/languages';
import { getCardStats, deleteCard } from '../../utils/cardStorage';
import { useTheme } from '../../utils/ThemeContext';
import ConfirmModal from './ConfirmModal';
import DeckEditorModal from './DeckEditorModal';
import LucideIcon from './LucideIcon';
import useIsMobile from '../../hooks/useIsMobile';

function DecksList({ decks, deckMutations, cards, cardMutations, mediaRecords, mediaMutations, themes, onDeckSelect, settings }) {
  const currentTheme = useTheme();
  const isMobile = useIsMobile();

  const [deckEditorModal, setDeckEditorModal] = useState({ isOpen: false, deck: null });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, deckId: null });


  const decksList = useMemo(() => Object.values(decks || {}), [decks]);

  const handleSaveDeck = useCallback((formData) => {
    if (deckEditorModal.deck) {
      // Edit mode — update existing deck record
      const existing = deckEditorModal.deck;
      const { recordId, ...rest } = existing;
      const updatedData = {
        ...rest,
        name: formData.name,
        targetLang: formData.targetLang,
        nativeLang: formData.nativeLang,
        designId: formData.designId
      };
      if (recordId) {
        deckMutations.put(recordId, updatedData);
      }
    } else {
      // Create mode — new deck record
      const deckId = 'deck-' + generateId();
      deckMutations.create({
        id: deckId,
        name: formData.name,
        targetLang: formData.targetLang,
        nativeLang: formData.nativeLang,
        designId: formData.designId,
        settingsOverride: null,
        cardCounts: { new: 0, learning: 0, review: 0 },
        lastStudiedAt: null,
        createdAt: new Date().toISOString()
      });
    }

    setDeckEditorModal({ isOpen: false, deck: null });
  }, [deckEditorModal.deck, deckMutations]);

  const handleDeleteDeck = (deckId) => {
    setDeleteConfirm({ isOpen: true, deckId });
  };

  const confirmDeleteDeck = () => {
    if (deleteConfirm.deckId) {
      const deckId = deleteConfirm.deckId;
      const deck = decks[deckId];

      // Delete all cards belonging to this deck (with media cleanup)
      if (cardMutations && cards) {
        Object.values(cards).forEach(card => {
          if (card.deckId === deckId && card.recordId) {
            deleteCard(cardMutations, card, mediaMutations || null, mediaRecords || null);
          }
        });
      }

      // Delete the deck itself
      if (deck?.recordId) {
        deckMutations.remove(deck.recordId);
      }
      setDeleteConfirm({ isOpen: false, deckId: null });
    }
  };

  // Note: isDueCard was removed - use isDueCard from spacedRepetition.js if needed

  const getDeckCardCounts = (deckId) => {
    const stats = getCardStats(cards, deckId, settings);
    return {
      new: stats.new,
      learning: stats.learning,
      review: stats.review,
      due: stats.due
    };
  };

  return (
    <div>
      {/* Decks Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: isMobile ? '12px' : '20px'
        }}
      >
          {decksList.map((deck, index) => {
            const counts = getDeckCardCounts(deck.id);

            return (
              <div
                key={deck.id}
                onClick={() => onDeckSelect(deck.id)}
                className="deck-card"
                style={{
                  background: currentTheme.cardBg,
                  backdropFilter: `blur(${currentTheme.backdropBlur})`,
                  WebkitBackdropFilter: `blur(${currentTheme.backdropBlur})`,
                  border: `1px solid ${currentTheme.cardBorder}`,
                  borderRadius: isMobile ? '14px' : '16px',
                  padding: isMobile ? '16px' : '24px',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease-out',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 8px 24px ${currentTheme.primary}25`;
                  e.currentTarget.style.borderColor = `${currentTheme.primary}70`;
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
                  e.currentTarget.style.borderColor = currentTheme.cardBorder;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                  {/* Subtle gradient accent */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: `linear-gradient(90deg, ${currentTheme.primary} 0%, ${currentTheme.primary}80 100%)`,
                    borderRadius: '16px 16px 0 0',
                    opacity: 0.6
                  }} />

                  {/* Header section */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '16px'
                  }}>
                    <div style={{ flex: 1 }}>
                      {/* Language Badge */}
                      {deck.targetLang && (
                        <div style={{
                          display: 'inline-block',
                          fontSize: '11px',
                          fontWeight: '600',
                          color: currentTheme.primary,
                          background: `${currentTheme.primary}12`,
                          padding: '4px 10px',
                          borderRadius: '6px',
                          marginBottom: '12px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {getLanguageName(deck.targetLang)}
                        </div>
                      )}

                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: currentTheme.textPrimary,
                        margin: '0',
                        letterSpacing: '-0.2px',
                        lineHeight: '1.3'
                      }}>
                        {deck.name}
                      </h3>
                    </div>

                    {/* Action buttons */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'flex',
                        gap: '4px',
                        opacity: 0.6,
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                    >
                      <button
                        onClick={() => setDeckEditorModal({ isOpen: true, deck })}
                        style={{
                          padding: '6px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: currentTheme.textSecondary,
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Edit deck"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `${currentTheme.primary}15`;
                          e.currentTarget.style.color = currentTheme.primary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = currentTheme.textSecondary;
                        }}
                      >
                        <LucideIcon name="edit-2" size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteDeck(deck.id)}
                        style={{
                          padding: '6px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: currentTheme.textSecondary,
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Delete deck"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                          e.currentTarget.style.color = '#ef4444';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = currentTheme.textSecondary;
                        }}
                      >
                        <LucideIcon name="trash-2" size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '8px',
                    marginBottom: '16px'
                  }}>
                    <div style={{
                      padding: '10px 12px',
                      background: `${currentTheme.primary}08`,
                      borderRadius: '8px',
                      border: `1px solid ${currentTheme.primary}15`
                    }}>
                      <div style={{
                        fontSize: '11px',
                        color: currentTheme.textSecondary,
                        opacity: 0.7,
                        marginBottom: '4px',
                        fontWeight: '500'
                      }}>
                        New
                      </div>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        color: currentTheme.primary,
                        lineHeight: '1'
                      }}>
                        {counts.new}
                      </div>
                    </div>
                    <div style={{
                      padding: '10px 12px',
                      background: 'rgba(251, 146, 60, 0.08)',
                      borderRadius: '8px',
                      border: '1px solid rgba(251, 146, 60, 0.15)'
                    }}>
                      <div style={{
                        fontSize: '11px',
                        color: currentTheme.textSecondary,
                        opacity: 0.7,
                        marginBottom: '4px',
                        fontWeight: '500'
                      }}>
                        Learning
                      </div>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        color: '#ea580c',
                        lineHeight: '1'
                      }}>
                        {counts.learning}
                      </div>
                    </div>
                    <div style={{
                      padding: '10px 12px',
                      background: 'rgba(52, 211, 153, 0.08)',
                      borderRadius: '8px',
                      border: '1px solid rgba(52, 211, 153, 0.15)'
                    }}>
                      <div style={{
                        fontSize: '11px',
                        color: currentTheme.textSecondary,
                        opacity: 0.7,
                        marginBottom: '4px',
                        fontWeight: '500'
                      }}>
                        Review
                      </div>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        color: '#059669',
                        lineHeight: '1'
                      }}>
                        {counts.review}
                      </div>
                    </div>
                    <div style={{
                      padding: '10px 12px',
                      background: `${currentTheme.primary}12`,
                      borderRadius: '8px',
                      border: `1px solid ${currentTheme.primary}25`
                    }}>
                      <div style={{
                        fontSize: '11px',
                        color: currentTheme.textSecondary,
                        opacity: 0.7,
                        marginBottom: '4px',
                        fontWeight: '500'
                      }}>
                        Due
                      </div>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        color: currentTheme.primary,
                        lineHeight: '1'
                      }}>
                        {counts.due}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{
                    fontSize: '12px',
                    color: currentTheme.textSecondary,
                    opacity: 0.6,
                    paddingTop: '12px',
                    borderTop: `1px solid ${currentTheme.cardBorder}`
                  }}>
                    Last studied: {formatDate(deck.lastStudiedAt)}
                  </div>
                </div>
              );
            })}
      </div>


      {decksList.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '80px 32px',
          color: currentTheme.textSecondary,
          opacity: 0.6
        }}>
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
            <LucideIcon name="library" size={64} color={currentTheme.primary} />
          </div>
          <p style={{ fontSize: '18px', margin: 0, fontWeight: '500' }}>
            No decks yet. Create your first deck to get started!
          </p>
        </div>
      )}

      {/* Floating "New Deck" Button */}
      <button
        onClick={() => setDeckEditorModal({ isOpen: true, deck: null })}
        style={{
          position: 'fixed',
          bottom: isMobile ? '20px' : '40px',
          right: isMobile ? '16px' : '40px',
          padding: isMobile ? '14px 24px' : '18px 36px',
          background: currentTheme.primary,
          color: 'white',
          border: 'none',
          borderRadius: '50px',
          fontSize: isMobile ? '14px' : '16px',
          fontWeight: '600',
          cursor: 'pointer',
          boxShadow: `0 12px 40px ${currentTheme.primary}40`,
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '8px' : '10px',
          letterSpacing: '0.3px',
          zIndex: 100
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05) translateY(-4px)';
          e.currentTarget.style.boxShadow = `0 20px 50px ${currentTheme.primary}40`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1) translateY(0)';
          e.currentTarget.style.boxShadow = `0 12px 40px ${currentTheme.primary}40`;
        }}
      >
        <LucideIcon name="plus" size={isMobile ? 18 : 20} color="white" />
        New Deck
      </button>

      {/* Deck Editor Modal */}
      <DeckEditorModal
        isOpen={deckEditorModal.isOpen}
        deck={deckEditorModal.deck}
        onSave={handleSaveDeck}
        onCancel={() => setDeckEditorModal({ isOpen: false, deck: null })}
        theme={currentTheme}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        message="Delete this deck and all its cards?"
        onConfirm={confirmDeleteDeck}
        onCancel={() => setDeleteConfirm({ isOpen: false, deckId: null })}
        confirmText="Delete"
        cancelText="Cancel"
        theme={currentTheme}
      />
    </div >
  );
}

export default DecksList;
