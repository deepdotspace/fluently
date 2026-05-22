import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { stripHTML, truncate } from '../../utils/helpers';
import { formatDueDate } from '../../utils/spacedRepetition';
import { saveCard, deleteCard, bulkDeleteCards, bulkMoveCards, bulkUpdateTags, bulkResetScheduling, getAllCards } from '../../utils/cardStorage';
import { useTheme } from '../../utils/ThemeContext';
import CardEditDialog from './CardEditDialog';
import PaginationControls from './PaginationControls';
import CustomDropdown from './CustomDropdown';
import LucideIcon from './LucideIcon';
import { renderCardTemplate, getCardType, getDefaultCardTypes } from '../../utils/fieldSystem';

// Helper function to strip style tags and their content
const stripStyleTags = (html) => {
  if (!html) return '';
  // Remove <style>...</style> tags and their content
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
};

// Helper function to get display text for any card type
const getCardDisplayText = (card, side, allCardTypes) => {
  // Safety check: if card or content is missing, return empty string
  if (!card || !card.content) {
    return '';
  }

  // New format: card type based
  if (card.cardTypeId && card.content?.fields) {
    const fields = card.content.fields || {};

    // Get card type to determine which fields to show for each side
    const cardType = getCardType(allCardTypes, card.cardTypeId);

    if (cardType) {
      // Get fields for the requested side
      const sideFields = cardType.fields?.filter(field => field.side === side) || [];

      if (sideFields.length > 0) {
        const parts = [];
        sideFields.forEach(field => {
          const fieldName = field.name;
          const fieldValue = fields[fieldName];
          if (fieldValue && fieldValue.trim()) {
            // Clean up audio tags and format the field
            const cleanValue = fieldValue.replace(/\n\[AUDIO:\d+\]/g, '').trim();
            if (cleanValue) {
              parts.push(`${fieldName}: ${cleanValue}`);
            }
          }
        });
        return parts.join(' | ');
      }
    }

    // Fallback: render template and strip HTML
    const cardTypeFallback = getCardType(allCardTypes, card.cardTypeId);

    if (cardTypeFallback) {
      if (side === 'front') {
        const rendered = renderCardTemplate(cardTypeFallback.frontTemplate, fields);
        const withoutStyles = stripStyleTags(rendered);
        return stripHTML(withoutStyles);
      } else {
        const rendered = renderCardTemplate(cardTypeFallback.backTemplate, fields, cardTypeFallback.frontTemplate);
        const withoutStyles = stripStyleTags(rendered);
        return stripHTML(withoutStyles);
      }
    }
  }

  // Legacy format: direct front/back
  if (card.type === 'Cloze') {
    if (side === 'front') {
      return stripHTML(card.content?.text || '');
    } else {
      // Show the cloze answers
      const answers = card.content?.clozes || [];
      return answers.join(', ');
    }
  } else {
    if (side === 'front') {
      return stripHTML(card.content?.front || '');
    } else {
      return stripHTML(card.content?.back || '');
    }
  }
};

function BrowseMode({ cards, cardMutations, decks, selectedDeckId, cardTypes = {}, updateCardTypes, mediaRecords, mediaMutations, isMobile = false }) {
  const theme = useTheme();

  // Merge default and custom/imported card types once
  const mergedCardTypes = useMemo(() => ({
    ...getDefaultCardTypes(),
    ...(cardTypes || {})
  }), [cardTypes]);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deckFilter, setDeckFilter] = useState([]);
  const [stateFilter, setStateFilter] = useState([]);
  const [tagFilter, setTagFilter] = useState([]);
  const [sortBy, setSortBy] = useState('dueDate');
  const [sortOrder, setSortOrder] = useState('asc');
  const [editingCard, setEditingCard] = useState(null);
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(null);
  const [bulkTargetDeck, setBulkTargetDeck] = useState('');
  const [bulkTags, setBulkTags] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const CARDS_PER_PAGE = 50;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Lazy load cards: only load cards for selected decks when filter is active
  // This improves performance when dealing with large card collections (3000+)
  const deckCards = useMemo(() => {
    if (deckFilter.length === 0) {
      // If no deck filter selected, show all cards from the cards prop
      return Object.values(cards);
    }

    // Filter cards from the cards map by selected decks
    return Object.values(cards).filter(card => deckFilter.includes(card.deckId));
  }, [cards, deckFilter]);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tags = new Set();
    deckCards.forEach(card => {
      card.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
  }, [deckCards]);

  // Filter and sort cards
  const filteredCards = useMemo(() => {
    let filtered = [...deckCards];

    // Search filter
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter(card => {
        // Get card type and fields for proper searching
        const cardType = card.cardTypeId ? getCardType(mergedCardTypes, card.cardTypeId) : null;

        if (cardType && card.content?.fields) {
          // New format: search through all field values
          const fields = card.content.fields;
          const searchableText = Object.values(fields).join(' ').toLowerCase();
          return searchableText.includes(query);
        } else {
          // Legacy format: search front and back
          if (!card.content) return false;

          if (card.type === 'Cloze') {
            const text = stripHTML(card.content?.text || '').toLowerCase();
            return text.includes(query);
          } else {
            const front = stripHTML(card.content?.front || '').toLowerCase();
            const back = stripHTML(card.content?.back || '').toLowerCase();
            return front.includes(query) || back.includes(query);
          }
        }
      });
    }

    // State filter
    if (stateFilter.length > 0) {
      filtered = filtered.filter(card =>
        stateFilter.includes(card.scheduling?.state)
      );
    }

    // Tag filter
    if (tagFilter.length > 0) {
      filtered = filtered.filter(card =>
        card.tags?.some(tag => tagFilter.includes(tag))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'dueDate': {
          const aIsNew = a.scheduling?.state === 'new';
          const bIsNew = b.scheduling?.state === 'new';
          if (aIsNew !== bIsNew) {
            return aIsNew ? 1 : -1;
          }

          const aDate = a.scheduling?.dueDate ? new Date(a.scheduling.dueDate).getTime() : null;
          const bDate = b.scheduling?.dueDate ? new Date(b.scheduling.dueDate).getTime() : null;
          const aValid = aDate !== null && !isNaN(aDate);
          const bValid = bDate !== null && !isNaN(bDate);
          if (aValid && bValid) {
            comparison = aDate - bDate;
          } else if (aValid && !bValid) {
            return -1;
          } else if (!aValid && bValid) {
            return 1;
          } else {
            comparison = 0;
          }
          break;
        }
        case 'state':
          comparison = (a.scheduling?.state || '').localeCompare(b.scheduling?.state || '');
          break;
        case 'front':
          const aText = getCardDisplayText(a, 'front', mergedCardTypes);
          const bText = getCardDisplayText(b, 'front', mergedCardTypes);
          comparison = aText.localeCompare(bText);
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [deckCards, debouncedSearch, stateFilter, tagFilter, sortBy, sortOrder]);

  // Pagination: slice filtered cards to current page
  const paginatedCards = useMemo(() => {
    const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
    return filteredCards.slice(startIndex, startIndex + CARDS_PER_PAGE);
  }, [filteredCards, currentPage]);

  const totalPages = Math.ceil(filteredCards.length / CARDS_PER_PAGE);

  // Memoize card display text to avoid expensive HTML parsing
  const displayTextCache = useMemo(() => {
    const cache = new Map();
    return {
      get: (cardId, side) => {
        const key = `${cardId}-${side}`;
        if (!cache.has(key)) {
          const card = cards[cardId];
          if (card) {
            cache.set(key, getCardDisplayText(card, side, mergedCardTypes));
          }
        }
        return cache.get(key) || '';
      }
    };
  }, [cards, mergedCardTypes]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [deckFilter, stateFilter, tagFilter, debouncedSearch, sortBy, sortOrder]);

  const toggleDeckFilter = (deckId) => {
    setDeckFilter(prev =>
      prev.includes(deckId)
        ? prev.filter(d => d !== deckId)
        : [...prev, deckId]
    );
  };

  const toggleStateFilter = (state) => {
    setStateFilter(prev =>
      prev.includes(state)
        ? prev.filter(s => s !== state)
        : [...prev, state]
    );
  };

  const toggleTagFilter = (tag) => {
    setTagFilter(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleDelete = (cardId) => {
    const card = cards[cardId];
    if (card) {
      deleteCard(cardMutations, card, mediaMutations, mediaRecords);
    }
    if (editingCard?.id === cardId) {
      setEditingCard(null);
    }
  };

  const handleSuspend = (cardId) => {
    const card = cards[cardId];
    if (!card) return;

    const updatedCard = {
      ...card,
      scheduling: {
        ...(card.scheduling || {}),
        state: card.scheduling?.state === 'suspended' ? 'new' : 'suspended'
      }
    };
    saveCard(cardMutations, updatedCard);
  };

  // Bulk operations handlers
  const toggleCardSelection = (cardId) => {
    setSelectedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const selectAllFiltered = () => {
    const allIds = new Set(filteredCards.map(c => c.id));
    setSelectedCards(allIds);
  };

  const deselectAll = () => {
    setSelectedCards(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedCards.size === 0) return;

    const result = bulkDeleteCards(cardMutations, Array.from(selectedCards), cards, mediaMutations, mediaRecords);
    setSelectedCards(new Set());
    setBulkAction(null);
  };

  const handleBulkMove = () => {
    if (selectedCards.size === 0 || !bulkTargetDeck) return;

    const result = bulkMoveCards(cardMutations, Array.from(selectedCards), cards, bulkTargetDeck);
    setSelectedCards(new Set());
    setBulkAction(null);
    setBulkTargetDeck('');
  };

  const handleBulkTags = (action) => {
    if (selectedCards.size === 0 || !bulkTags.trim()) return;

    const tags = bulkTags.split(',').map(t => t.trim()).filter(Boolean);
    if (tags.length === 0) return;

    const tagsToAdd = action === 'add' ? tags : [];
    const tagsToRemove = action === 'remove' ? tags : [];

    const result = bulkUpdateTags(cardMutations, Array.from(selectedCards), cards, tagsToAdd, tagsToRemove);
    setSelectedCards(new Set());
    setBulkAction(null);
    setBulkTags('');
  };

  const handleBulkReset = () => {
    if (selectedCards.size === 0) return;

    const result = bulkResetScheduling(cardMutations, Array.from(selectedCards), cards);
    setSelectedCards(new Set());
    setBulkAction(null);
  };

  return (
    <>
      {/* Card Edit Dialog */}
      {editingCard && (
        <CardEditDialog
          card={editingCard}
          cardMutations={cardMutations}
          mediaRecords={mediaRecords}
          mediaMutations={mediaMutations}
          decks={decks}
          cardTypes={cardTypes}
          updateCardTypes={updateCardTypes}
          theme={theme}
          onClose={() => setEditingCard(null)}
          onSave={() => {
            setEditingCard(null);
          }}
        />
      )}

      {/* Bulk Action Dialog */}
      {bulkAction && selectedCards.size > 0 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: isMobile ? 'flex-end' : 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: isMobile ? '0' : '20px'
        }} onClick={() => setBulkAction(null)}>
          <div style={{
            background: 'white',
            borderRadius: isMobile ? '20px 20px 0 0' : '16px',
            padding: isMobile ? '20px 16px 28px' : '24px',
            maxWidth: isMobile ? '100%' : '500px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{
              margin: '0 0 20px 0',
              fontSize: '18px',
              fontWeight: '600',
              color: theme.textPrimary
            }}>
              {bulkAction === 'delete' && 'Delete Cards'}
              {bulkAction === 'move' && 'Move Cards'}
              {bulkAction === 'tags' && 'Manage Tags'}
              {bulkAction === 'reset' && 'Reset Progress'}
            </h3>

            {bulkAction === 'delete' && (
              <div>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: theme.textSecondary }}>
                  Are you sure you want to permanently delete {selectedCards.size} card{selectedCards.size > 1 ? 's' : ''}?
                  This action cannot be undone.
                </p>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setBulkAction(null)}
                    style={{
                      padding: isMobile ? '12px 20px' : '10px 20px',
                      fontSize: '14px',
                      borderRadius: '8px',
                      border: `1px solid ${theme.cardBorder}`,
                      background: 'white',
                      cursor: 'pointer',
                      width: isMobile ? '100%' : undefined
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      handleBulkDelete();
                      setBulkAction(null);
                    }}
                    style={{
                      padding: isMobile ? '12px 20px' : '10px 20px',
                      fontSize: '14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#EF4444',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: '600',
                      width: isMobile ? '100%' : undefined
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            {bulkAction === 'move' && (
              <div>
                <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: theme.textSecondary }}>
                  Move {selectedCards.size} card{selectedCards.size > 1 ? 's' : ''} to:
                </p>
                <CustomDropdown
                  value={bulkTargetDeck}
                  onChange={(val) => setBulkTargetDeck(val || '')}
                  options={Object.entries(decks).map(([deckId, deck]) => ({ value: deckId, label: deck.name }))}
                  placeholder="Select deck..."
                  theme={theme}
                  style={{ width: '100%', marginBottom: '20px' }}
                />
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setBulkAction(null);
                      setBulkTargetDeck('');
                    }}
                    style={{
                      padding: isMobile ? '12px 20px' : '10px 20px',
                      fontSize: '14px',
                      borderRadius: '8px',
                      border: `1px solid ${theme.cardBorder}`,
                      background: 'white',
                      cursor: 'pointer',
                      width: isMobile ? '100%' : undefined
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      handleBulkMove();
                      setBulkAction(null);
                    }}
                    disabled={!bulkTargetDeck}
                    style={{
                      padding: isMobile ? '12px 20px' : '10px 20px',
                      fontSize: '14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: bulkTargetDeck ? theme.primary : '#D1D5DB',
                      color: 'white',
                      cursor: bulkTargetDeck ? 'pointer' : 'not-allowed',
                      fontWeight: '600',
                      width: isMobile ? '100%' : undefined
                    }}
                  >
                    Move
                  </button>
                </div>
              </div>
            )}

            {bulkAction === 'tags' && (
              <div>
                <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: theme.textSecondary }}>
                  Enter tags (comma-separated):
                </p>
                <input
                  type="text"
                  value={bulkTags}
                  onChange={(e) => setBulkTags(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                  style={{
                    width: '100%',
                    padding: isMobile ? '12px 14px' : '10px 12px',
                    fontSize: '14px',
                    borderRadius: '8px',
                    border: `1px solid ${theme.cardBorder}`,
                    background: 'white',
                    marginBottom: '20px',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', gap: isMobile ? '8px' : '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setBulkAction(null);
                      setBulkTags('');
                    }}
                    style={{
                      padding: isMobile ? '12px 20px' : '10px 20px',
                      fontSize: '14px',
                      borderRadius: '8px',
                      border: `1px solid ${theme.cardBorder}`,
                      background: 'white',
                      cursor: 'pointer',
                      width: isMobile ? '100%' : undefined
                    }}
                  >
                    Cancel
                  </button>
                  <div style={{ display: 'flex', gap: isMobile ? '8px' : '12px', flexDirection: isMobile ? 'column' : 'row' }}>
                    <button
                      onClick={() => {
                        handleBulkTags('add');
                        setBulkAction(null);
                      }}
                      disabled={!bulkTags.trim()}
                      style={{
                        padding: isMobile ? '12px 20px' : '10px 20px',
                        fontSize: '14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: bulkTags.trim() ? '#10B981' : '#D1D5DB',
                        color: 'white',
                        cursor: bulkTags.trim() ? 'pointer' : 'not-allowed',
                        fontWeight: '600',
                        width: isMobile ? '100%' : undefined
                      }}
                    >
                      Add Tags
                    </button>
                    <button
                      onClick={() => {
                        handleBulkTags('remove');
                        setBulkAction(null);
                      }}
                      disabled={!bulkTags.trim()}
                      style={{
                        padding: isMobile ? '12px 20px' : '10px 20px',
                        fontSize: '14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: bulkTags.trim() ? '#EF4444' : '#D1D5DB',
                        color: 'white',
                        cursor: bulkTags.trim() ? 'pointer' : 'not-allowed',
                        fontWeight: '600',
                        width: isMobile ? '100%' : undefined
                      }}
                    >
                      Remove Tags
                    </button>
                  </div>
                </div>
              </div>
            )}

            {bulkAction === 'reset' && (
              <div>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: theme.textSecondary }}>
                  Reset progress for {selectedCards.size} card{selectedCards.size > 1 ? 's' : ''}?
                  This will set them back to 'new' state and clear their review history.
                </p>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setBulkAction(null)}
                    style={{
                      padding: isMobile ? '12px 20px' : '10px 20px',
                      fontSize: '14px',
                      borderRadius: '8px',
                      border: `1px solid ${theme.cardBorder}`,
                      background: 'white',
                      cursor: 'pointer',
                      width: isMobile ? '100%' : undefined
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      handleBulkReset();
                      setBulkAction(null);
                    }}
                    style={{
                      padding: isMobile ? '12px 20px' : '10px 20px',
                      fontSize: '14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#F59E0B',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: '600',
                      width: isMobile ? '100%' : undefined
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Browse Interface */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '12px' : '24px',
        padding: isMobile ? '8px 0' : '24px 16px',
        height: '100%',
        maxHeight: '100%',
        width: '100%',
        boxSizing: 'border-box',
        overflow: isMobile ? 'auto' : 'hidden'
      }}>
        {/* Mobile: Search + Filter Toggle */}
        {isMobile && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search cards..."
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: `1px solid ${theme.cardBorder}`,
                fontSize: '14px',
                outline: 'none',
                background: 'rgba(255, 255, 255, 0.6)',
                color: theme.textPrimary
              }}
            />
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                border: `1px solid ${showMobileFilters ? theme.primary : theme.cardBorder}`,
                background: showMobileFilters ? `${theme.primary}15` : 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <LucideIcon name="sliders-horizontal" size={18} color={showMobileFilters ? theme.primary : theme.textSecondary} />
            </button>
          </div>
        )}

        {/* Left Sidebar - Filters (hidden on mobile unless toggled) */}
        <div
          className="filter-sidebar-container"
          style={{
            flexShrink: 0,
            height: isMobile ? 'auto' : '100%',
            display: isMobile && !showMobileFilters ? 'none' : 'flex',
            flexDirection: 'column'
          }}
        >
          <div
            className="filter-sidebar"
            style={{
              background: theme.cardBg,
              backdropFilter: `blur(${theme.backdropBlur})`,
              WebkitBackdropFilter: `blur(${theme.backdropBlur})`,
              borderRadius: isMobile ? '12px' : '16px',
              border: `1px solid ${theme.cardBorder}`,
              padding: isMobile ? '16px' : '24px',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)',
              height: isMobile ? 'auto' : 'calc(100% - 10px)',
              maxHeight: isMobile ? '300px' : 'calc(100% - 10px)',
              overflowY: 'auto',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              width: isMobile ? '100%' : undefined
            }}
          >
            {/* Search */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: theme.textSecondary,
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Search
              </label>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search cards..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: `1px solid ${theme.cardBorder}`,
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  background: 'rgba(255, 255, 255, 0.6)',
                  color: theme.textPrimary
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = theme.primary;
                  e.target.style.boxShadow = `0 0 0 3px ${theme.primary}20`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = theme.cardBorder;
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>


            {/* Deck Filter */}
            {decks && Object.keys(decks).length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: theme.textSecondary,
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Deck
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(decks).map(([deckId, deck]) => (
                    <label key={deckId} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '8px',
                      transition: 'background 0.2s ease'
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={deckFilter.includes(deckId)}
                        onChange={() => toggleDeckFilter(deckId)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{
                        fontSize: '14px',
                        color: theme.textPrimary
                      }}>
                        {deck.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* State Filter */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: theme.textSecondary,
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                State
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['new', 'learning', 'review'].map(state => (
                  <label key={state} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    transition: 'background 0.2s ease'
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <input
                      type="checkbox"
                      checked={stateFilter.includes(state)}
                      onChange={() => toggleStateFilter(state)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{
                      fontSize: '14px',
                      color: theme.textPrimary,
                      textTransform: 'capitalize'
                    }}>
                      {state}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tag Filter */}
            {allTags.length > 0 && (
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: theme.textSecondary,
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Tags
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {allTags.map(tag => (
                    <label key={tag} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '8px',
                      transition: 'background 0.2s ease'
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={tagFilter.includes(tag)}
                        onChange={() => toggleTagFilter(tag)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{
                        fontSize: '14px',
                        color: theme.textPrimary
                      }}>
                        {tag}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Clear Filters */}
            {(deckFilter.length > 0 || stateFilter.length > 0 || tagFilter.length > 0 || searchInput) && (
              <button
                onClick={() => {
                  setDeckFilter([]);
                  setStateFilter([]);
                  setTagFilter([]);
                  setSearchInput('');
                }}
                style={{
                  width: '100%',
                  marginTop: '20px',
                  padding: '10px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.cardBorder}`,
                  background: 'rgba(255, 255, 255, 0.6)',
                  color: theme.textSecondary,
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)';
                  e.currentTarget.style.borderColor = theme.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)';
                  e.currentTarget.style.borderColor = theme.cardBorder;
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Main Content - Table */}
        <div style={{
          flex: 1,
          minWidth: 0,
          width: '100%',
          height: '100%',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Bulk Actions Bar - Compact Top Bar */}
          {selectedCards.size > 0 && (
            <div style={{
              background: theme.primary + '15',
              border: `1px solid ${theme.primary}`,
              borderRadius: isMobile ? '10px' : '12px',
              padding: isMobile ? '10px 12px' : '10px 16px',
              marginBottom: isMobile ? '8px' : '16px',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: isMobile ? '8px' : '10px',
              flexShrink: 0
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isMobile ? 'space-between' : 'flex-start',
                gap: '10px'
              }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: theme.textPrimary }}>
                  {selectedCards.size} selected
                </span>
                <button
                  onClick={deselectAll}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.cardBorder}`,
                    background: 'white',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              </div>
              {!isMobile && <div style={{ width: '1px', height: '20px', background: theme.cardBorder, margin: '0 4px' }} />}
              <div style={{
                display: 'flex',
                gap: isMobile ? '6px' : '10px',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => setBulkAction('delete')}
                  style={{
                    padding: isMobile ? '8px 14px' : '6px 12px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#EF4444',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    flex: isMobile ? '1 1 auto' : undefined
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setBulkAction('move')}
                  style={{
                    padding: isMobile ? '8px 14px' : '6px 12px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: theme.primary,
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    flex: isMobile ? '1 1 auto' : undefined
                  }}
                >
                  Move
                </button>
                <button
                  onClick={() => setBulkAction('tags')}
                  style={{
                    padding: isMobile ? '8px 14px' : '6px 12px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#10B981',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    flex: isMobile ? '1 1 auto' : undefined
                  }}
                >
                  Tags
                </button>
                <button
                  onClick={() => setBulkAction('reset')}
                  style={{
                    padding: isMobile ? '8px 14px' : '6px 12px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#F59E0B',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    flex: isMobile ? '1 1 auto' : undefined
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          )}
          <div style={{
            background: theme.cardBg,
            backdropFilter: `blur(${theme.backdropBlur})`,
            WebkitBackdropFilter: `blur(${theme.backdropBlur})`,
            borderRadius: isMobile ? '12px' : '16px',
            border: `1px solid ${theme.cardBorder}`,
            overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)',
            flex: 1,
            minHeight: 0,
            height: '100%',
            maxHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box'
          }}>
            {/* Table/Card List */}
            <div style={{
              flex: 1,
              overflowX: isMobile ? 'hidden' : 'auto',
              overflowY: 'auto'
            }}>
              {/* Desktop: Table Header */}
              {!isMobile && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 100px minmax(250px, 1fr) minmax(250px, 1fr) 120px 100px',
                  gap: '12px',
                  minWidth: '860px',
                  padding: '16px',
                  background: theme.highlight,
                  borderBottom: `1px solid ${theme.cardBorder}`,
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedCards.size === filteredCards.length && filteredCards.length > 0}
                      onChange={(e) => e.target.checked ? selectAllFiltered() : deselectAll()}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </div>
                  <HeaderCell label="State" sortKey="state" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} theme={theme} />
                  <HeaderCell label="Front" sortKey="front" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} theme={theme} />
                  <HeaderCell label="Back" theme={theme} />
                  <HeaderCell label="Due Date" sortKey="dueDate" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} theme={theme} />
                  <HeaderCell label="Actions" theme={theme} />
                </div>
              )}

              {/* Mobile: Compact summary bar */}
              {isMobile && (
                <div style={{
                  padding: '10px 12px',
                  background: theme.highlight,
                  borderBottom: `1px solid ${theme.cardBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  fontSize: '13px',
                  color: theme.textSecondary,
                  fontWeight: '600',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={selectedCards.size === filteredCards.length && filteredCards.length > 0}
                      onChange={(e) => e.target.checked ? selectAllFiltered() : deselectAll()}
                      style={{ cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0 }}
                    />
                    <span style={{ whiteSpace: 'nowrap' }}>{filteredCards.length} card{filteredCards.length !== 1 ? 's' : ''}</span>
                  </div>
                  <button
                    onClick={() => handleSort('dueDate')}
                    style={{
                      padding: '5px 10px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: `1px solid ${sortBy === 'dueDate' ? theme.primary : theme.cardBorder}`,
                      background: sortBy === 'dueDate' ? `${theme.primary}15` : 'transparent',
                      color: sortBy === 'dueDate' ? theme.primary : theme.textSecondary,
                      cursor: 'pointer',
                      fontWeight: '600',
                      flexShrink: 0
                    }}
                  >
                    Due {sortBy === 'dueDate' ? (sortOrder === 'asc' ? '\u2191' : '\u2193') : ''}
                  </button>
                </div>
              )}

              {/* Card list */}
              <div style={{ minWidth: isMobile ? undefined : '860px' }}>
                {filteredCards.length === 0 ? (
                  <div style={{
                    padding: isMobile ? '40px 20px' : '60px',
                    textAlign: 'center',
                    color: theme.textSecondary,
                    fontSize: '15px',
                    opacity: 0.7
                  }}>
                    No cards found
                  </div>
                ) : isMobile ? (
                  paginatedCards.map(card => {
                    const frontText = displayTextCache.get(card.id, 'front');
                    const backText = displayTextCache.get(card.id, 'back');
                    const stateColor = card.scheduling?.state === 'new' ? '#3B82F6'
                      : card.scheduling?.state === 'learning' ? '#F59E0B'
                      : card.scheduling?.state === 'review' ? '#10B981'
                      : card.scheduling?.state === 'suspended' ? '#6B7280'
                      : theme.textSecondary;
                    const isCardSelected = selectedCards.has(card.id);
                    return (
                      <div
                        key={card.id}
                        onClick={() => setEditingCard(card)}
                        style={{
                          padding: '14px 14px',
                          borderBottom: `1px solid ${theme.cardBorder}50`,
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          background: isCardSelected ? `${theme.primary}10` : 'transparent',
                          minHeight: '48px'
                        }}
                      >
                        <div
                          onClick={(e) => { e.stopPropagation(); toggleCardSelection(card.id); }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            width: '28px',
                            height: '28px'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isCardSelected}
                            onChange={() => toggleCardSelection(card.id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: '700',
                              color: stateColor,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background: `${stateColor}15`,
                              flexShrink: 0
                            }}>
                              {card.scheduling?.state || 'new'}
                            </span>
                            <span style={{ fontSize: '11px', color: theme.textSecondary, opacity: 0.7 }}>
                              {card.scheduling?.state === 'new' ? '–' : (card.scheduling?.dueDate ? formatDueDate(card.scheduling.dueDate) : '–')}
                            </span>
                          </div>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '500',
                            color: theme.textPrimary,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginBottom: '2px'
                          }}>
                            {truncate(stripHTML(frontText), 55)}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: theme.textSecondary,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            opacity: 0.7
                          }}>
                            {truncate(stripHTML(backText), 55)}
                          </div>
                        </div>
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}
                        >
                          <button
                            onClick={() => handleDelete(card.id)}
                            title="Delete"
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '7px',
                              border: `1px solid ${theme.cardBorder}`,
                              background: 'rgba(255,255,255,0.5)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <LucideIcon name="trash-2" size={14} color="#EF4444" />
                          </button>
                          <button
                            onClick={() => handleSuspend(card.id)}
                            title={card.scheduling?.state === 'suspended' ? 'Resume' : 'Suspend'}
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '7px',
                              border: `1px solid ${theme.cardBorder}`,
                              background: 'rgba(255,255,255,0.5)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <LucideIcon name={card.scheduling?.state === 'suspended' ? 'play' : 'pause'} size={14} color={theme.textSecondary} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  paginatedCards.map(card => (
                    <CardRow
                      key={card.id}
                      card={card}
                      onExpand={() => setEditingCard(card)}
                      onDelete={() => handleDelete(card.id)}
                      onSuspend={() => handleSuspend(card.id)}
                      theme={theme}
                      isSelected={selectedCards.has(card.id)}
                      onToggleSelect={() => toggleCardSelection(card.id)}
                      displayTextCache={displayTextCache}
                      mergedCardTypes={mergedCardTypes}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Pagination Controls */}
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalCards={filteredCards.length}
              cardsPerPage={CARDS_PER_PAGE}
              onPageChange={setCurrentPage}
              theme={theme}
              isMobile={isMobile}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function HeaderCell({ label, sortKey, currentSort, sortOrder, onSort, theme }) {
  const isSortable = !!sortKey;
  const isActive = currentSort === sortKey;

  return (
    <div
      onClick={() => isSortable && onSort(sortKey)}
      style={{
        fontSize: '12px',
        fontWeight: '600',
        color: theme?.textSecondary || '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        cursor: isSortable ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        userSelect: 'none'
      }}
    >
      {label}
      {isSortable && (
        <span style={{
          opacity: isActive ? 1 : 0.3,
          fontSize: '10px',
          display: 'flex',
          alignItems: 'center'
        }}>
          {isActive && sortOrder === 'asc' ? <LucideIcon name="ChevronUp" size={12} /> : <LucideIcon name="ChevronDown" size={12} />}
        </span>
      )}
    </div>
  );
}

function TextCell({ text, theme }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState({ top: 0, left: 0, triangleLeft: 16 });
  const cellRef = useRef(null);
  const textRef = useRef(null);
  const tooltipRef = useRef(null);
  const hideTimeoutRef = useRef(null);

  // Clear any pending hide timeout
  const cancelHide = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  // Schedule hiding the tooltip after a short delay (allows mouse to reach the portal tooltip)
  const scheduleHide = () => {
    cancelHide();
    hideTimeoutRef.current = setTimeout(() => {
      setShowTooltip(false);
    }, 100);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => cancelHide();
  }, []);

  const handleMouseEnter = () => {
    cancelHide();
    // Detect visual truncation: is the text actually clipped by CSS ellipsis?
    if (!textRef.current || textRef.current.scrollWidth <= textRef.current.clientWidth) {
      return;
    }

    if (cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      const tooltipWidth = 350;
      const padding = 16;
      const viewportWidth = window.innerWidth;

      // Always position below the cell
      const top = rect.bottom + 8;

      // Center tooltip horizontally under the cell, then clamp to viewport
      let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
      // Clamp right edge
      if (left + tooltipWidth > viewportWidth - padding) {
        left = viewportWidth - tooltipWidth - padding;
      }
      // Clamp left edge
      if (left < padding) {
        left = padding;
      }

      // Triangle points to the horizontal center of the cell
      const cellCenter = rect.left + rect.width / 2;
      let triangleLeft = cellCenter - left;
      triangleLeft = Math.max(16, Math.min(triangleLeft, tooltipWidth - 28));

      setTooltipStyle({ top, left, triangleLeft });
    }

    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    scheduleHide();
  };

  return (
    <div
      ref={cellRef}
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center'
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={textRef}
        style={{
          fontSize: '14px',
          color: theme.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
          textAlign: 'left'
        }}
      >
        {text}
      </div>

      {showTooltip && createPortal(
        <div
          ref={tooltipRef}
          onMouseEnter={cancelHide}
          onMouseLeave={() => setShowTooltip(false)}
          style={{
            position: 'fixed',
            top: `${tooltipStyle.top}px`,
            left: `${tooltipStyle.left}px`,
            zIndex: 10000,
            maxWidth: '400px',
            width: '350px',
            maxHeight: '120px',
            overflowY: 'auto',
            padding: '12px 16px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '12px',
            border: `1px solid ${theme.cardBorder}`,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            fontSize: '13px',
            lineHeight: '1.5',
            color: theme.textPrimary,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            animation: 'tooltipFadeIn 0.2s ease',
            pointerEvents: 'auto',
            boxSizing: 'border-box',
            cursor: 'default'
          }}
        >
          {text}
          {/* Triangle pointer pointing up */}
          <div style={{
            position: 'absolute',
            top: '-6px',
            left: `${tooltipStyle.triangleLeft}px`,
            width: '12px',
            height: '12px',
            background: 'rgba(255, 255, 255, 0.95)',
            border: `1px solid ${theme.cardBorder}`,
            borderBottom: 'none',
            borderRight: 'none',
            transform: 'rotate(45deg)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }} />
        </div>,
        document.body
      )}

      <style>{`
        @keyframes tooltipFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .filter-sidebar-container {
          width: 280px;
        }

        @media (max-width: 1024px) {
          .filter-sidebar-container {
            width: 240px;
          }
        }

        @media (max-width: 768px) {
          .filter-sidebar-container {
            width: 200px;
          }
        }

        @media (max-width: 640px) {
          .filter-sidebar-container {
            width: 180px;
          }

          .filter-sidebar {
            padding: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}

function CardRow({ card, onExpand, onDelete, onSuspend, theme, isSelected, onToggleSelect, displayTextCache, mergedCardTypes }) {
  const [hovering, setHovering] = useState(false);

  const stateColors = {
    new: '#3B82F6',
    learning: '#F59E0B',
    review: '#10B981',
    suspended: '#6B7280'
  };

  return (
    <div
      onClick={onExpand}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 100px minmax(250px, 1fr) minmax(250px, 1fr) 120px 100px',
        gap: '12px',
        padding: '16px',
        borderBottom: `1px solid ${theme.cardBorder}`,
        outline: hovering ? `2px solid ${theme.primary}` : 'none',
        outlineOffset: '-2px',
        transition: 'outline 0.15s ease',
        cursor: 'pointer',
        alignItems: 'center',
        background: isSelected ? theme.primary + '10' : 'transparent'
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
        />
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start'
      }}>
        <span style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: '600',
          color: 'white',
          background: stateColors[card.scheduling?.state] || '#9CA3AF',
          textTransform: 'capitalize',
          whiteSpace: 'nowrap'
        }}>
          {card.scheduling?.state || 'unknown'}
        </span>
      </div>
      <div><TextCell text={displayTextCache ? displayTextCache.get(card.id, 'front') : getCardDisplayText(card, 'front', mergedCardTypes)} theme={theme} /></div>
      <div><TextCell text={displayTextCache ? displayTextCache.get(card.id, 'back') : getCardDisplayText(card, 'back', mergedCardTypes)} theme={theme} /></div>
      <div style={{
        fontSize: '13px',
        color: theme.textSecondary,
        display: 'flex',
        alignItems: 'center',
        whiteSpace: 'nowrap'
      }}>
        {card.scheduling?.state === 'new' ? '–' : formatDueDate(card.scheduling?.dueDate)}
      </div>
      <div style={{
        display: 'flex',
        gap: '6px',
        alignItems: 'center',
        justifyContent: 'flex-start'
      }} onClick={(e) => e.stopPropagation()}>
        <ActionButton
          icon={card.scheduling?.state === 'suspended' ? 'play' : 'pause'}
          tooltip={card.scheduling?.state === 'suspended' ? 'Resume' : 'Suspend'}
          onClick={onSuspend}
          theme={theme}
        />
        <ActionButton
          icon="trash-2"
          tooltip="Delete"
          onClick={onDelete}
          color="#EF4444"
          theme={theme}
        />
      </div>
    </div>
  );
}

function ActionButton({ icon, tooltip, onClick, color = '#6B7280', theme }) {
  const [hovering, setHovering] = useState(false);

  return (
    <button
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={onClick}
      title={tooltip}
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        border: `1px solid ${theme.cardBorder}`,
        background: hovering ? theme.highlight : 'rgba(255, 255, 255, 0.5)',
        color: hovering ? color : theme.textSecondary,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        transition: 'all 0.15s ease'
      }}
    >
      <LucideIcon name={icon} size={16} color={hovering ? color : theme.textSecondary} />
    </button>
  );
}

export default BrowseMode;
