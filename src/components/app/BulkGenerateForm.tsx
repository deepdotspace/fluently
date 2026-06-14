import React from 'react';
import DeckSelector from './DeckSelector';
import BulkTypeSelector from './BulkTypeSelector';
import MediaOptions from './MediaOptions';
import GeneratedCardsPanel from './GeneratedCardsPanel';
import type { GeneratedCard, MediaNotification } from './GeneratedCardsPanel';
import LucideIcon from './LucideIcon';
import type { DeckMap, SoftTheme } from '../../types';

/** Async media generators provided by the parent. */
type MediaGenerator = (prompt: string, card: GeneratedCard) => Promise<string | null>;

interface BulkGenerateFormProps {
  mode: 'auto' | 'data';
  currentTheme: SoftTheme;
  decks: DeckMap;
  selectedDeck: string | null;
  setSelectedDeck: (deckId: string) => void;
  bulkCardTypes: string[];
  setBulkCardTypes: (types: string[]) => void;
  cardCount: number;
  setCardCount: (count: number) => void;
  generateImages: boolean;
  setGenerateImages: (value: boolean) => void;
  generateAudio: boolean;
  setGenerateAudio: (value: boolean) => void;
  isGeneratingBulk: boolean;
  generatedCards: GeneratedCard[];
  setGeneratedCards: React.Dispatch<React.SetStateAction<GeneratedCard[]>>;
  onGenerate: (mode: 'auto' | 'data') => void;
  onSave: () => void;
  onStartOver: () => void;
  textValue: string;
  setTextValue: (value: string) => void;
  onFileUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  generateImageForCard: MediaGenerator;
  generateAudioForCard: MediaGenerator;
  setMediaNotification: (notification: MediaNotification | null) => void;
  isVocabJsonImport?: boolean;
  vocabCardDirection?: string;
  setVocabCardDirection?: (direction: string) => void;
}

function BulkGenerateForm({
  mode,
  currentTheme,
  decks,
  selectedDeck,
  setSelectedDeck,
  bulkCardTypes,
  setBulkCardTypes,
  cardCount,
  setCardCount,
  generateImages,
  setGenerateImages,
  generateAudio,
  setGenerateAudio,
  isGeneratingBulk,
  generatedCards,
  setGeneratedCards,
  onGenerate,
  onSave,
  onStartOver,
  textValue,
  setTextValue,
  onFileUpload,
  generateImageForCard,
  generateAudioForCard,
  setMediaNotification,
  isVocabJsonImport = false,
  vocabCardDirection = 'target-to-native',
  setVocabCardDirection = () => { }
}: BulkGenerateFormProps) {
  const showFileUpload = mode === 'data';
  const generateButtonLabel = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
      <LucideIcon name="Sparkles" size={18} />
      <span>{mode === 'auto' ? 'Generate Cards' : 'Generate Cards from Data'}</span>
    </div>
  );
  const placeholder = mode === 'auto'
    ? 'e.g., Create flashcards about photosynthesis, Create cards for Spanish vocabulary lesson 1...'
    : 'Or paste your text here... (e.g., chapter content, article, notes)';
  const disabledGenerate = isGeneratingBulk || !selectedDeck || !textValue.trim() || bulkCardTypes.length === 0;

  return (
    <div>
      {generatedCards.length === 0 ? (
        <>
          <DeckSelector
            decks={decks}
            selectedDeck={selectedDeck}
            setSelectedDeck={setSelectedDeck}
            currentTheme={currentTheme}
          />

          {isVocabJsonImport && (
            <>
              <div style={{
                padding: '12px 16px',
                background: 'rgba(59, 130, 246, 0.1)',
                border: `1px solid ${currentTheme.primary}40`,
                borderRadius: '12px',
                marginBottom: '16px',
                fontSize: '14px',
                color: currentTheme.textPrimary,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <LucideIcon name="Book" size={18} color={currentTheme.primary} />
                <span>Vocabulary JSON detected - Choose card direction</span>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: currentTheme.textPrimary,
                  marginBottom: '10px',
                  letterSpacing: '0.3px'
                }}>
                  Card Direction
                </label>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: vocabCardDirection === 'target-to-native' ? `${currentTheme.primary}20` : 'rgba(255, 255, 255, 0.5)',
                    border: `1px solid ${vocabCardDirection === 'target-to-native' ? currentTheme.primary : currentTheme.cardBorder}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                  }}>
                    <input
                      type="radio"
                      name="vocabDirection"
                      value="target-to-native"
                      checked={vocabCardDirection === 'target-to-native'}
                      onChange={(e) => setVocabCardDirection(e.target.value)}
                      style={{ marginRight: '10px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px', color: currentTheme.textPrimary }}>
                      Target Language → Native Language (e.g., Spanish → English)
                    </span>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: vocabCardDirection === 'native-to-target' ? `${currentTheme.primary}20` : 'rgba(255, 255, 255, 0.5)',
                    border: `1px solid ${vocabCardDirection === 'native-to-target' ? currentTheme.primary : currentTheme.cardBorder}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                  }}>
                    <input
                      type="radio"
                      name="vocabDirection"
                      value="native-to-target"
                      checked={vocabCardDirection === 'native-to-target'}
                      onChange={(e) => setVocabCardDirection(e.target.value)}
                      style={{ marginRight: '10px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px', color: currentTheme.textPrimary }}>
                      Native Language → Target Language (e.g., English → Spanish)
                    </span>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: vocabCardDirection === 'both' ? `${currentTheme.primary}20` : 'rgba(255, 255, 255, 0.5)',
                    border: `1px solid ${vocabCardDirection === 'both' ? currentTheme.primary : currentTheme.cardBorder}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                  }}>
                    <input
                      type="radio"
                      name="vocabDirection"
                      value="both"
                      checked={vocabCardDirection === 'both'}
                      onChange={(e) => setVocabCardDirection(e.target.value)}
                      style={{ marginRight: '10px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px', color: currentTheme.textPrimary }}>
                      Basic + Reversed (Both directions - creates 2 cards per word)
                    </span>
                  </label>
                </div>
              </div>
            </>
          )}

          {!isVocabJsonImport && (
            <BulkTypeSelector
              bulkCardTypes={bulkCardTypes}
              setBulkCardTypes={setBulkCardTypes}
              currentTheme={currentTheme}
              disabled={false}
            />
          )}

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: currentTheme.textPrimary,
              marginBottom: '10px',
              letterSpacing: '0.3px'
            }}>
              {mode === 'auto' ? 'Enter Prompt' : 'Upload File or Paste Text'}
            </label>

            {showFileUpload && (
              <div style={{ marginBottom: '12px' }}>
                <input
                  type="file"
                  accept=".txt,.md,.csv,.json"
                  onChange={onFileUpload}
                  style={{ display: 'none' }}
                  id={`file-upload-${mode}`}
                />
                <label
                  htmlFor={`file-upload-${mode}`}
                  style={{
                    padding: '12px 24px',
                    background: 'rgba(255, 255, 255, 0.7)',
                    color: currentTheme.textPrimary,
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <LucideIcon name="file" size={18} color={currentTheme.textPrimary} />
                  Upload File (.txt, .md, .csv, .json)
                </label>
              </div>
            )}

            <textarea
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder={placeholder}
              style={{
                width: '100%',
                minHeight: showFileUpload ? '200px' : '150px',
                padding: '18px',
                fontSize: '15px',
                border: `1px solid ${currentTheme.cardBorder}`,
                borderRadius: '12px',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                background: 'rgba(255, 255, 255, 0.5)',
                color: currentTheme.textPrimary
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: currentTheme.textPrimary,
              marginBottom: '10px',
              letterSpacing: '0.3px'
            }}>
              Number of Cards (1-20)
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={cardCount}
              onChange={(e) => setCardCount(Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              style={{
                width: '100%',
                padding: '14px 18px',
                fontSize: '15px',
                border: `1px solid ${currentTheme.cardBorder}`,
                borderRadius: '12px',
                outline: 'none',
                background: 'rgba(255, 255, 255, 0.5)',
                boxSizing: 'border-box',
                color: currentTheme.textPrimary
              }}
            />
          </div>

          <MediaOptions
            generateImages={generateImages}
            setGenerateImages={setGenerateImages}
            generateAudio={generateAudio}
            setGenerateAudio={setGenerateAudio}
            currentTheme={currentTheme}
          />

          <button
            onClick={() => onGenerate(mode)}
            disabled={disabledGenerate}
            style={{
              padding: '16px 32px',
              background: isGeneratingBulk ? 'rgba(156, 163, 175, 0.5)' : `linear-gradient(135deg, ${currentTheme.primary} 0%, ${currentTheme.textSecondary} 100%)`,
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: disabledGenerate ? 'not-allowed' : 'pointer',
              opacity: disabledGenerate ? 0.5 : 1,
              boxShadow: `0 4px 20px ${currentTheme.primary}40`,
              transition: 'all 0.3s'
            }}
          >
            {isGeneratingBulk ? 'Generating Cards...' : generateButtonLabel}
          </button>
        </>
      ) : (
        <GeneratedCardsPanel
          generatedCards={generatedCards}
          setGeneratedCards={setGeneratedCards}
          currentTheme={currentTheme}
          onSave={onSave}
          onStartOver={onStartOver}
          generateImageForCard={generateImageForCard}
          generateAudioForCard={generateAudioForCard}
          setMediaNotification={setMediaNotification}
        />
      )}
    </div>
  );
}

export default BulkGenerateForm;
