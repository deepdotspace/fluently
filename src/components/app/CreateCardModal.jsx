import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getWiktionaryAudio } from '../../utils/wiktionary-audio';
import { miyagiAPI } from '../../utils/miyagiCompat';
import CustomDropdown from './CustomDropdown';
import LucideIcon from './LucideIcon';

/**
 * ToggleOption Component
 * Reusable toggle option for card settings
 */
function ToggleOption({
  icon,
  title,
  description,
  checked,
  onChange,
  disabled,
  theme
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderRadius: '10px',
        background: checked ? theme.primary + '15' : 'rgba(255, 255, 255, 0.6)',
        border: `1px solid ${checked ? theme.primary + '40' : theme.cardBorder}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        opacity: disabled ? 0.6 : 1
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = checked
            ? theme.primary + '20'
            : 'rgba(255, 255, 255, 0.8)';
          e.currentTarget.style.borderColor = checked
            ? theme.primary + '60'
            : theme.primary + '40';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = checked
            ? theme.primary + '15'
            : 'rgba(255, 255, 255, 0.6)';
          e.currentTarget.style.borderColor = checked
            ? theme.primary + '40'
            : theme.cardBorder;
        }
      }}
      onClick={() => !disabled && onChange(!checked)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '10px',
          background: checked
            ? `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primary}dd 100%)`
            : 'rgba(255, 255, 255, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          transition: 'all 0.2s ease',
          boxShadow: checked ? `0 2px 8px ${theme.primary}30` : 'none'
        }}>
          {icon}
        </div>
        <div>
          <div style={{
            fontSize: '15px',
            fontWeight: '600',
            color: theme.textPrimary,
            marginBottom: '2px'
          }}>
            {title}
          </div>
          <div style={{
            fontSize: '12px',
            color: theme.textSecondary
          }}>
            {description}
          </div>
        </div>
      </div>
      <div style={{
        width: '48px',
        height: '28px',
        borderRadius: '14px',
        background: checked ? theme.primary : 'rgba(0, 0, 0, 0.1)',
        position: 'relative',
        transition: 'all 0.3s ease',
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: '#ffffff',
          position: 'absolute',
          top: '2px',
          left: checked ? '22px' : '2px',
          transition: 'all 0.3s ease',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
        }} />
      </div>
    </label>
  );
}

/**
 * CreateCardModal Component
 * Modal for creating single or batch flashcards from vocabulary words
 */
function CreateCardModal({
  words,
  decks,
  theme,
  onClose,
  onCreateCards,
  cardMutations,
  language = null
}) {
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [includeAudio, setIncludeAudio] = useState(false);
  const [includeExample, setIncludeExample] = useState(true);
  const [includeReverse, setIncludeReverse] = useState(false);
  const [cardDirection, setCardDirection] = useState('target-to-native'); // 'target-to-native' or 'native-to-target'
  const [wordsToCreate, setWordsToCreate] = useState(words);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);

  // Auto-select first deck
  useEffect(() => {
    const deckIds = Object.keys(decks);
    if (deckIds.length > 0 && !selectedDeckId) {
      setSelectedDeckId(deckIds[0]);
    }
  }, [decks, selectedDeckId]);

  const handleRemoveWord = useCallback((wordToRemove) => {
    setWordsToCreate(prev => prev.filter(w => w.word !== wordToRemove.word));
  }, []);

  const generateCardId = () => {
    return `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const fetchAudioForWord = useCallback(async (wordText) => {
    let audioData = null;
    let audioSource = null;

    // Try Wiktionary audio first
    try {
      const wiktionaryAudio = await getWiktionaryAudio(wordText.trim(), language);
      if (wiktionaryAudio?.url) {
        audioData = wiktionaryAudio.url;
        audioSource = wiktionaryAudio.source || 'wikimedia_commons';
      }
    } catch (wiktionaryError) {
      console.warn(`Failed to fetch Wiktionary audio for "${wordText}":`, wiktionaryError);
    }

    // Fallback to TTS if Wiktionary audio not available
    if (!audioData) {
      try {
        const audioResponse = await miyagiAPI.post('/text-to-speech', {
          text: wordText.trim(),
          voice: 'alloy',
          response_format: 'mp3',
          speed: 0.6
        });

        if (audioResponse.success) {
          if (audioResponse.data?.audioUrl) {
            audioData = audioResponse.data.audioUrl;
          } else if (typeof audioResponse.data === 'string') {
            audioData = audioResponse.data;
          }
          audioSource = 'tts';
        }
      } catch (audioError) {
        console.warn(`Failed to generate audio for "${wordText}":`, audioError);
      }
    }

    return { audioData, audioSource };
  }, [language]);

  const createCardData = useCallback((word, audioData, audioSource) => {
    const cardId = generateCardId();

    // Determine front and back based on direction
    const isNativeToTarget = cardDirection === 'native-to-target';
    const frontWord = isNativeToTarget ? word.english_translation : word.word;
    const backWord = isNativeToTarget ? word.word : word.english_translation;

    // Audio should be on the field that contains the target language word (word.word)
    // For target-to-native: audio goes on Word field (front)
    // For native-to-target: audio goes on Translation field (back)
    const wordField = (!isNativeToTarget && audioData) ? `${frontWord}\n[AUDIO:0]` : frontWord;
    const translationField = (isNativeToTarget && audioData) ? `${backWord}\n[AUDIO:0]` : backWord;

    return {
      id: cardId,
      deckId: selectedDeckId,
      cardTypeId: 'vocabulary',
      type: 'Vocabulary',
      content: {
        fields: {
          Word: wordField,
          Translation: translationField,
          Example: includeExample && word.example_sentence_native ? word.example_sentence_native : '',
          ExampleTranslation: includeExample && word.example_sentence_english ? word.example_sentence_english : '',
          PartOfSpeech: word.pos || '',
          Frequency: word.word_frequency != null ? String(word.word_frequency) : '',
          CEFRLevel: word.cefr_level || ''
        },
        fieldMedia: {
          Word: (!isNativeToTarget && audioData) ? { images: [], audio: [audioData] } : { images: [], audio: [] },
          Translation: (isNativeToTarget && audioData) ? { images: [], audio: [audioData] } : { images: [], audio: [] },
          Example: { images: [], audio: [] },
          ExampleTranslation: { images: [], audio: [] },
          PartOfSpeech: { images: [], audio: [] },
          Frequency: { images: [], audio: [] },
          CEFRLevel: { images: [], audio: [] }
        }
      },
      tags: word.cefr_level ? [word.cefr_level] : [],
      metadata: {
        word: word.word,
        translation: word.english_translation,
        pos: word.pos,
        cefrLevel: word.cefr_level,
        frequency: word.word_frequency,
        createdFrom: 'word-library',
        direction: cardDirection,
        createdAt: new Date().toISOString(),
        ...(audioSource && { audio: { source: audioSource, url: audioData } })
      },
      scheduling: {
        state: 'new',
        dueDate: new Date().toISOString(),
        interval: 0,
        ease: 2.5,
        lapses: 0,
        stepsIndex: 0
      },
      revLog: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }, [selectedDeckId, includeExample, cardDirection]);

  const createReverseCard = useCallback((originalCard, word, audioData) => {
    const reverseCardId = generateCardId();
    // Reverse card swaps the current direction
    const isNativeToTarget = cardDirection === 'native-to-target';
    const reverseFrontWord = isNativeToTarget ? word.word : word.english_translation;
    const reverseBackWord = isNativeToTarget ? word.english_translation : word.word;

    // Audio should be on the field that contains the target language word (word.word)
    // For reverse cards: if original was target-to-native, reverse is native-to-target, so audio goes on Translation
    // If original was native-to-target, reverse is target-to-native, so audio goes on Word
    const reverseIsNativeToTarget = !isNativeToTarget; // Reversed direction
    const reverseWordField = (!reverseIsNativeToTarget && audioData) ? `${reverseFrontWord}\n[AUDIO:0]` : reverseFrontWord;
    const reverseTranslationField = (reverseIsNativeToTarget && audioData) ? `${reverseBackWord}\n[AUDIO:0]` : reverseBackWord;

    return {
      ...originalCard,
      id: reverseCardId,
      content: {
        fields: {
          Word: reverseWordField,
          Translation: reverseTranslationField,
          Example: includeExample && word.example_sentence_english ? word.example_sentence_english : '',
          ExampleTranslation: includeExample && word.example_sentence_native ? word.example_sentence_native : '',
          PartOfSpeech: word.pos || '',
          Frequency: word.word_frequency != null ? String(word.word_frequency) : '',
          CEFRLevel: word.cefr_level || ''
        },
        fieldMedia: {
          Word: (!reverseIsNativeToTarget && audioData) ? { images: [], audio: [audioData] } : { images: [], audio: [] },
          Translation: (reverseIsNativeToTarget && audioData) ? { images: [], audio: [audioData] } : { images: [], audio: [] },
          Example: { images: [], audio: [] },
          ExampleTranslation: { images: [], audio: [] },
          PartOfSpeech: { images: [], audio: [] },
          Frequency: { images: [], audio: [] },
          CEFRLevel: { images: [], audio: [] }
        }
      },
      metadata: {
        ...originalCard.metadata,
        isReverse: true,
        originalCardId: originalCard.id
      }
    };
  }, [includeExample, cardDirection]);

  const handleCreate = useCallback(async () => {
    if (!selectedDeckId || wordsToCreate.length === 0) {
      return;
    }

    setCreating(true);
    setError(null);
    setProgress({ current: 0, total: wordsToCreate.length });

    try {
      const createdCards = [];

      for (let i = 0; i < wordsToCreate.length; i++) {
        const word = wordsToCreate[i];
        setProgress({ current: i + 1, total: wordsToCreate.length });

        // Generate audio if enabled
        // Audio should always be for the target language word (word.word) for pronunciation practice
        // This is the word they're learning, regardless of card direction
        const { audioData, audioSource } = includeAudio
          ? await fetchAudioForWord(word.word)
          : { audioData: null, audioSource: null };

        // Create main card
        const card = createCardData(word, audioData, audioSource);
        createdCards.push(card);

        // Create reverse card if enabled
        if (includeReverse) {
          const reverseCard = createReverseCard(card, word, audioData);
          createdCards.push(reverseCard);
        }
      }

      await onCreateCards(createdCards);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create cards');
      setCreating(false);
    }
  }, [selectedDeckId, wordsToCreate, includeAudio, includeReverse, cardDirection, fetchAudioForWord, createCardData, createReverseCard, onCreateCards, onClose]);

  const firstWord = useMemo(() => wordsToCreate[0], [wordsToCreate]);
  const isBatch = useMemo(() => wordsToCreate.length > 1, [wordsToCreate]);

  return (
    <div
      className="anim-fade-in"
      onClick={onClose}
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
    >
      <div
        className="anim-fade-slide-down no-scrollbar"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: `1px solid ${theme?.cardBorder || '#e2e8f0'}`,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header - Fixed */}
        <div style={{
          padding: '24px 32px',
          borderBottom: `1px solid ${theme?.cardBorder || '#e2e8f0'}`,
          background: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <div>
            <h2 style={{
              fontSize: '22px',
              fontWeight: '700',
              color: theme.textPrimary,
              margin: 0,
              letterSpacing: '-0.02em'
            }}>
              Create {isBatch ? `${wordsToCreate.length} Cards` : 'Card'}
            </h2>
            <p style={{
              fontSize: '14px',
              color: theme.textSecondary,
              margin: '4px 0 0 0'
            }}>
              {isBatch
                ? `Configure settings for all ${wordsToCreate.length} cards`
                : `From "${firstWord?.word}"`
              }
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={creating}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: `1px solid ${theme.cardBorder}`,
              background: 'rgba(255, 255, 255, 0.6)',
              color: theme.textSecondary,
              fontSize: '20px',
              cursor: creating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              opacity: creating ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!creating) {
                e.currentTarget.style.background = theme.highlight;
                e.currentTarget.style.color = theme.textPrimary;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)';
              e.currentTarget.style.color = theme.textSecondary;
            }}
          >
            <LucideIcon name="X" size={20} color="currentColor" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div
          className="no-scrollbar"
          style={{
            padding: '32px',
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            background: '#ffffff'
          }}
        >
          {/* Selected Words (batch only) - Scrollable container */}
          {isBatch && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: theme.textSecondary,
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Selected Words ({wordsToCreate.length})
              </label>
              <div
                className="no-scrollbar"
                style={{
                  background: '#f8fafc',
                  borderRadius: '10px',
                  border: `1px solid ${theme?.cardBorder || '#e2e8f0'}`,
                  padding: '8px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
              >
                {wordsToCreate.map((word, index) => (
                  <div
                    key={`${word.word}-${index}`}
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: '8px',
                      marginBottom: '4px',
                      background: '#ffffff',
                      flexShrink: 0,
                      border: `1px solid ${theme?.cardBorder || '#e2e8f0'}`
                    }}
                  >
                    <div style={{
                      fontSize: '13px',
                      color: theme.textPrimary,
                      fontWeight: '500',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      marginRight: '8px'
                    }}>
                      {word.word} → {word.english_translation}
                    </div>
                    <button
                      onClick={() => handleRemoveWord(word)}
                      disabled={creating || wordsToCreate.length === 1}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: theme.textSecondary,
                        cursor: (creating || wordsToCreate.length === 1) ? 'not-allowed' : 'pointer',
                        padding: '4px',
                        fontSize: '16px',
                        opacity: (creating || wordsToCreate.length === 1) ? 0.3 : 0.7,
                        transition: 'opacity 0.2s ease',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => {
                        if (!creating && wordsToCreate.length > 1) {
                          e.target.style.opacity = '1';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!creating && wordsToCreate.length > 1) {
                          e.target.style.opacity = '0.7';
                        }
                      }}
                    >
                      <LucideIcon name="Trash" size={14} color="currentColor" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deck Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: theme.textSecondary,
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Add to Deck
            </label>
            <CustomDropdown
              value={selectedDeckId}
              onChange={(val) => val && setSelectedDeckId(val)}
              options={Object.values(decks).map(deck => ({ value: deck.id, label: deck.name }))}
              placeholder="Select Deck"
              theme={theme}
              style={{ width: '100%' }}
            />
          </div>

          {/* Card Direction */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: theme.textSecondary,
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Card Direction
            </label>
            <div style={{
              display: 'flex',
              gap: '10px',
              background: 'rgba(255, 255, 255, 0.4)',
              borderRadius: '10px',
              padding: '8px',
              border: `1px solid ${theme.cardBorder}`
            }}>
              <label style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                background: cardDirection === 'target-to-native' ? theme.primary + '20' : 'transparent',
                border: `1px solid ${cardDirection === 'target-to-native' ? theme.primary : theme.cardBorder}`,
                cursor: creating ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: creating ? 0.6 : 1,
                textAlign: 'center'
              }}>
                <input
                  type="radio"
                  name="cardDirection"
                  value="target-to-native"
                  checked={cardDirection === 'target-to-native'}
                  onChange={(e) => !creating && setCardDirection(e.target.value)}
                  disabled={creating}
                  style={{ marginRight: '8px', cursor: creating ? 'not-allowed' : 'pointer' }}
                />
                <span style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: theme.textPrimary
                }}>
                  Target → Native
                </span>
              </label>
              <label style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                background: cardDirection === 'native-to-target' ? theme.primary + '20' : 'transparent',
                border: `1px solid ${cardDirection === 'native-to-target' ? theme.primary : theme.cardBorder}`,
                cursor: creating ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: creating ? 0.6 : 1,
                textAlign: 'center'
              }}>
                <input
                  type="radio"
                  name="cardDirection"
                  value="native-to-target"
                  checked={cardDirection === 'native-to-target'}
                  onChange={(e) => !creating && setCardDirection(e.target.value)}
                  disabled={creating}
                  style={{ marginRight: '8px', cursor: creating ? 'not-allowed' : 'pointer' }}
                />
                <span style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: theme.textPrimary
                }}>
                  Native → Target
                </span>
              </label>
            </div>
          </div>

          {/* Options */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: theme.textSecondary,
              marginBottom: '16px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Card Options
            </label>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              border: `1px solid ${theme.cardBorder}`
            }}>
              <ToggleOption
                icon={<LucideIcon name="Volume2" size={20} />}
                title="Pronunciation Audio"
                description="Include audio pronunciation for each word"
                checked={includeAudio}
                onChange={setIncludeAudio}
                disabled={creating}
                theme={theme}
              />
              <ToggleOption
                icon={<LucideIcon name="ScrollText" size={20} />}
                title="Example Sentences"
                description="Include example sentences with translations"
                checked={includeExample}
                onChange={setIncludeExample}
                disabled={creating}
                theme={theme}
              />
              <ToggleOption
                icon={<LucideIcon name="Repeat" size={20} />}
                title="Reverse Cards"
                description="Also create cards in the opposite direction"
                checked={includeReverse}
                onChange={setIncludeReverse}
                disabled={creating}
                theme={theme}
              />
            </div>
          </div>

          {/* Preview */}
          {firstWord && !creating && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: theme.textSecondary,
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Preview {isBatch ? '(First Card)' : ''}
              </label>
              <div style={{
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.4)',
                borderRadius: '10px',
                border: `1px solid ${theme.cardBorder}`
              }}>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: theme.textSecondary,
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Front
                  </div>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: theme.textPrimary,
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <strong>Word:</strong> {cardDirection === 'target-to-native' ? firstWord.word : firstWord.english_translation}
                    {includeAudio && <LucideIcon name="Volume2" size={14} />}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: theme.textSecondary,
                    lineHeight: '1.8'
                  }}>
                    {firstWord.pos && (
                      <div style={{ marginBottom: '4px' }}>
                        <strong>Type:</strong> {firstWord.pos}
                      </div>
                    )}
                    {firstWord.cefr_level && (
                      <div style={{ marginBottom: '4px' }}>
                        <strong>Level:</strong> {firstWord.cefr_level}
                      </div>
                    )}
                    {firstWord.word_frequency !== null && firstWord.word_frequency !== undefined && (
                      <div>
                        <strong>Frequency:</strong> #{firstWord.word_frequency}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: theme.textSecondary,
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Back
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: theme.textPrimary,
                    lineHeight: '1.8'
                  }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Translation:</strong> {cardDirection === 'target-to-native' ? firstWord.english_translation : firstWord.word}
                    </div>
                    {includeExample && firstWord.example_sentence_native && (
                      <>
                        <div style={{ marginTop: '12px', marginBottom: '4px' }}>
                          <strong>Example:</strong> {firstWord.example_sentence_native}
                        </div>
                        <div style={{ fontStyle: 'italic', color: theme.textSecondary, marginTop: '4px' }}>
                          <strong>Translation:</strong> {firstWord.example_sentence_english}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Progress */}
          {creating && (
            <div style={{
              padding: '16px',
              background: theme.primary + '10',
              border: `1px solid ${theme.primary}40`,
              borderRadius: '10px',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: theme.textPrimary,
                marginBottom: '8px'
              }}>
                Creating cards... ({progress.current}/{progress.total})
              </div>
              <div style={{
                width: '100%',
                height: '6px',
                background: 'rgba(255, 255, 255, 0.5)',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                  height: '100%',
                  background: theme.primary,
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px',
              background: '#FEF2F2',
              border: '1px solid #FEE2E2',
              borderRadius: '10px',
              color: '#DC2626',
              fontSize: '13px',
              fontWeight: '500',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: '12px',
          padding: '24px 32px',
          borderTop: `1px solid ${theme.cardBorder}`,
          background: 'rgba(255, 255, 255, 0.2)',
          justifyContent: 'flex-end',
          flexShrink: 0
        }}>
          <button
            onClick={onClose}
            disabled={creating}
            style={{
              padding: '14px 24px',
              background: 'rgba(255, 255, 255, 0.7)',
              border: `1px solid ${theme.cardBorder}`,
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              color: theme.textPrimary,
              cursor: creating ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: creating ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!creating) {
                e.target.style.background = 'rgba(255, 255, 255, 0.9)';
                e.target.style.borderColor = theme.textSecondary;
              }
            }}
            onMouseLeave={(e) => {
              if (!creating) {
                e.target.style.background = 'rgba(255, 255, 255, 0.7)';
                e.target.style.borderColor = theme.cardBorder;
              }
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !selectedDeckId || wordsToCreate.length === 0}
            style={{
              padding: '14px 24px',
              background: (creating || !selectedDeckId || wordsToCreate.length === 0)
                ? theme.textSecondary + '40'
                : `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primary}dd 100%)`,
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              color: '#ffffff',
              cursor: (creating || !selectedDeckId || wordsToCreate.length === 0) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: (creating || !selectedDeckId || wordsToCreate.length === 0)
                ? 'none'
                : `0 4px 16px ${theme.primary}30`
            }}
            onMouseEnter={(e) => {
              if (!creating && selectedDeckId && wordsToCreate.length > 0) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = `0 6px 20px ${theme.primary}40`;
              }
            }}
            onMouseLeave={(e) => {
              if (!creating && selectedDeckId && wordsToCreate.length > 0) {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = `0 4px 16px ${theme.primary}30`;
              }
            }}
          >
            {creating
              ? 'Creating...'
              : `Create ${wordsToCreate.length} Card${wordsToCreate.length !== 1 ? 's' : ''}`
            }
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
}

export default CreateCardModal;
