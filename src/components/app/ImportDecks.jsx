import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import GlassCard from './GlassCard';
import DeckPreviewModal from './DeckPreviewModal';
import CustomDropdown from './CustomDropdown';
import CustomDeckBuilder from './CustomDeckBuilder';
import WordLibrary from './WordLibrary';
import AnkiImportModal from './AnkiImportModal';
import LucideIcon from './LucideIcon';
import { useTheme } from '../../utils/ThemeContext';
import useIsMobile from '../../hooks/useIsMobile';
import {
  generateVirtualDeckIndex,
  generateDeckFromVocab,
  generateDeckMetadata,
  getAvailableLanguages,
  filterDecksByLanguage,
  searchDecks
} from '../../utils/vocabDeckGenerator';
import { generateId } from '../../utils/storage';
import { saveCards, getAllCards } from '../../utils/cardStorage';
import { loadVocabFile, getVocabFileName } from '../../utils/vocabLoader';

function ImportDecks({ decks, deckMutations, cardMutations, cards: allCards, onDeckSelect, cardTypes, updateCardTypes, settings, mediaRecords, mediaMutations }) {
  const theme = useTheme();
  const isMobile = useIsMobile();
  const [index, setIndex] = useState(null);
  const [deckMetadata, setDeckMetadata] = useState({});
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewDeck, setPreviewDeck] = useState(null);
  const [previewCards, setPreviewCards] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(null);
  const [vocabDataCache, setVocabDataCache] = useState({});
  const [vocabDataLoading, setVocabDataLoading] = useState(true);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewTargetDeckId, setPreviewTargetDeckId] = useState(null);
  const [showAnkiImport, setShowAnkiImport] = useState(false);

  // Load vocab data on mount - but don't block UI, load on-demand instead
  useEffect(() => {
    // Don't pre-load all vocab data - it's too large
    // Instead, we'll load on-demand when user clicks preview
    setVocabDataLoading(false);
  }, []);

  // Add CSS animation for loading pulse
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Generate virtual index on mount (no file dependency needed)
  useEffect(() => {
    const virtualIndex = generateVirtualDeckIndex();
    setIndex(virtualIndex);

    // Pre-generate metadata for all decks (for display purposes)
    if (virtualIndex && virtualIndex.decks) {
      const metadata = {};
      virtualIndex.decks.forEach(deckEntry => {
        // Create metadata from deck entry (without cards, just for display)
        const { _generateParams, _langInfo } = deckEntry;
        if (_generateParams && _langInfo) {
          const difficultyTag = _generateParams.difficulty.includes('A') ? 'beginner' :
            _generateParams.difficulty.includes('B') ? 'intermediate' : 'advanced';
          const description = _generateParams.difficulty === 'A1-A2'
            ? `The ${_generateParams.count} most frequently used ${_langInfo.displayName} ${_generateParams.pos}s, perfect for building your vocabulary foundation.`
            : `A curated collection of ${_generateParams.count} ${_langInfo.displayName} ${_generateParams.pos}s at the ${_generateParams.difficulty} level.`;

          metadata[deckEntry.id] = {
            id: deckEntry.id,
            name: _generateParams.name,
            description: description,
            language: _generateParams.language,
            targetLang: _langInfo.code,
            nativeLang: 'en',
            category: 'frequency',
            subcategory: _generateParams.subcategory,
            tags: [_generateParams.pos, 'frequency', difficultyTag, _generateParams.language],
            cardCount: _generateParams.count,
            difficulty: _generateParams.difficulty,
            estimatedStudyTime: _generateParams.difficulty === 'A1-A2' ? '3-4 weeks' :
              _generateParams.difficulty === 'B1-B2' ? '4-6 weeks' : '6-8 weeks'
          };
        }
      });
      setDeckMetadata(metadata);
    }
  }, []);

  // Filter and search decks
  const filteredDecks = useMemo(() => {
    if (!index || !index.decks) return [];

    let result = index.decks;

    // Filter by language
    if (selectedLanguage) {
      result = filterDecksByLanguage(result, selectedLanguage);
    }

    // Search
    if (searchQuery) {
      result = searchDecks(result, searchQuery, deckMetadata);
    }

    return result;
  }, [index, selectedLanguage, searchQuery, deckMetadata]);

  // Get available languages
  const availableLanguages = useMemo(() => {
    if (!index) return [];
    return getAvailableLanguages(index);
  }, [index]);

  // Format languages for dropdown
  const languageOptions = useMemo(() => {
    return availableLanguages.map(lang => ({
      value: lang,
      label: lang.charAt(0).toUpperCase() + lang.slice(1)
    }));
  }, [availableLanguages]);

  // Handle preview - generate deck on-the-fly
  const handlePreview = useCallback(async (deckEntry) => {
    if (!deckEntry._generateParams) {
      setGenerationError('Invalid deck configuration.');
      return;
    }

    setGenerating(true);
    setGenerationError(null);

    try {
      // Load vocab data on-demand for the specific language
      const { language } = deckEntry._generateParams;
      const fileName = getVocabFileName(language);

      if (!fileName) {
        setGenerationError(`No vocab file available for language: ${language}`);
        setGenerating(false);
        return;
      }

      // Check cache first, otherwise load from GitHub
      let vocabData = vocabDataCache[fileName];
      if (!vocabData) {
        console.log(`[ImportDecks] Loading vocab data for ${language} on-demand...`);
        vocabData = await loadVocabFile(fileName);
        if (vocabData) {
          // Cache it for future use
          setVocabDataCache(prev => ({ ...prev, [fileName]: vocabData }));
        }
      }

      if (!vocabData) {
        setGenerationError(`Failed to load vocabulary data for ${language}. Please try again.`);
        setGenerating(false);
        return;
      }

      // Create a cache object with just this file for the generator
      const singleFileCache = { [fileName]: vocabData };

      // For quick picks, no existing cards (they create new decks)
      // Generate cards on-the-fly from vocab_data
      const cards = generateDeckFromVocab(singleFileCache, deckEntry._generateParams, null);

      if (cards.length === 0) {
        setGenerationError(`No cards found matching criteria. Try a different deck.`);
        setGenerating(false);
        return;
      }

      // Generate metadata
      const metadata = generateDeckMetadata(deckEntry, cards);

      if (metadata) {
        setPreviewDeck(metadata);
        setPreviewCards(cards);
      } else {
        setGenerationError('Failed to generate deck metadata.');
      }
    } catch (error) {
      console.error('[ImportDecks] Error generating deck:', error);
      setGenerationError(`Failed to generate deck: ${error.message || 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  }, [vocabDataCache]);

  // Handle custom deck generation
  const handleCustomGenerate = useCallback(async (params) => {
    setShowCustomBuilder(false);
    setGenerating(true);
    setGenerationError(null);

    // Store targetDeckId if provided (for adding to existing deck)
    if (params.targetDeckId) {
      setPreviewTargetDeckId(params.targetDeckId);
    } else {
      setPreviewTargetDeckId(null);
    }

    try {
      const { language, pos, difficulty, count, name } = params;
      const fileName = getVocabFileName(language);

      if (!fileName) {
        setGenerationError(`No vocab file available for language: ${language}`);
        setGenerating(false);
        return;
      }

      // Check cache first, otherwise load from GitHub
      let vocabData = vocabDataCache[fileName];
      if (!vocabData) {
        console.log(`[ImportDecks] Loading vocab data for ${language} on-demand...`);
        vocabData = await loadVocabFile(fileName);
        if (vocabData) {
          // Cache it for future use
          setVocabDataCache(prev => ({ ...prev, [fileName]: vocabData }));
        }
      }

      if (!vocabData) {
        setGenerationError(`Failed to load vocabulary data for ${language}. Please try again.`);
        setGenerating(false);
        return;
      }

      // Create a cache object with just this file for the generator
      const singleFileCache = { [fileName]: vocabData };

      // Load existing cards if adding to existing deck
      let existingCards = null;
      if (params.targetDeckId && allCards) {
        existingCards = getAllCards(allCards, params.targetDeckId);
        if (Object.keys(existingCards).length > 0) {
          console.log(`[ImportDecks] Loaded ${Object.keys(existingCards).length} existing cards for duplicate checking`);
        }
      }

      // Get language info from vocabDeckGenerator's internal function
      // We'll create a simple langInfo object based on the language name
      const langCodeMap = {
        'spanish': 'es', 'french': 'fr', 'german': 'de', 'italian': 'it',
        'portuguese': 'pt', 'russian': 'ru', 'korean': 'ko', 'chinese': 'zh',
        'arabic': 'ar', 'hindi': 'hi'
      };

      const langInfo = {
        code: langCodeMap[language] || language.substring(0, 2),
        displayName: language.charAt(0).toUpperCase() + language.slice(1)
      };

      const virtualDeckEntry = {
        id: `custom-${language}-${difficulty}-${pos}`,
        _generateParams: params,
        _langInfo: langInfo
      };

      // Generate cards on-the-fly from vocab_data, passing existing cards for duplicate checking
      const cards = generateDeckFromVocab(singleFileCache, params, existingCards);

      if (cards.length === 0) {
        setGenerationError(`No cards found matching criteria. Try different filters.`);
        setGenerating(false);
        return;
      }

      // Generate metadata
      const metadata = generateDeckMetadata(virtualDeckEntry, cards);

      if (metadata) {
        setPreviewDeck(metadata);
        setPreviewCards(cards);
      } else {
        setGenerationError('Failed to generate deck metadata.');
      }
    } catch (error) {
      console.error('[ImportDecks] Error generating custom deck:', error);
      setGenerationError(`Failed to generate deck: ${error.message || 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  }, [vocabDataCache, index, allCards]);

  // Handle import
  const handleImport = useCallback(async (targetDeckId = null) => {
    if (!previewDeck || !previewCards || previewCards.length === 0) return;

    setImporting(true);
    setImportProgress({ current: 0, total: previewCards.length });

    try {
      let deckId;
      let deckName;

      if (targetDeckId && decks[targetDeckId]) {
        deckId = targetDeckId;
        deckName = decks[targetDeckId].name;
      } else {
        deckId = 'deck-' + generateId();
        deckName = previewDeck.name;

        deckMutations.create({
          id: deckId,
          name: previewDeck.name,
          targetLang: previewDeck.targetLang || 'es',
          nativeLang: previewDeck.nativeLang || 'en',
          settingsOverride: null,
          cardCounts: { new: previewCards.length, learning: 0, review: 0 },
          lastStudiedAt: null,
          createdAt: new Date().toISOString()
        });
      }

      // Transform and save cards
      const now = new Date().toISOString();
      previewCards.forEach((card, index) => {
        const newCardId = 'card-' + generateId();
        cardMutations.create({
          id: newCardId,
          deckId: deckId,
          cardTypeId: card.cardTypeId || 'vocabulary',
          content: card.content,
          tags: card.tags || [],
          metadata: card.metadata || {},
          revLog: [],
          version: '1.0',
          createdAt: now,
          updatedAt: now,
          scheduling: {
            state: 'new',
            interval: 0,
            ease: 2.5,
            dueDate: now,
            lapses: 0,
            stepsIndex: 0
          }
        });
        setImportProgress({ current: index + 1, total: previewCards.length });
      });

      // Update existing deck's cardCounts
      if (targetDeckId && decks[targetDeckId]) {
        const existingDeck = decks[targetDeckId];
        const { recordId: deckRid, ...deckData } = existingDeck;
        if (deckRid) {
          deckMutations.put(deckRid, {
            ...deckData,
            cardCounts: {
              new: (deckData.cardCounts?.new || 0) + previewCards.length,
              learning: deckData.cardCounts?.learning || 0,
              review: deckData.cardCounts?.review || 0
            }
          });
        }
      }

      setPreviewDeck(null);
      setPreviewCards([]);
      setImporting(false);

      const successMessage = targetDeckId
        ? `Successfully added ${previewCards.length} cards to "${deckName}"!`
        : `Successfully imported "${deckName}" with ${previewCards.length} cards!`;
      setImportSuccess(successMessage);
      setTimeout(() => setImportSuccess(null), 5000);
    } catch (error) {
      console.error('Failed to import deck:', error);
      setImporting(false);
      alert('Failed to import deck. Please try again.');
    }
  }, [previewDeck, previewCards, deckMutations, cardMutations, decks]);

  if (!index) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: theme.textSecondary }}>
        Loading deck library...
      </div>
    );
  }


  return (
    <div>
      {/* Header */}
      <div style={{
        marginBottom: isMobile ? '20px' : '32px',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'flex-start',
        justifyContent: 'space-between',
        gap: isMobile ? '12px' : '16px'
      }}>
        <div>
          <h1 style={{
            fontSize: isMobile ? '24px' : '32px',
            fontWeight: '700',
            color: theme.textPrimary,
            margin: '0 0 8px 0',
            letterSpacing: '-0.5px'
          }}>
            Import Decks
          </h1>
          <p style={{
            fontSize: isMobile ? '14px' : '16px',
            color: theme.textSecondary,
            margin: 0,
            lineHeight: '1.6'
          }}>
            Get started quickly with pre-built vocabulary decks. Choose a deck to preview and import.
          </p>
        </div>
        <button
          onClick={() => setShowAnkiImport(true)}
          style={{
            padding: '10px 14px',
            borderRadius: '12px',
            border: `1px solid ${theme.cardBorder}`,
            background: theme.primary,
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
            minWidth: isMobile ? undefined : '160px',
            boxShadow: `0 10px 30px ${theme.primary}30`,
            textAlign: 'center'
          }}
        >
          Import Anki (.apkg)
        </button>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '10px' : '16px',
        marginBottom: isMobile ? '20px' : '32px',
        flexWrap: 'wrap',
        alignItems: isMobile ? 'stretch' : 'center',
        width: '100%'
      }}>
        {/* Language Filter */}
        <div style={{
          flex: isMobile ? '1 1 auto' : '0 0 30%',
          minWidth: isMobile ? undefined : '140px',
          maxWidth: '100%'
        }}>
          <CustomDropdown
            value={selectedLanguage}
            options={languageOptions}
            onChange={setSelectedLanguage}
            placeholder="All Languages"
            theme={theme}
            style={{ width: '100%' }}
            fontSize="13px"
            padding="10px 14px"
          />
        </div>

        {/* Search */}
        <div style={{
          flex: '1 1 0%',
          minWidth: isMobile ? undefined : '200px',
          maxWidth: '100%'
        }}>
          <input
            type="text"
            placeholder="Search decks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: theme.cardBg,
              border: `1px solid ${theme.cardBorder}`,
              borderRadius: '12px',
              color: theme.textPrimary,
              fontSize: '13px',
              outline: 'none',
              transition: 'all 0.2s'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme.primary;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${theme.primary}20`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.cardBorder;
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Advanced Button */}
        <div style={{
          flex: isMobile ? '1 1 auto' : '0 0 20%',
          minWidth: isMobile ? undefined : '100px',
          maxWidth: '100%'
        }}>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: showAdvanced ? theme.primary : theme.cardBg,
              border: `1px solid ${showAdvanced ? theme.primary : theme.cardBorder}`,
              borderRadius: '12px',
              color: showAdvanced ? '#ffffff' : theme.textPrimary,
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              textAlign: 'center',
              boxShadow: showAdvanced ? `0 0 0 3px ${theme.primary}20` : 'none'
            }}
            onMouseEnter={(e) => {
              if (!showAdvanced) {
                e.currentTarget.style.borderColor = theme.primary;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${theme.primary}20`;
              }
            }}
            onMouseLeave={(e) => {
              if (!showAdvanced) {
                e.currentTarget.style.borderColor = theme.cardBorder;
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {showAdvanced ? 'Simple View' : 'Advanced'}
          </button>
        </div>
      </div>

      {/* Conditional Render: Advanced (Vault) or Simple (Decks) */}
      {showAdvanced ? (
        <WordLibrary
          decks={decks}
          cards={allCards}
          cardMutations={cardMutations}
          theme={theme}
        />
      ) : (
        <>
          {/* Decks Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: isMobile ? '14px' : '24px'
            }}
          >
            {/* Custom Deck Builder Card */}
            <div
              style={{ borderRadius: '24px', cursor: 'pointer', transition: 'all 0.2s ease-out' }}
            >
              <GlassCard theme={theme} style={{ cursor: 'pointer', border: `2px dashed ${theme.primary}40`, height: '100%' }}>
                <div
                  onClick={() => setShowCustomBuilder(true)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '20px'
                  }}
                >
                  <div style={{
                    fontSize: '48px',
                    marginBottom: '16px',
                    opacity: 0.7
                  }}>
                    <LucideIcon name="Sparkles" size={48} />
                  </div>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: theme.textPrimary,
                    margin: '0 0 12px 0',
                    lineHeight: '1.4'
                  }}>
                    Create Custom Deck
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: theme.textSecondary,
                    margin: '0 0 20px 0',
                    lineHeight: '1.5'
                  }}>
                    Choose your language, part of speech, level, and card count
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCustomBuilder(true);
                    }}
                    style={{
                      padding: '10px 16px',
                      background: theme.primary,
                      border: 'none',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: `0 2px 8px ${theme.primary}30`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = `0 4px 12px ${theme.primary}40`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = `0 2px 8px ${theme.primary}30`;
                    }}
                  >
                    Customize
                  </button>
                </div>
              </GlassCard>
            </div>

            {/* Pre-built Decks */}
            {filteredDecks.length === 0 ? (
              <GlassCard theme={theme}>
                <div style={{ textAlign: 'center', padding: '40px', color: theme.textSecondary }}>
                  {searchQuery || selectedLanguage
                    ? 'No decks found matching your filters.'
                    : 'No decks available.'}
                </div>
              </GlassCard>
            ) : (
              filteredDecks.map((deckEntry) => (
                <div
                  key={deckEntry.id}
                  style={{ borderRadius: '24px', cursor: 'pointer', transition: 'all 0.2s ease-out' }}
                >
                  <GlassCard theme={theme} style={{ cursor: 'pointer', height: '100%' }}>
                    <div
                      onClick={() => handlePreview(deckEntry)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%'
                      }}
                    >
                      {/* Language Badge */}
                      <div style={{
                        display: 'inline-block',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: theme.primary,
                        background: theme.primary + '15',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        width: 'fit-content',
                        textTransform: 'capitalize'
                      }}>
                        {deckEntry.language}
                      </div>

                      {/* Deck Name */}
                      <h3 style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        color: theme.textPrimary,
                        margin: '0 0 12px 0',
                        lineHeight: '1.4'
                      }}>
                        {deckMetadata[deckEntry.id]?.name || 'Top 200 Nouns by Frequency'}
                      </h3>

                      {/* Stats */}
                      <div style={{
                        display: 'flex',
                        gap: '12px',
                        marginBottom: '20px',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{
                          fontSize: '13px',
                          color: theme.textSecondary
                        }}>
                          {deckEntry.cardCount} cards
                        </div>
                        {deckEntry.difficulty && (
                          <div style={{
                            fontSize: '13px',
                            color: theme.textSecondary
                          }}>
                            {deckEntry.difficulty}
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      {deckEntry.tags && deckEntry.tags.length > 0 && (
                        <div style={{
                          display: 'flex',
                          gap: '6px',
                          flexWrap: 'wrap',
                          marginBottom: '20px'
                        }}>
                          {deckEntry.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '11px',
                                color: theme.textSecondary,
                                background: theme.cardBorder + '20',
                                padding: '4px 8px',
                                borderRadius: '6px'
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </GlassCard>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Generation Loading Overlay */}
      {generating && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <GlassCard theme={theme} opaque={true} style={{ minWidth: '300px', textAlign: 'center' }}>
            <div style={{
              fontSize: '18px',
              fontWeight: '600',
              color: theme.textPrimary,
              marginBottom: '20px'
            }}>
              Generating Deck...
            </div>
            <div style={{
              fontSize: '14px',
              color: theme.textSecondary,
              marginBottom: '20px'
            }}>
              Creating cards from vocabulary data
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              background: '#f1f5f9',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                background: theme.primary,
                animation: 'pulse 1.5s ease-in-out infinite'
              }} />
            </div>
          </GlassCard>
        </div>
      )}

      {/* Generation Error Message */}
      {/* Generation Error Message */}
      <>
        {generationError && !generating && (
          <div
            className="anim-notification"
            style={{
              position: 'fixed',
              top: '20px',
              left: '50%',
              background: '#ef4444',
              color: '#ffffff',
              padding: '16px 24px',
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
              zIndex: 10002,
              maxWidth: '500px',
              textAlign: 'center'
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>Error</div>
            <div style={{ fontSize: '14px' }}>{generationError}</div>
            <button
              onClick={() => setGenerationError(null)}
              style={{
                marginTop: '12px',
                padding: '6px 16px',
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Dismiss
            </button>
          </div>
        )}
      </>

      {/* Import Success Message */}
      {/* Import Success Message */}
      <>
        {importSuccess && (
          <div
            className="anim-notification"
            style={{
              position: 'fixed',
              top: '20px',
              left: '50%',
              background: '#10b981',
              color: '#ffffff',
              padding: '16px 24px',
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
              zIndex: 10002,
              maxWidth: '500px',
              textAlign: 'center'
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>Success</div>
            <div style={{ fontSize: '14px' }}>{importSuccess}</div>
            <button
              onClick={() => setImportSuccess(null)}
              style={{
                marginTop: '12px',
                padding: '6px 16px',
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Dismiss
            </button>
          </div>
        )}
      </>

      {/* Preview Modal */}
      <>
        {previewDeck && !generating && (
          <DeckPreviewModal
            key="preview-modal"
            deck={previewDeck}
            cards={previewCards}
            decks={decks}
            onClose={() => {
              if (!importing) {
                setPreviewDeck(null);
                setPreviewCards([]);
                setGenerationError(null);
                setPreviewTargetDeckId(null);
              }
            }}
            onImport={handleImport}
            theme={theme}
            initialImportMode={previewTargetDeckId ? 'existing' : 'new'}
            initialSelectedDeck={previewTargetDeckId}
          />
        )}
      </>

      {/* Import Progress Overlay */}
      {/* Import Progress Overlay */}
      <>
        {importing && (
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
              zIndex: 10001
            }}
          >
            <GlassCard theme={theme} opaque={true} style={{ minWidth: '300px', textAlign: 'center' }}>
              <div style={{
                fontSize: '18px',
                fontWeight: '600',
                color: theme.textPrimary,
                marginBottom: '20px'
              }}>
                Importing Deck...
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                background: '#f1f5f9',
                borderRadius: '4px',
                overflow: 'hidden',
                marginBottom: '12px'
              }}>
                <div style={{
                  width: `${(importProgress.current / importProgress.total) * 100}%`,
                  height: '100%',
                  background: theme.primary,
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div style={{
                fontSize: '14px',
                color: theme.textSecondary
              }}>
                {importProgress.current} / {importProgress.total} cards
              </div>
            </GlassCard>
          </div>
        )}
      </>

      <>
        {showAnkiImport && (
          <AnkiImportModal
            key="anki-modal"
            open={true}
            onClose={() => setShowAnkiImport(false)}
            theme={theme}
            cardMutations={cardMutations}
            decks={decks}
            deckMutations={deckMutations}
            cardTypes={cardTypes}
            updateCardTypes={updateCardTypes}
            mediaRecords={mediaRecords}
            mediaMutations={mediaMutations}
            settings={settings}
          />
        )}
      </>

      {/* Custom Deck Builder Modal */}
      <>
        {showCustomBuilder && (
          <CustomDeckBuilder
            key="custom-builder"
            theme={theme}
            onGenerate={handleCustomGenerate}
            onClose={() => setShowCustomBuilder(false)}
            availableLanguages={availableLanguages}
            decks={decks}
          />
        )}
      </>
    </div>
  );
}

export default ImportDecks;

