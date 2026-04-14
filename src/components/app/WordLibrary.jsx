import React, { useState, useEffect, useMemo, useCallback } from 'react';
import WordList from './WordList';
import WordDetail from './WordDetail';
import CreateCardModal from './CreateCardModal';
import CustomDropdown from './CustomDropdown';
import LucideIcon from './LucideIcon';
import {
  loadDataset,
  filterDataset,
  sortDataset,
  paginateDataset,
  getWordsByIds,
  SUPPORTED_LANGUAGES,
  CEFR_LEVELS,
  POS_OPTIONS
} from '../../utils/dataset';
import { getExistingCardWords, saveCard } from '../../utils/cardStorage';

/**
 * WordLibrary Component
 * Displays vocabulary library with filtering, search, and card creation
 */
function WordLibrary({ decks, cards, cardMutations, theme }) {
  // Language and dataset state
  const [selectedLanguage, setSelectedLanguage] = useState('Spanish');
  const [dataset, setDataset] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Filter state
  const [selectedCefrLevels, setSelectedCefrLevels] = useState(['A1', 'A2']);
  const [selectedPos, setSelectedPos] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('frequency');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Selection state
  const [selectedWords, setSelectedWords] = useState(new Set());
  const [selectedWord, setSelectedWord] = useState(null);

  // Existing card words tracking
  const [existingCardWords, setExistingCardWords] = useState(new Set());

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [wordsToCreate, setWordsToCreate] = useState([]);

  // Load dataset when language changes
  useEffect(() => {
    const loadLanguageDataset = async () => {
      setLoading(true);
      setLoadError(null);
      setDataset([]);
      setSelectedWords(new Set());
      setSelectedWord(null);
      setCurrentPage(1);

      try {
        const data = await loadDataset(selectedLanguage);
        setDataset(data);
      } catch (error) {
        console.error('Failed to load dataset:', error);
        setLoadError(error.message);
      } finally {
        setLoading(false);
      }
    };

    if (selectedLanguage) {
      loadLanguageDataset();
    }
  }, [selectedLanguage]);

  // Load existing card words from the cards map
  useEffect(() => {
    if (cards) {
      const words = getExistingCardWords(cards);
      setExistingCardWords(words);
    }
  }, [cards]);

  // Calculate words hidden due to existing cards
  const wordsHiddenCount = useMemo(() => {
    if (!dataset || dataset.length === 0) return 0;

    const withoutExclusion = filterDataset(dataset, {
      cefrLevels: selectedCefrLevels,
      pos: selectedPos,
      search: searchQuery,
      usefulOnly: true
    });

    const withExclusion = filterDataset(dataset, {
      cefrLevels: selectedCefrLevels,
      pos: selectedPos,
      search: searchQuery,
      usefulOnly: true
    }, existingCardWords);

    return withoutExclusion.length - withExclusion.length;
  }, [dataset, selectedCefrLevels, selectedPos, searchQuery, existingCardWords]);

  // Filter and sort dataset
  const filteredAndSortedDataset = useMemo(() => {
    if (!dataset || dataset.length === 0) return [];

    const filtered = filterDataset(dataset, {
      cefrLevels: selectedCefrLevels,
      pos: selectedPos,
      search: searchQuery,
      usefulOnly: true
    }, existingCardWords);

    return sortDataset(filtered, sortBy);
  }, [dataset, selectedCefrLevels, selectedPos, searchQuery, sortBy, existingCardWords]);

  // Paginate dataset
  const paginatedData = useMemo(() => {
    return paginateDataset(filteredAndSortedDataset, currentPage, pageSize);
  }, [filteredAndSortedDataset, currentPage, pageSize]);

  // Handle CEFR level toggle
  const handleCefrToggle = (level) => {
    setSelectedCefrLevels(prev => {
      const newLevels = prev.includes(level)
        ? prev.filter(l => l !== level)
        : [...prev, level];
      return newLevels.length > 0 ? newLevels : prev; // Keep at least one
    });
    setCurrentPage(1);
  };

  // Handle word selection
  const handleSelectWord = (word) => {
    setSelectedWord(word);
  };

  // Handle multi-select toggle
  const handleToggleSelect = (wordId) => {
    setSelectedWords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(wordId)) {
        newSet.delete(wordId);
      } else {
        newSet.add(wordId);
      }
      return newSet;
    });
  };

  // Handle select all
  const handleSelectAll = (selected) => {
    if (selected) {
      const allWordIds = paginatedData.items.map(w => w.word);
      setSelectedWords(new Set(allWordIds));
    } else {
      setSelectedWords(new Set());
    }
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    setSelectedWords(new Set()); // Clear selection on page change
  };

  // Handle create card
  const handleCreateCard = (words) => {
    setWordsToCreate(words);
    setShowCreateModal(true);
  };

  // Handle batch create from selection
  const handleBatchCreate = () => {
    const words = getWordsByIds(filteredAndSortedDataset, Array.from(selectedWords));
    handleCreateCard(words);
  };

  // Handle create cards (save to storage)
  const handleCreateCards = useCallback(async (newCards) => {
    if (!cardMutations) return;

    for (const card of newCards) {
      try {
        saveCard(cardMutations, card);
      } catch (error) {
        console.error(`Failed to save card:`, error);
      }
    }

    // Clear selection (existing words will update via cards prop reactively)
    setSelectedWords(new Set());
  }, [cardMutations]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 200px)',
      maxHeight: '1040px',
      minHeight: '780px',
      overflow: 'hidden'
    }}>
      {/* Filter Bar */}
      <div style={{
        padding: '16px 24px',
        background: 'rgba(255, 255, 255, 0.3)',
        backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${theme.cardBorder}`,
        marginBottom: '24px',
        flexShrink: 0,
        position: 'relative',
        zIndex: 100
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          {/* Language Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              color: theme.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Language:
            </span>
            <CustomDropdown
              value={selectedLanguage}
              onChange={(val) => val && setSelectedLanguage(val)}
              options={SUPPORTED_LANGUAGES.map(lang => ({ value: lang, label: lang }))}
              placeholder="Select Language"
              theme={theme}
              style={{ minWidth: '120px' }}
              fontSize="12px"
              padding="6px 12px"
            />
          </div>

          {/* CEFR Level Filters */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              color: theme.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Level:
            </span>
            {CEFR_LEVELS.map(level => {
              const isSelected = selectedCefrLevels.includes(level);
              return (
                <button
                  key={level}
                  onClick={() => handleCefrToggle(level)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${isSelected ? theme.primary : theme.cardBorder}`,
                    background: isSelected ? theme.primary + '15' : 'rgba(255, 255, 255, 0.5)',
                    color: isSelected ? theme.primary : theme.textSecondary,
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = theme.primary + '60';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = theme.cardBorder;
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                    }
                  }}
                >
                  {level}
                </button>
              );
            })}
          </div>

          {/* Part of Speech Filter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              color: theme.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              POS:
            </span>
            <CustomDropdown
              value={selectedPos}
              onChange={(val) => {
                setSelectedPos(val || 'all');
                setCurrentPage(1);
              }}
              options={POS_OPTIONS}
              placeholder="All POS"
              theme={theme}
              style={{ minWidth: '100px' }}
              fontSize="12px"
              padding="6px 12px"
            />
          </div>

          {/* Sort By */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              color: theme.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Sort:
            </span>
            <CustomDropdown
              value={sortBy}
              onChange={(val) => val && setSortBy(val)}
              options={[
                { value: 'frequency', label: 'Frequency' },
                { value: 'alphabetical', label: 'Alphabetical' }
              ]}
              placeholder="Sort By"
              theme={theme}
              style={{ minWidth: '100px' }}
              fontSize="12px"
              padding="6px 12px"
            />
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
            <LucideIcon name="search" size={18} />
          </div>
          <input
            type="text"
            placeholder="Search words..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '12px 16px 12px 44px',
              borderRadius: '12px',
              border: `1px solid ${theme.cardBorder}`,
              background: 'rgba(255, 255, 255, 0.7)',
              fontSize: '14px',
              fontWeight: '400',
              color: theme.textPrimary,
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme.primary;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${theme.primary}15`;
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.cardBorder;
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
            }}
          />
        </div>

        {/* Words Hidden Indicator */}
        {wordsHiddenCount > 0 && (
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: `1px solid ${theme.primary}30`,
            borderRadius: '8px',
            fontSize: '12px',
            color: theme.primary,
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <LucideIcon name="book" size={14} color={theme.primary} />
            <span style={{ opacity: 0.8 }}>{wordsHiddenCount} word{wordsHiddenCount !== 1 ? 's' : ''} hidden (already have cards)</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        padding: '0 24px 24px 24px',
        display: 'flex',
        gap: '24px',
        overflow: 'hidden',
        minHeight: 0,
        maxHeight: '100%'
      }}>
        {/* Loading State */}
        {loading && (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.textSecondary,
            fontSize: '16px'
          }}>
            Loading {selectedLanguage} vocabulary...
          </div>
        )}

        {/* Error State */}
        {loadError && (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#DC2626'
            }}>
              Failed to load vocabulary
            </div>
            <div style={{
              fontSize: '14px',
              color: theme.textSecondary
            }}>
              {loadError}
            </div>
          </div>
        )}

        {/* Word List and Detail */}
        {!loading && !loadError && (
          <>
            {/* Word List (Left Panel) */}
            <div style={{
              width: '40%',
              minWidth: '350px',
              background: 'rgba(255, 255, 255, 0.5)',
              backdropFilter: 'blur(20px)',
              borderRadius: '16px',
              border: `1px solid ${theme.cardBorder}`,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              height: '100%',
              maxHeight: '100%'
            }}>
              <WordList
                words={paginatedData.items}
                selectedWords={selectedWords}
                onSelectWord={handleSelectWord}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onBatchCreate={handleBatchCreate}
                currentPage={paginatedData.currentPage}
                totalPages={paginatedData.totalPages}
                onPageChange={handlePageChange}
                startIndex={paginatedData.startIndex}
                endIndex={paginatedData.endIndex}
                totalItems={paginatedData.totalItems}
                theme={theme}
              />
            </div>

            {/* Word Detail (Right Panel) */}
            <div style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.5)',
              backdropFilter: 'blur(20px)',
              borderRadius: '16px',
              border: `1px solid ${theme.cardBorder}`,
              padding: '20px',
              overflow: 'auto',
              height: '100%',
              maxHeight: '100%'
            }}>
              <WordDetail
                word={selectedWord}
                theme={theme}
                onCreateCard={handleCreateCard}
              />
            </div>
          </>
        )}
      </div>

      {/* Create Card Modal */}
      {showCreateModal && (
        <CreateCardModal
          words={wordsToCreate}
          decks={decks}
          theme={theme}
          onClose={() => setShowCreateModal(false)}
          onCreateCards={handleCreateCards}
          cardMutations={cardMutations}
          language={selectedLanguage}
        />
      )}
    </div>
  );
}

export default WordLibrary;

