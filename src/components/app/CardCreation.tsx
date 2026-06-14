import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { generateId } from '../../utils/storage';
import { PROMPTS } from '../../utils/prompts';
import { saveCard, saveCards } from '../../utils/cardStorage';
import { saveMedia, base64ToBlob, isMediaReference } from '../../utils/mediaStorage';
import { useTheme } from '../../utils/ThemeContext';
import { miyagiAPI } from '../../utils/miyagiCompat';
import TabNav from './TabNav';
import CreateCardForm from './CreateCardForm';
import CardTypeEditor from './CardTypeEditor';
import BulkGenerateForm from './BulkGenerateForm';
import GeneratedCardsPanel from './GeneratedCardsPanel';
import type { GeneratedCard, GeneratedCardMedia, MediaNotification } from './GeneratedCardsPanel';
import Notifications from './Notifications';
import ToastContainer from './ToastContainer';
import useIsMobile from '../../hooks/useIsMobile';
import type {
  CardMap,
  CardType,
  CardTypeMap,
  DeckMap,
  MediaRecord,
  RecordEnvelope,
  StoredDeck,
  ThemeMap,
} from '../../types';

/** Minimal mutations surface from `useMutations('cards' | 'decks')`. */
interface RecordMutationsLike {
  create: (data: Record<string, unknown>) => void;
  put: (recordId: string, data: Record<string, unknown>) => void;
  remove: (recordId: string) => void;
}

/** Media records / mutations as returned by the SDK hooks. */
type MediaEnvelope = RecordEnvelope<MediaRecord>;
interface MediaMutations {
  create: (data: MediaRecord) => void;
  put: (recordId: string, data: MediaRecord) => void;
  remove: (recordId: string) => void;
}

/** Options controlling media generation for a bulk batch. */
interface MediaOptions {
  generateImages: boolean;
  generateAudio: boolean;
}

/** Input accepted by `handleCreateCard`: covers both the card-type and legacy APIs. */
interface HandleCreateCardInput {
  cardTypeId?: string;
  fields?: Record<string, string>;
  fieldMedia?: Record<string, GeneratedCardMedia>;
  tags?: string[];
  customFields?: Record<string, string>;
  customFieldMedia?: Record<string, GeneratedCardMedia>;
  customTemplate?: string | null;
}

/** A parsed vocabulary JSON entry as produced by the vocab importer. */
interface VocabEntry {
  word?: string;
  english_translation?: string;
  example_sentence_native?: string;
  example_sentence_english?: string;
  pos?: string;
  word_frequency?: string | number;
  cefr_level?: string;
}

/** Response payload shapes returned by `miyagiAPI.post` for the endpoints used here. */
interface GenerateImagePayload { imageUrls?: string[] }
interface TextToSpeechPayload { audioUrl?: string }
interface GenerateTextPayload { text?: string }

/** A single card object as returned by the bulk-generation AI prompt. */
interface RawGeneratedCard {
  front?: string;
  back?: string;
  imagePrompt?: string;
  audioPrompt?: string;
}

interface CardCreationProps {
  decks: DeckMap;
  cards: CardMap;
  cardMutations: RecordMutationsLike;
  deckMutations: RecordMutationsLike;
  selectedDeck: string | null;
  setSelectedDeck: (deckId: string) => void;
  themes: ThemeMap;
  cardTypes?: CardTypeMap;
  updateCardTypes: (cardTypes: CardTypeMap) => void;
  mediaRecords?: MediaEnvelope[] | null;
  mediaMutations?: MediaMutations | null;
}

function CardCreation({ decks, cards, cardMutations, deckMutations, selectedDeck, setSelectedDeck, themes, cardTypes = {}, updateCardTypes, mediaRecords, mediaMutations }: CardCreationProps) {
  const currentTheme = useTheme();
  const isMobile = useIsMobile();

  const [activeMode, setActiveMode] = useState('create');
  // Card type editor state (lifted here so modal renders OUTSIDE GlassCard)
  const [showCardTypeEditor, setShowCardTypeEditor] = useState(false);
  const [editingCardType, setEditingCardType] = useState<CardType | null>(null);
  const [selectedCardTypeId, setSelectedCardTypeId] = useState('basic');
  const [cardType, setCardType] = useState('Basic');
  const [frontText, setFrontText] = useState('');
  const [backText, setBackText] = useState('');
  const [tags, setTags] = useState('');
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
  const [cardCount, setCardCount] = useState(5);
  const [promptText, setPromptText] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkCardTypes, setBulkCardTypes] = useState<string[]>(['Basic']);
  const [generateImages, setGenerateImages] = useState(false);
  const [generateAudio, setGenerateAudio] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [mediaNotification, setMediaNotification] = useState<MediaNotification | null>(null);
  const [frontMedia, setFrontMedia] = useState<GeneratedCardMedia>({ images: [], audio: [] });
  const [backMedia, setBackMedia] = useState<GeneratedCardMedia>({ images: [], audio: [] });
  const [activeEditor, setActiveEditor] = useState<string | null>(null);
  const [isVocabJsonImport, setIsVocabJsonImport] = useState(false);
  const [vocabCardDirection, setVocabCardDirection] = useState('target-to-native'); // 'target-to-native', 'native-to-target', 'both'
  const [importedVocabJson, setImportedVocabJson] = useState<VocabEntry[] | null>(null); // Store imported JSON data for regeneration

  const frontEditorRef = useRef<{ insertText: (text: string) => void } | null>(null);
  const backEditorRef = useRef<{ insertText: (text: string) => void } | null>(null);
  const tagsRef = useRef<HTMLInputElement>(null);

  const currentDeck = useMemo(() => selectedDeck ? decks[selectedDeck] : null, [selectedDeck, decks]);

  // Note: removed dynamic @keyframes fadeIn that was overriding the global
  // styles.css fadeIn with translateX(-50%), which broke .anim-fade-in positioning
  // for modal overlays. The global fadeIn (opacity only) is the correct one.

  const GlassCard = useMemo(() => {
    return ({ children, style = {} }: { children?: React.ReactNode; style?: React.CSSProperties }) => (
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          border: `1px solid ${currentTheme.cardBorder}`,
          borderRadius: isMobile ? '16px' : '24px',
          padding: isMobile ? '16px' : '36px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
          ...style
        }}
      >
        {children}
      </div>
    );
  }, [currentTheme, isMobile]);

  const validateCardMedia = useCallback((card: GeneratedCard) => {
    const frontImages = (card.front?.match(/\[IMAGE:(\d+)\]/g) || []).length;
    const backImages = (card.back?.match(/\[IMAGE:(\d+)\]/g) || []).length;
    const frontAudio = (card.front?.match(/\[AUDIO:(\d+)\]/g) || []).length;
    const backAudio = (card.back?.match(/\[AUDIO:(\d+)\]/g) || []).length;
    const frontMediaImages = card.frontMedia?.images?.length || 0;
    const backMediaImages = card.backMedia?.images?.length || 0;
    const frontMediaAudio = card.frontMedia?.audio?.length || 0;
    const backMediaAudio = card.backMedia?.audio?.length || 0;
    return frontImages === frontMediaImages &&
      backImages === backMediaImages &&
      frontAudio === frontMediaAudio &&
      backAudio === backMediaAudio;
  }, []);

  const generateImageForCard = useCallback(async (imagePrompt: string, card: GeneratedCard): Promise<string | null> => {
    try {
      let processedPrompt = imagePrompt;
      if (card.front) {
        const word = card.front.replace(/\*\*/g, '').replace(/\*/g, '').split(' ')[0];
        processedPrompt = processedPrompt.replace(/\{word\}/g, word);
      }
      if (card.back) {
        const translation = card.back.replace(/\*\*/g, '').replace(/\*/g, '').split('.')[0].split('\n')[0];
        processedPrompt = processedPrompt.replace(/\{translation\}/g, translation);
      }
      const enhancedPrompt = `${processedPrompt}. Small square icon/illustration (256x256 pixels), lightweight, minimalist style, suitable for flashcard display.`;
      const response = await miyagiAPI.post('/generate-image', { prompt: enhancedPrompt });
      if (response.success) {
        const data = response.data as GenerateImagePayload;
        if (data?.imageUrls && data.imageUrls.length > 0) return data.imageUrls[0];
      }
      throw new Error((response.success ? undefined : response.error) || 'Image generation failed');
    } catch {
      return null;
    }
  }, []);

  const generateAudioForCard = useCallback(async (audioPrompt: string, card: GeneratedCard): Promise<string | null> => {
    try {
      // Directly use audioPrompt as the text to speak - assume it's already clean from bulk generation
      const textToSpeak = audioPrompt.trim();
      // Preserve original runtime behavior: pass through `targetLang` (possibly
      // undefined). The util defaults internally to 'english' when falsy, so we
      // cast rather than substitute a value here.
      const appropriateVoice = PROMPTS.getAudioVoiceForLanguage(currentDeck?.targetLang as string);
      const audioResponse = await miyagiAPI.post('/text-to-speech', {
        text: `${textToSpeak}. ... ${textToSpeak}.`,
        model: 'tts-1',
        voice: appropriateVoice,
        speed: 0.6
      });
      if (audioResponse.success) {
        const data = audioResponse.data as TextToSpeechPayload;
        if (data?.audioUrl) return data.audioUrl;
      }
      throw new Error((audioResponse.success ? undefined : audioResponse.error) || 'Audio generation failed');
    } catch {
      return null;
    }
  }, [currentDeck?.targetLang]);

  const processMediaForGeneratedCards = useCallback(async (cards: GeneratedCard[], mediaOptions: MediaOptions): Promise<GeneratedCard[]> => {
    if (!mediaOptions.generateImages && !mediaOptions.generateAudio) return cards;
    const updatedCards: GeneratedCard[] = cards.map(card => ({
      ...card,
      frontMedia: { images: [], audio: [] },
      backMedia: { images: [], audio: [] }
    }));

    // Start all image generation requests in parallel
    const imagePromises = mediaOptions.generateImages
      ? updatedCards.map(async (card, index) => {
        if (!card.imagePrompt) return { index, success: false };
        try {
          const imageUrl = await generateImageForCard(card.imagePrompt, card);
          return { index, success: !!imageUrl, imageUrl };
        } catch (error) {
          console.error(`Image generation failed for card ${index}:`, error);
          return { index, success: false };
        }
      })
      : [];

    // Start all audio generation requests in parallel
    // Skip audio generation for cloze cards
    const audioPromises = mediaOptions.generateAudio
      ? updatedCards.map(async (card, index) => {
        // Skip audio generation for cloze cards
        if (card.type === 'Cloze' || !card.audioPrompt) return { index, success: false };
        try {
          const audioUrl = await generateAudioForCard(card.audioPrompt, card);
          return { index, success: !!audioUrl, audioUrl };
        } catch (error) {
          console.error(`Audio generation failed for card ${index}:`, error);
          return { index, success: false };
        }
      })
      : [];

    // Wait for all requests to complete in parallel
    const [imageResults, audioResults] = await Promise.all([
      Promise.all(imagePromises),
      Promise.all(audioPromises)
    ]);

    // Apply results to cards
    let imageSuccessCount = 0;
    let imageFailCount = 0;
    let audioSuccessCount = 0;
    let audioFailCount = 0;

    imageResults.forEach(({ index, success, imageUrl }) => {
      if (success && imageUrl) {
        updatedCards[index].frontMedia!.images.push(imageUrl);
        if (!/\[IMAGE:\d+\]/.test(updatedCards[index].front || '')) {
          updatedCards[index].front = `${updatedCards[index].front || ''} [IMAGE:0]`;
        } else {
          updatedCards[index].front = (updatedCards[index].front || '').replace(/\[IMAGE:\d+\]/, '[IMAGE:0]');
        }
        imageSuccessCount++;
      } else {
        imageFailCount++;
      }
    });

    audioResults.forEach(({ index, success, audioUrl }) => {
      if (success && audioUrl) {
        updatedCards[index].frontMedia!.audio.push(audioUrl);
        updatedCards[index].front = (updatedCards[index].front || '') + (updatedCards[index].front ? ' ' : '') + '[AUDIO:0]';
        audioSuccessCount++;
      } else {
        audioFailCount++;
      }
    });

    const parts: string[] = [];
    let hasErrors = false;
    if (mediaOptions.generateImages) {
      if (imageSuccessCount) parts.push(`${imageSuccessCount} image${imageSuccessCount > 1 ? 's' : ''}`);
      if (imageFailCount) { parts.push(`${imageFailCount} image${imageFailCount > 1 ? 's' : ''} failed`); hasErrors = true; }
    }
    if (mediaOptions.generateAudio) {
      if (audioSuccessCount) parts.push(`${audioSuccessCount} audio${audioSuccessCount > 1 ? 's' : ''}`);
      if (audioFailCount) { parts.push(`${audioFailCount} audio${audioFailCount > 1 ? 's' : ''} failed`); hasErrors = true; }
    }
    if (parts.length > 0) {
      setMediaNotification({
        type: hasErrors ? 'error' : 'success',
        message: hasErrors ? `Generation issues: ${parts.join(', ')}` : `${parts.join(', ')} generated`
      });
      setTimeout(() => setMediaNotification(null), 2000);
    }

    const validatedCards = updatedCards.map(card => {
      if (!validateCardMedia(card)) {
        card.frontMedia = { images: [], audio: [] };
        card.backMedia = { images: [], audio: [] };
        card.front = card.front?.replace(/\[IMAGE:\d+\]|\[AUDIO:\d+\]/g, '') || '';
        card.back = card.back?.replace(/\[IMAGE:\d+\]|\[AUDIO:\d+\]/g, '') || '';
      }
      return card;
    });
    return validatedCards;
  }, [generateAudioForCard, generateImageForCard, validateCardMedia]);

  const processTextForStorage = (text: string, existingMedia: GeneratedCardMedia | null | undefined) => ({
    processedText: text || '',
    finalMedia: existingMedia || { images: [], audio: [] }
  });

  const handleCreateCard = (cardData: HandleCreateCardInput = {}) => {
    setErrorMessage('');
    setSuccessMessage('');

    // New API: card type based
    if (cardData.cardTypeId && cardData.fields) {
      const { cardTypeId, fields, fieldMedia = {}, tags: cardTags = [] } = cardData;

      if (!selectedDeck) {
        setErrorMessage('Please select a deck');
        setTimeout(() => setErrorMessage(''), 2000);
        return;
      }

      const cardType = cardTypes[cardTypeId];
      if (!cardType) {
        setErrorMessage('Invalid card type');
        setTimeout(() => setErrorMessage(''), 2000);
        return;
      }

      const baseCardData = {
        deckId: selectedDeck,
        cardTypeId: cardTypeId,
        content: {
          fields: fields,
          fieldMedia: fieldMedia
        },
        scheduling: { state: 'new', interval: 0, ease: 2.5, dueDate: new Date().toISOString(), lapses: 0, stepsIndex: 0 },
        tags: cardTags,
        revLog: []
      };

      const newCards: CardMap = {};

      // Handle reversible card types (creates 2 cards)
      if (cardType?.reversible) {
        const normalCardId = 'card-' + generateId();
        const reversedCardId = 'card-' + generateId();

        // Normal card
        newCards[normalCardId] = {
          id: normalCardId,
          ...baseCardData,
          type: 'Basic'
        } as unknown as CardMap[string];

        // Reversed card (swap first two fields)
        const reversedFields: Record<string, string> = { ...fields };
        const fieldNames = cardType.fields || [];
        if (fieldNames.length >= 2) {
          const firstField = fieldNames[0] as unknown as string;
          const secondField = fieldNames[1] as unknown as string;
          reversedFields[firstField] = fields[secondField] || '';
          reversedFields[secondField] = fields[firstField] || '';
        }

        newCards[reversedCardId] = {
          id: reversedCardId,
          ...baseCardData,
          content: {
            ...baseCardData.content,
            fields: reversedFields
          },
          type: 'Basic'
        } as unknown as CardMap[string];
      } else if (cardType?.isCloze) {
        // Cloze deletion card
        const textField = (cardType.fields?.[0] as unknown as string) || 'Text';
        const text = fields[textField] || '';
        const clozes: string[] = [];
        const clozePattern = /\{\{([^}]+)\}\}/g;
        let match;
        while ((match = clozePattern.exec(text)) !== null) {
          clozes.push(match[1]);
        }

        const cardId = 'card-' + generateId();
        newCards[cardId] = {
          id: cardId,
          ...baseCardData,
          type: 'Cloze',
          content: {
            ...baseCardData.content,
            text: text,
            clozes: clozes
          }
        } as unknown as CardMap[string];
      } else if (cardType?.isPronunciation) {
        // Pronunciation practice card
        const cardId = 'card-' + generateId();
        newCards[cardId] = {
          id: cardId,
          ...baseCardData,
          type: 'Pronunciation'
        } as unknown as CardMap[string];
      } else {
        // Standard card
        const cardId = 'card-' + generateId();
        newCards[cardId] = {
          id: cardId,
          ...baseCardData,
          type: 'Basic'
        } as unknown as CardMap[string];
      }

      // Save cards to file storage (update search index for bulk imports)
      saveCards(cardMutations, newCards);

      if (selectedDeck && decks[selectedDeck]) {
        const deck = decks[selectedDeck];
        const { recordId: deckRid, ...deckData } = deck;
        const count = Object.keys(newCards).length;
        if (deckRid) {
          deckMutations.put(deckRid, {
            ...deckData,
            cardCounts: { ...deckData.cardCounts, new: (deckData.cardCounts?.new || 0) + count }
          });
        }
      }

      setSuccessMessage(`Created ${Object.keys(newCards).length} card(s) successfully!`);
      setTimeout(() => setSuccessMessage(''), 2000);
      return;
    }

    // Legacy API: fallback for old code
    const { customFields = {}, customFieldMedia = {}, customTemplate = null } = cardData;

    if (cardType === 'Cloze') {
      if (!selectedDeck || !frontText.trim()) {
        setErrorMessage('Please select a deck and fill in the text with {{blanks}}');
        setTimeout(() => setErrorMessage(''), 2000);
        return;
      }
      const matches = frontText.match(/\{\{([^}]+)\}\}/g);
      if (!matches || matches.length === 0) {
        setErrorMessage('Please add at least one blank using {{word}} syntax');
        setTimeout(() => setErrorMessage(''), 2000);
        return;
      }
    } else if (!selectedDeck || !frontText.trim() || !backText.trim()) {
      setErrorMessage('Please select a deck and fill in both front and back text');
      setTimeout(() => setErrorMessage(''), 2000);
      return;
    }

    const frontProcessed = processTextForStorage(frontText, frontMedia);
    const backProcessed = processTextForStorage(backText, backMedia);

    const processedCustomFields: Record<string, string> = {};
    const processedCustomFieldMedia: Record<string, GeneratedCardMedia> = {};
    Object.keys(customFields).forEach(fieldId => {
      processedCustomFields[fieldId] = customFields[fieldId] || '';
      processedCustomFieldMedia[fieldId] = customFieldMedia[fieldId] || { images: [], audio: [] };
    });

    const baseCardData = {
      deckId: selectedDeck,
      content: {
        frontMedia: frontProcessed.finalMedia,
        backMedia: backProcessed.finalMedia,
        customFields: processedCustomFields,
        customFieldMedia: processedCustomFieldMedia
      },
      scheduling: { state: 'new', interval: 0, ease: 2.5, dueDate: new Date().toISOString(), lapses: 0, stepsIndex: 0 },
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      revLog: [],
      template: customTemplate
    };

    const newCards: CardMap = {};
    if (cardType === 'Cloze') {
      const clozes: string[] = [];
      const clozePattern = /\{\{([^}]+)\}\}/g;
      let match;
      while ((match = clozePattern.exec(frontText)) !== null) clozes.push(match[1]);
      const cardId = 'card-' + generateId();
      newCards[cardId] = { id: cardId, ...baseCardData, type: 'Cloze', content: { ...baseCardData.content, text: frontProcessed.processedText, clozes } } as unknown as CardMap[string];
    } else if (cardType === 'BasicReversed') {
      const normalCardId = 'card-' + generateId();
      const reversedCardId = 'card-' + generateId();
      newCards[normalCardId] = { id: normalCardId, ...baseCardData, type: 'Basic', content: { ...baseCardData.content, front: frontProcessed.processedText, back: backProcessed.processedText } } as unknown as CardMap[string];
      newCards[reversedCardId] = { id: reversedCardId, ...baseCardData, type: 'Basic', content: { ...baseCardData.content, front: backProcessed.processedText, back: frontProcessed.processedText } } as unknown as CardMap[string];
    } else {
      const cardId = 'card-' + generateId();
      newCards[cardId] = { id: cardId, ...baseCardData, type: cardType, content: { ...baseCardData.content, front: frontProcessed.processedText, back: backProcessed.processedText } } as unknown as CardMap[string];
    }

    // Save cards to file storage (update search index for bulk imports)
    saveCards(cardMutations, newCards);

    if (selectedDeck && decks[selectedDeck]) {
      const deck = decks[selectedDeck];
      const { recordId: deckRid, ...deckData } = deck;
      const count = Object.keys(newCards).length;
      if (deckRid) {
        deckMutations.put(deckRid, {
          ...deckData,
          cardCounts: { ...deckData.cardCounts, new: (deckData.cardCounts?.new || 0) + count }
        });
      }
    }

    setFrontText('');
    setBackText('');
    setTags('');
    setFrontMedia({ images: [], audio: [] });
    setBackMedia({ images: [], audio: [] });
    setSuccessMessage('Card created successfully!');
    setTimeout(() => setSuccessMessage(''), 2000);
  };

  const handleFrontMediaGenerated = useCallback((mediaData: { type: string; url: string }) => {
    if (mediaData.type === 'image') {
      setFrontMedia(prev => ({ ...prev, images: [...prev.images, mediaData.url] }));
    } else {
      setFrontMedia(prev => ({ ...prev, audio: [...prev.audio, mediaData.url] }));
    }
  }, []);

  const handleBackMediaGenerated = useCallback((mediaData: { type: string; url: string }) => {
    if (mediaData.type === 'image') {
      setBackMedia(prev => ({ ...prev, images: [...prev.images, mediaData.url] }));
    } else {
      setBackMedia(prev => ({ ...prev, audio: [...prev.audio, mediaData.url] }));
    }
  }, []);

  const handleFrontMediaRemove = useCallback((type: 'image' | 'audio', index: number) => {
    if (type === 'image') {
      setFrontMedia(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    } else {
      setFrontMedia(prev => ({ ...prev, audio: prev.audio.filter((_, i) => i !== index) }));
    }
  }, []);

  const handleBackMediaRemove = useCallback((type: 'image' | 'audio', index: number) => {
    if (type === 'image') {
      setBackMedia(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    } else {
      setBackMedia(prev => ({ ...prev, audio: prev.audio.filter((_, i) => i !== index) }));
    }
  }, []);

  const handleGenerateBulk = useCallback(async (mode: 'auto' | 'data' = activeMode as 'auto' | 'data') => {
    setErrorMessage('');
    setSuccessMessage('');
    const textToUse = mode === 'auto' ? promptText : (mode === 'data' ? pastedText : bulkText);
    if (!selectedDeck || !textToUse.trim()) {
      setErrorMessage(`Please select a deck and ${mode === 'auto' ? 'enter a prompt' : 'provide text'}`);
      setTimeout(() => setErrorMessage(''), 2000);
      return;
    }
    setIsGeneratingBulk(true);
    try {
      const systemPrompt = PROMPTS.BULK_GENERATION_SYSTEM();
      const activeTypes = bulkCardTypes.length > 0 ? bulkCardTypes : ['Basic'];
      const mediaOptions = { generateImages, generateAudio };
      const targetLang = currentDeck?.targetLang || 'Spanish';
      const nativeLang = currentDeck?.nativeLang || 'English';
      const prompt = mode === 'auto'
        ? `${systemPrompt}\n\n${PROMPTS.BULK_GENERATION_AUTO(cardCount, activeTypes, promptText, mediaOptions, targetLang, nativeLang)}`
        : `${systemPrompt}\n\n${PROMPTS.BULK_GENERATION_DATA(cardCount, activeTypes, textToUse, mediaOptions, targetLang, nativeLang)}`;

      const response = await miyagiAPI.post('/generate-text', {
        prompt,
        provider: 'openai',
        model: 'gpt-4o', // Structured output task: bulk generation (1000-4000 tokens) - using gpt-4o for better JSON reliability
        max_tokens: Math.min(1000 + (cardCount * 100), 4000),
        system_prompt: systemPrompt
      });

      // Validate response structure
      if (!response || typeof response !== 'object') {
        console.error('Invalid response structure:', response);
        throw new Error('Invalid API response. Please try again.');
      }

      if (!response.success) {
        const errorMsg = response.error || 'Bulk generation failed';
        console.error('API error:', errorMsg);
        throw new Error(errorMsg);
      }

      // Extract text from response
      const textPayload = response.data as GenerateTextPayload;
      let text = textPayload?.text;
      if (!text || typeof text !== 'string') {
        console.error('Missing or invalid text in response:', {
          hasData: !!response.data,
          dataKeys: response.data ? Object.keys(response.data) : [],
          textType: typeof text
        });
        throw new Error('AI returned empty or invalid response. Please try again.');
      }

      text = text.trim();
      if (!text) {
        console.error('Empty text after trimming');
        throw new Error('AI returned empty response. Please try again.');
      }

      // Try to extract JSON from markdown code blocks first
      let cleanedText = text;
      const jsonCodeBlockMatch = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (jsonCodeBlockMatch) {
        cleanedText = jsonCodeBlockMatch[1].trim();
      } else {
        // Try to find JSON array in the response
        const jsonArrayMatch = text.match(/\[[\s\S]*\]/);
        if (jsonArrayMatch) {
          cleanedText = jsonArrayMatch[0];
        } else {
          // Last resort: try to find any JSON structure
          const anyJsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (anyJsonMatch) {
            cleanedText = anyJsonMatch[0];
          }
        }
      }

      // Parse the JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleanedText);
      } catch (parseError) {
        // Try to clean up common issues
        cleanedText = cleanedText
          .replace(/^[^\[{]*/, '') // Remove leading non-JSON text
          .replace(/[^\]}]*$/, '') // Remove trailing non-JSON text
          .replace(/,\s*([}\]])/g, '$1'); // Remove trailing commas
        try {
          parsed = JSON.parse(cleanedText);
        } catch (secondError) {
          console.error('JSON parsing failed. Original text:', text.substring(0, 500));
          console.error('Cleaned text:', cleanedText.substring(0, 500));
          throw new Error('AI response did not contain a valid JSON array. The response may be malformed. Please try again.');
        }
      }

      if (!Array.isArray(parsed)) {
        // If it's an object with an array property, try to extract it
        if (typeof parsed === 'object' && parsed !== null) {
          const parsedObj = parsed as Record<string, unknown>;
          const arrayKey = Object.keys(parsedObj).find(key => Array.isArray(parsedObj[key]));
          if (arrayKey) {
            parsed = parsedObj[arrayKey];
          } else {
            throw new Error('AI response did not contain a valid JSON array. Please try again.');
          }
        } else {
          throw new Error('AI response did not contain a valid JSON array. Please try again.');
        }
      }

      const parsedArray = parsed as RawGeneratedCard[];

      if (parsedArray.length === 0) {
        console.error('⚠️ AI returned empty array. Full response:', text.substring(0, 1000));
        throw new Error(`AI could not extract any cards from the provided text. Please try with different text or check if the text contains vocabulary words/phrases.`);
      }

      const limited = parsedArray.slice(0, cardCount);
      const processedCards: GeneratedCard[] = limited.map((card, idx) => {
        const isCloze = card.front && /\{\{([^}]+)\}\}/.test(card.front);
        const resolvedType = (!card.back && isCloze) ? 'Cloze' :
          (activeTypes.includes('BasicReversed') && idx % 2 === 1) ? 'BasicReversed' :
            activeTypes[0] || 'Basic';
        return {
          front: card.front || '',
          back: card.back || '',
          id: 'temp-' + idx,
          tags: [],
          type: resolvedType,
          imagePrompt: card.imagePrompt,
          audioPrompt: card.audioPrompt
        };
      });
      if (generateImages || generateAudio) {
        const cardsWithMedia = await processMediaForGeneratedCards(processedCards, mediaOptions);
        setGeneratedCards(cardsWithMedia);
        setSuccessMessage(`Generated ${limited.length} cards with media!`);
      } else {
        setGeneratedCards(processedCards);
        setSuccessMessage(`Generated ${limited.length} cards!`);
      }
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (error) {
      setErrorMessage((error instanceof Error ? error.message : '') || 'Failed to generate cards. Please try again.');
      setTimeout(() => setErrorMessage(''), 2000);
    } finally {
      setIsGeneratingBulk(false);
    }
  }, [activeMode, bulkCardTypes, bulkText, cardCount, generateAudio, generateImages, pastedText, processMediaForGeneratedCards, promptText, selectedDeck]);

  // Helper: convert a media URL (base64 or HTTPS) to a persistent media reference
  const persistMediaUrl = useCallback(async (url: string, type: 'image' | 'audio'): Promise<string> => {
    if (!url || typeof url !== 'string') return url;
    // Cast to unknown so the `isMediaReference` predicate doesn't collapse the
    // already-`string` `url` to `never` in the branches below.
    if (isMediaReference(url as unknown)) return url;
    if (url.startsWith('data:')) {
      try {
        const blob = base64ToBlob(url);
        const mediaId = await saveMedia(mediaMutations!, mediaRecords, blob, type);
        return `media:${type}:${mediaId}`;
      } catch (e) {
        console.error(`Failed to persist ${type} data URL:`, e);
        return url;
      }
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const blob = await resp.blob();
          const mediaId = await saveMedia(mediaMutations!, mediaRecords, blob, type);
          return `media:${type}:${mediaId}`;
        }
      } catch (e) {
        console.error(`Failed to persist remote ${type}:`, e);
      }
    }
    return url;
  }, [mediaMutations, mediaRecords]);

  // Helper: persist all URLs in a media object
  const persistMediaObject = useCallback(async (mediaObj: GeneratedCardMedia | null | undefined): Promise<GeneratedCardMedia> => {
    if (!mediaObj) return { images: [], audio: [] };
    return {
      images: await Promise.all((mediaObj.images || []).map(u => persistMediaUrl(u, 'image'))),
      audio: await Promise.all((mediaObj.audio || []).map(u => persistMediaUrl(u, 'audio')))
    };
  }, [persistMediaUrl]);

  const handleSaveBulkCards = useCallback(async () => {
    // First, generate audio for any cards that have audioPrompt but no audio
    const cardsWithAudio: GeneratedCard[] = [];
    for (const card of generatedCards) {
      const processedCard: GeneratedCard = { ...card };

      // Skip audio generation for cloze cards
      if (card.type !== 'Cloze' && card.audioPrompt && (!card.frontMedia?.audio || card.frontMedia.audio.length === 0)) {
        try {
          const audioUrl = await generateAudioForCard(card.audioPrompt, card);
          if (audioUrl) {
            processedCard.frontMedia = {
              ...processedCard.frontMedia,
              audio: [audioUrl]
            } as GeneratedCardMedia;
            // Add placeholder to front content
            processedCard.front = (processedCard.front || '') + (processedCard.front ? ' ' : '') + '[AUDIO:0]';
          }
        } catch (error) {
          console.error('Failed to generate audio for card:', error);
        }
      }

      cardsWithAudio.push(processedCard);
    }

    const newCards: CardMap = {};
    for (const card of cardsWithAudio) {
      // Check if card uses new format (cardTypeId + fields)
      if (card.cardTypeId && card.fields) {
        const cardType = cardTypes[card.cardTypeId];
        if (!cardType) {
          console.error(`Card type ${card.cardTypeId} not found`);
          continue;
        }

        // Persist field media (convert URLs to media references)
        const persistedFieldMedia: Record<string, GeneratedCardMedia> = {};
        for (const [fn, fm] of Object.entries(card.fieldMedia || {})) {
          persistedFieldMedia[fn] = await persistMediaObject(fm);
        }

        const cardId = 'card-' + generateId();
        const baseCardData = {
          id: cardId,
          deckId: selectedDeck,
          cardTypeId: card.cardTypeId,
          content: {
            fields: card.fields,
            fieldMedia: persistedFieldMedia
          },
          scheduling: { state: 'new', interval: 0, ease: 2.5, dueDate: new Date().toISOString(), lapses: 0, stepsIndex: 0 },
          tags: card.tags || [],
          revLog: []
        };

        // Handle special card types
        if (cardType?.isCloze) {
          const textField = (cardType.fields?.[0] as unknown as string) || 'Text';
          const text = card.fields[textField] || '';
          const clozes: string[] = [];
          const clozePattern = /\{\{([^}]+)\}\}/g;
          let match;
          while ((match = clozePattern.exec(text)) !== null) {
            clozes.push(match[1]);
          }
          newCards[cardId] = {
            ...baseCardData,
            type: 'Cloze',
            content: {
              ...baseCardData.content,
              text: text,
              clozes: clozes
            }
          } as unknown as CardMap[string];
        } else if (cardType?.isPronunciation) {
          newCards[cardId] = {
            ...baseCardData,
            type: 'Pronunciation'
          } as unknown as CardMap[string];
        } else {
          newCards[cardId] = {
            ...baseCardData,
            type: cardType.name || 'Basic'
          } as unknown as CardMap[string];
        }
        continue;
      }

      // Legacy format handling - persist media URLs before saving
      const persistedFrontMedia = await persistMediaObject(card.frontMedia);
      const persistedBackMedia = await persistMediaObject(card.backMedia);

      const cardTypeResolved = card.type || (bulkCardTypes.length > 0 ? bulkCardTypes[0] : 'Basic');
      const cardId = 'card-' + generateId();
      if (cardTypeResolved === 'Cloze') {
        const clozes: string[] = [];
        const clozePattern = /\{\{([^}]+)\}\}/g;
        let match;
        const front = card.front || '';
        while ((match = clozePattern.exec(front)) !== null) clozes.push(match[1]);
        newCards[cardId] = {
          id: cardId,
          deckId: selectedDeck,
          type: 'Cloze',
          content: {
            text: front,
            clozes,
            frontMedia: persistedFrontMedia,
            backMedia: persistedBackMedia
          },
          scheduling: { state: 'new', interval: 0, ease: 2.5, dueDate: new Date().toISOString(), lapses: 0, stepsIndex: 0 },
          tags: card.tags || [],
          revLog: []
        } as unknown as CardMap[string];
      } else if (cardTypeResolved === 'BasicReversed') {
        const normalCardId = 'card-' + generateId();
        const reversedCardId = 'card-' + generateId();
        newCards[normalCardId] = {
          id: normalCardId,
          deckId: selectedDeck,
          type: 'Basic',
          content: {
            front: card.front || '',
            back: card.back || '',
            frontMedia: persistedFrontMedia,
            backMedia: persistedBackMedia
          },
          scheduling: { state: 'new', interval: 0, ease: 2.5, dueDate: new Date().toISOString(), lapses: 0, stepsIndex: 0 },
          tags: card.tags || [],
          revLog: []
        } as unknown as CardMap[string];
        newCards[reversedCardId] = {
          id: reversedCardId,
          deckId: selectedDeck,
          type: 'Basic',
          content: {
            front: card.back || '',
            back: card.front || '',
            frontMedia: persistedBackMedia,
            backMedia: persistedFrontMedia
          },
          scheduling: { state: 'new', interval: 0, ease: 2.5, dueDate: new Date().toISOString(), lapses: 0, stepsIndex: 0 },
          tags: card.tags || [],
          revLog: []
        } as unknown as CardMap[string];
      } else {
        newCards[cardId] = {
          id: cardId,
          deckId: selectedDeck,
          type: 'Basic',
          content: {
            front: card.front || '',
            back: card.back || '',
            frontMedia: persistedFrontMedia,
            backMedia: persistedBackMedia
          },
          scheduling: { state: 'new', interval: 0, ease: 2.5, dueDate: new Date().toISOString(), lapses: 0, stepsIndex: 0 },
          tags: card.tags || [],
          revLog: []
        } as unknown as CardMap[string];
      }
    }

    // Save cards to file storage (update search index for bulk imports)
    saveCards(cardMutations, newCards);

    if (selectedDeck && decks[selectedDeck]) {
      const deck = decks[selectedDeck];
      const { recordId: deckRid, ...deckData } = deck;
      const count = Object.keys(newCards).length;
      if (deckRid) {
        deckMutations.put(deckRid, {
          ...deckData,
          cardCounts: { ...deckData.cardCounts, new: (deckData.cardCounts?.new || 0) + count }
        });
      }
    }
    setGeneratedCards([]);
    setBulkText('');
    setPromptText('');
    setPastedText('');
    setSuccessMessage(`Successfully created ${Object.keys(newCards).length} cards!`);
    setTimeout(() => setSuccessMessage(''), 2000);
    setIsVocabJsonImport(false);
  }, [bulkCardTypes, generatedCards, selectedDeck, decks, deckMutations, cardTypes, generateAudioForCard]);

  const handleStartOver = useCallback(() => {
    setGeneratedCards([]);
    setPromptText('');
    setPastedText('');
    setBulkText('');
    setIsVocabJsonImport(false);
    setBulkCardTypes(['Basic']);
    setVocabCardDirection('target-to-native');
    setImportedVocabJson(null);
  }, []);

  // Check if JSON is vocab format
  const isVocabJsonFormat = useCallback((jsonData: unknown): jsonData is VocabEntry[] => {
    if (!Array.isArray(jsonData) || jsonData.length === 0) return false;
    const firstItem = jsonData[0];
    return firstItem &&
      typeof firstItem === 'object' &&
      'word' in firstItem &&
      'english_translation' in firstItem;
  }, []);

  // Convert vocab JSON entries to basic cards
  const convertVocabJsonToCards = useCallback((jsonData: VocabEntry[], limit: number | null = null, direction = 'target-to-native'): GeneratedCard[] => {
    const entries = limit ? jsonData.slice(0, limit) : jsonData;

    // Build the back content with examples, frequency, etc. (same for both directions)
    const buildBackContent = (translation: string, entry: VocabEntry) => {
      return `**${translation || ''}**\n\n${entry.example_sentence_native ? `*${entry.example_sentence_native}*\n${entry.example_sentence_english || ''}\n\n` : ''}${entry.pos ? `Part of speech: ${entry.pos}\n` : ''}${entry.word_frequency ? `Frequency: ${entry.word_frequency}\n` : ''}${entry.cefr_level ? `CEFR Level: ${entry.cefr_level}` : ''}`.trim();
    };

    const cards: GeneratedCard[] = [];

    entries.forEach((entry, idx) => {
      const word = entry.word || '';
      const translation = entry.english_translation || '';

      if (direction === 'both') {
        // Create one card with type BasicReversed - this will generate both directions
        const backContent = buildBackContent(translation, entry);
        cards.push({
          id: `temp-${idx}`,
          type: 'BasicReversed',
          front: word,
          back: backContent,
          frontMedia: { images: [], audio: [] },
          backMedia: { images: [], audio: [] },
          tags: [],
          // Store original word for audio generation
          originalWord: word
        });
      } else if (direction === 'target-to-native') {
        // Target language → Native language (e.g., Spanish → English)
        const backContent = buildBackContent(translation, entry);
        cards.push({
          id: `temp-${idx}`,
          type: 'Basic',
          front: word,
          back: backContent,
          frontMedia: { images: [], audio: [] },
          backMedia: { images: [], audio: [] },
          tags: []
        });
      } else if (direction === 'native-to-target') {
        // Native language → Target language (e.g., English → Spanish)
        const backContent = buildBackContent(word, entry);
        cards.push({
          id: `temp-${idx}`,
          type: 'Basic',
          front: translation,
          back: backContent,
          frontMedia: { images: [], audio: [] },
          backMedia: { images: [], audio: [] },
          tags: []
        });
      }
    });

    return cards;
  }, []);

  // Regenerate cards when direction or card count changes for imported JSON
  useEffect(() => {
    if (isVocabJsonImport && importedVocabJson) {
      const cards = convertVocabJsonToCards(importedVocabJson, cardCount, vocabCardDirection);
      const cardsWithAudio = cards.map(card => {
        let audioWord = card.front;
        if (card.type === 'Basic' && vocabCardDirection === 'native-to-target') {
          const backMatch = card.back?.match(/\*\*([^*]+)\*\*/);
          audioWord = backMatch ? backMatch[1] : card.front;
        } else if (card.originalWord) {
          audioWord = card.originalWord;
        }
        return {
          ...card,
          audioPrompt: `Pronounce: ${audioWord}`
        };
      });
      setGeneratedCards(cardsWithAudio);
    }
  }, [vocabCardDirection, cardCount, isVocabJsonImport, importedVocabJson, convertVocabJsonToCards]);

  const onTabChange = useCallback(() => {
    setGeneratedCards([]);
    setErrorMessage('');
    setSuccessMessage('');
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;

      // Check if it's a JSON file
      if (file.name.endsWith('.json')) {
        try {
          const jsonData = JSON.parse(content);

          // Check if it's vocab JSON format
          if (isVocabJsonFormat(jsonData)) {
            setIsVocabJsonImport(true);
            setImportedVocabJson(jsonData); // Store JSON for regeneration
            setBulkCardTypes(['Basic']); // Use basic cards for JSON import

            // Convert to cards and set as generated cards
            const cards = convertVocabJsonToCards(jsonData, cardCount, vocabCardDirection);

            // Automatically generate audio for imported cards
            // For audio, always use the target language word (original word from JSON)
            const cardsWithAudio = cards.map(card => {
              // For BasicReversed cards, use the original word (front is target language)
              // For native-to-target cards, we want audio of the target language word (in back)
              // For target-to-native cards, front is the target language word
              let audioWord = card.front;
              if (card.type === 'Basic' && vocabCardDirection === 'native-to-target') {
                // Extract the word from back content (it's in bold at the start)
                const backMatch = card.back?.match(/\*\*([^*]+)\*\*/);
                audioWord = backMatch ? backMatch[1] : card.front;
              } else if (card.originalWord) {
                audioWord = card.originalWord;
              }
              return {
                ...card,
                audioPrompt: `Pronounce: ${audioWord}` // Add audio prompt for each card
              };
            });

            setGeneratedCards(cardsWithAudio);
            const directionText = vocabCardDirection === 'target-to-native' ? 'Target → Native' :
              vocabCardDirection === 'native-to-target' ? 'Native → Target' : 'Both directions';
            setSuccessMessage(`Imported ${cards.length} vocabulary cards from JSON (${directionText}) with audio support!`);
            setTimeout(() => setSuccessMessage(''), 3000);
            return;
          }
        } catch (error) {
          console.error('Failed to parse JSON:', error);
          // Fall through to treat as text
        }
      }

      // Not vocab JSON, treat as regular text
      setIsVocabJsonImport(false);
      setPastedText(content);
    };
    reader.readAsText(file);
  }, [isVocabJsonFormat, convertVocabJsonToCards, cardCount, vocabCardDirection]);

  const handleToolbarImageUpload = useCallback(() => {
    const isFront = activeEditor === 'front';
    const placeholderIndex = isFront ? frontMedia.images.length : backMedia.images.length;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const placeholder = `[IMAGE:${placeholderIndex}]`;
        if (isFront) {
          handleFrontMediaGenerated({ type: 'image', url: event.target?.result as string });
          if (frontEditorRef.current) {
            frontEditorRef.current.insertText(placeholder);
          } else {
            setFrontText(prev => prev + placeholder);
          }
        } else {
          handleBackMediaGenerated({ type: 'image', url: event.target?.result as string });
          if (backEditorRef.current) {
            backEditorRef.current.insertText(placeholder);
          } else {
            setBackText(prev => prev + placeholder);
          }
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [activeEditor, backEditorRef, backMedia.images.length, handleBackMediaGenerated, handleFrontMediaGenerated, frontEditorRef, frontMedia.images.length]);

  const handleToolbarAudioUpload = useCallback(() => {
    const isFront = activeEditor === 'front';
    const placeholderIndex = isFront ? frontMedia.audio.length : backMedia.audio.length;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const placeholder = `[AUDIO:${placeholderIndex}]`;
        if (isFront) {
          handleFrontMediaGenerated({ type: 'audio', url: event.target?.result as string });
          if (frontEditorRef.current) {
            frontEditorRef.current.insertText(placeholder);
          } else {
            setFrontText(prev => prev + placeholder);
          }
        } else {
          handleBackMediaGenerated({ type: 'audio', url: event.target?.result as string });
          if (backEditorRef.current) {
            backEditorRef.current.insertText(placeholder);
          } else {
            setBackText(prev => prev + placeholder);
          }
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [activeEditor, backEditorRef, backMedia.audio.length, handleBackMediaGenerated, handleFrontMediaGenerated, frontEditorRef, frontMedia.audio.length]);

  // Card type editor handlers (lifted from CreateCardForm to render outside GlassCard).
  // The editor emits its own draft shape; derive it from the component's prop type
  // so the handler matches `CardTypeEditor`'s `onSave` without re-declaring it here.
  const handleCardTypeSave = useCallback((cardTypeData: Parameters<React.ComponentProps<typeof CardTypeEditor>['onSave']>[0]) => {
    updateCardTypes({
      ...cardTypes,
      [cardTypeData.id]: cardTypeData as unknown as CardType
    });
    setSelectedCardTypeId(cardTypeData.id);
    setShowCardTypeEditor(false);
    setEditingCardType(null);
  }, [updateCardTypes, cardTypes]);

  const handleOpenCardTypeEditor = useCallback(() => {
    setEditingCardType(null);
    setShowCardTypeEditor(true);
  }, []);

  const handleEditCardType = useCallback((cardType: CardType) => {
    setEditingCardType(cardType);
    setShowCardTypeEditor(true);
  }, []);

  const handleCloseCardTypeEditor = useCallback(() => {
    setShowCardTypeEditor(false);
    setEditingCardType(null);
  }, []);

  return (
    <div>
      <Notifications
        errorMessage={errorMessage}
        successMessage={successMessage}
        mediaNotification={mediaNotification}
        currentTheme={currentTheme}
      />
      <ToastContainer theme={currentTheme} />

      <GlassCard>
        <TabNav activeMode={activeMode} setActiveMode={setActiveMode} currentTheme={currentTheme} onTabChange={onTabChange} />

        {activeMode === 'create' && (
          <CreateCardForm
            currentTheme={currentTheme}
            selectedDeck={selectedDeck}
            setSelectedDeck={setSelectedDeck}
            decks={decks}
            currentDeck={currentDeck}
            tags={tags}
            setTags={setTags}
            handleCreateCard={handleCreateCard}
            cardTypes={cardTypes}
            updateCardTypes={updateCardTypes}
            mediaRecords={mediaRecords}
            mediaMutations={mediaMutations}
            selectedCardTypeId={selectedCardTypeId}
            setSelectedCardTypeId={setSelectedCardTypeId}
            onOpenCardTypeEditor={handleOpenCardTypeEditor}
            onEditCardType={handleEditCardType}
          />
        )}

        {activeMode === 'auto' && (
          <BulkGenerateForm
            mode="auto"
            currentTheme={currentTheme}
            decks={decks}
            selectedDeck={selectedDeck}
            setSelectedDeck={setSelectedDeck}
            bulkCardTypes={bulkCardTypes}
            setBulkCardTypes={setBulkCardTypes}
            cardCount={cardCount}
            setCardCount={setCardCount}
            generateImages={generateImages}
            setGenerateImages={setGenerateImages}
            generateAudio={generateAudio}
            setGenerateAudio={setGenerateAudio}
            isGeneratingBulk={isGeneratingBulk}
            generatedCards={generatedCards}
            setGeneratedCards={setGeneratedCards}
            onGenerate={handleGenerateBulk}
            onSave={handleSaveBulkCards}
            onStartOver={handleStartOver}
            textValue={promptText}
            setTextValue={setPromptText}
            generateImageForCard={generateImageForCard}
            generateAudioForCard={generateAudioForCard}
            setMediaNotification={setMediaNotification}
          />
        )}

        {activeMode === 'data' && (
          <BulkGenerateForm
            mode="data"
            currentTheme={currentTheme}
            decks={decks}
            selectedDeck={selectedDeck}
            setSelectedDeck={setSelectedDeck}
            bulkCardTypes={bulkCardTypes}
            setBulkCardTypes={setBulkCardTypes}
            cardCount={cardCount}
            setCardCount={setCardCount}
            generateImages={generateImages}
            setGenerateImages={setGenerateImages}
            generateAudio={generateAudio}
            setGenerateAudio={setGenerateAudio}
            isGeneratingBulk={isGeneratingBulk}
            generatedCards={generatedCards}
            setGeneratedCards={setGeneratedCards}
            onGenerate={handleGenerateBulk}
            onSave={handleSaveBulkCards}
            onStartOver={handleStartOver}
            textValue={pastedText}
            setTextValue={setPastedText}
            onFileUpload={handleFileUpload}
            generateImageForCard={generateImageForCard}
            generateAudioForCard={generateAudioForCard}
            setMediaNotification={setMediaNotification}
            isVocabJsonImport={isVocabJsonImport}
            vocabCardDirection={vocabCardDirection}
            setVocabCardDirection={setVocabCardDirection}
          />
        )}

        {activeMode === 'create' && generatedCards.length > 0 && (
          <GeneratedCardsPanel
            generatedCards={generatedCards}
            setGeneratedCards={setGeneratedCards}
            currentTheme={currentTheme}
            onSave={handleSaveBulkCards}
            onStartOver={handleStartOver}
            generateImageForCard={generateImageForCard}
            generateAudioForCard={generateAudioForCard}
            setMediaNotification={setMediaNotification}
          />
        )}
      </GlassCard>

      {/* CardTypeEditor rendered outside GlassCard for clean fixed positioning */}
      {showCardTypeEditor && (
        <CardTypeEditor
          cardType={editingCardType}
          cardTypes={cardTypes}
          onSave={handleCardTypeSave}
          onClose={handleCloseCardTypeEditor}
          theme={currentTheme}
        />
      )}
    </div>
  );
}

export default CardCreation;
