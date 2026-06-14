/**
 * Vocabulary Deck Generator
 * Generates decks on-the-fly from vocab_data files
 * Replaces prebuilt deck storage with dynamic generation
 */

import { generateId } from './storage';
import type { VocabEntry } from './dataset';
import type { VocabDataCache } from './vocabLoader';

/** Per-language descriptor used when generating cards and deck metadata. */
interface LanguageInfo {
  code: string
  name: string
  displayName: string
}

/**
 * Language mapping: vocab file name -> { code, name }
 */
const LANGUAGE_MAP: Record<string, LanguageInfo> = {
  'spanish.json': { code: 'es', name: 'Spanish', displayName: 'Spanish' },
  'french.json': { code: 'fr', name: 'French', displayName: 'French' },
  'german.json': { code: 'de', name: 'German', displayName: 'German' },
  'italian.json': { code: 'it', name: 'Italian', displayName: 'Italian' },
  'portuguese_generic.json': { code: 'pt', name: 'Portuguese', displayName: 'Portuguese' },
  'russian.json': { code: 'ru', name: 'Russian', displayName: 'Russian' },
  'korean.json': { code: 'ko', name: 'Korean', displayName: 'Korean' },
  'mandarin.json': { code: 'zh', name: 'Chinese', displayName: 'Chinese' },
  'arabic.json': { code: 'ar', name: 'Arabic', displayName: 'Arabic' },
  'hindi.json': { code: 'hi', name: 'Hindi', displayName: 'Hindi' }
};

/** A quick-pick deck definition (also used as generation params). */
interface QuickPickDeck {
  language: string
  pos: string
  difficulty: string
  count: number
  name: string
  subcategory: string
}

/**
 * Quick pick deck definitions - popular combinations for easy access
 * These are the "prebuilt" decks that appear in the UI
 */
const QUICK_PICK_DECKS: QuickPickDeck[] = [
  // A1-A2 Nouns for each language
  { language: 'spanish', pos: 'noun', difficulty: 'A1-A2', count: 200, name: 'Spanish A1-A2 Nouns', subcategory: 'nouns' },
  { language: 'french', pos: 'noun', difficulty: 'A1-A2', count: 200, name: 'French A1-A2 Nouns', subcategory: 'nouns' },
  { language: 'german', pos: 'noun', difficulty: 'A1-A2', count: 200, name: 'German A1-A2 Nouns', subcategory: 'nouns' },
  { language: 'italian', pos: 'noun', difficulty: 'A1-A2', count: 200, name: 'Italian A1-A2 Nouns', subcategory: 'nouns' },
  { language: 'portuguese', pos: 'noun', difficulty: 'A1-A2', count: 200, name: 'Portuguese A1-A2 Nouns', subcategory: 'nouns' },
  { language: 'russian', pos: 'noun', difficulty: 'A1-A2', count: 200, name: 'Russian A1-A2 Nouns', subcategory: 'nouns' },
  { language: 'korean', pos: 'noun', difficulty: 'A1-A2', count: 200, name: 'Korean A1-A2 Nouns', subcategory: 'nouns' },
  { language: 'chinese', pos: 'noun', difficulty: 'A1-A2', count: 200, name: 'Chinese A1-A2 Nouns', subcategory: 'nouns' },
  { language: 'arabic', pos: 'noun', difficulty: 'A1-A2', count: 200, name: 'Arabic A1-A2 Nouns', subcategory: 'nouns' },
  { language: 'hindi', pos: 'noun', difficulty: 'A1-A2', count: 200, name: 'Hindi A1-A2 Nouns', subcategory: 'nouns' },

  // B1-B2 Nouns for each language
  { language: 'spanish', pos: 'noun', difficulty: 'B1-B2', count: 200, name: 'Spanish B1-B2 Nouns', subcategory: 'nouns' },
  { language: 'french', pos: 'noun', difficulty: 'B1-B2', count: 200, name: 'French B1-B2 Nouns', subcategory: 'nouns' },
  { language: 'german', pos: 'noun', difficulty: 'B1-B2', count: 200, name: 'German B1-B2 Nouns', subcategory: 'nouns' },
  { language: 'italian', pos: 'noun', difficulty: 'B1-B2', count: 200, name: 'Italian B1-B2 Nouns', subcategory: 'nouns' },
  { language: 'portuguese', pos: 'noun', difficulty: 'B1-B2', count: 200, name: 'Portuguese B1-B2 Nouns', subcategory: 'nouns' },
  { language: 'russian', pos: 'noun', difficulty: 'B1-B2', count: 200, name: 'Russian B1-B2 Nouns', subcategory: 'nouns' },
  { language: 'korean', pos: 'noun', difficulty: 'B1-B2', count: 200, name: 'Korean B1-B2 Nouns', subcategory: 'nouns' },
  { language: 'chinese', pos: 'noun', difficulty: 'B1-B2', count: 200, name: 'Chinese B1-B2 Nouns', subcategory: 'nouns' },
  { language: 'arabic', pos: 'noun', difficulty: 'B1-B2', count: 200, name: 'Arabic B1-B2 Nouns', subcategory: 'nouns' },
  { language: 'hindi', pos: 'noun', difficulty: 'B1-B2', count: 200, name: 'Hindi B1-B2 Nouns', subcategory: 'nouns' },

  // C1-C2 Nouns for each language
  { language: 'spanish', pos: 'noun', difficulty: 'C1-C2', count: 200, name: 'Spanish C1-C2 Nouns', subcategory: 'nouns' },
  { language: 'french', pos: 'noun', difficulty: 'C1-C2', count: 200, name: 'French C1-C2 Nouns', subcategory: 'nouns' },
  { language: 'german', pos: 'noun', difficulty: 'C1-C2', count: 200, name: 'German C1-C2 Nouns', subcategory: 'nouns' },
  { language: 'italian', pos: 'noun', difficulty: 'C1-C2', count: 200, name: 'Italian C1-C2 Nouns', subcategory: 'nouns' },
  { language: 'portuguese', pos: 'noun', difficulty: 'C1-C2', count: 200, name: 'Portuguese C1-C2 Nouns', subcategory: 'nouns' },
  { language: 'russian', pos: 'noun', difficulty: 'C1-C2', count: 200, name: 'Russian C1-C2 Nouns', subcategory: 'nouns' },
  { language: 'korean', pos: 'noun', difficulty: 'C1-C2', count: 200, name: 'Korean C1-C2 Nouns', subcategory: 'nouns' },
  { language: 'chinese', pos: 'noun', difficulty: 'C1-C2', count: 200, name: 'Chinese C1-C2 Nouns', subcategory: 'nouns' },
  { language: 'arabic', pos: 'noun', difficulty: 'C1-C2', count: 200, name: 'Arabic C1-C2 Nouns', subcategory: 'nouns' },
  { language: 'hindi', pos: 'noun', difficulty: 'C1-C2', count: 200, name: 'Hindi C1-C2 Nouns', subcategory: 'nouns' }
];

/** Media slot attached to each generated card field. */
interface FieldMediaSlot {
  images: string[]
  audio: string[]
}

/** Scheduling block produced for freshly generated vocabulary cards. */
interface GeneratedCardScheduling {
  state: 'new'
  interval: number
  ease: number
  dueDate: string
  lapses: number
  stepsIndex: number
}

/**
 * A vocabulary card produced by {@link generateDeckFromVocab}.
 *
 * Note: this is the on-disk generator shape (with `content.fields` /
 * `content.fieldMedia` and a scheduling block without `isLeech`); it is
 * intentionally distinct from the runtime `Card` type in `../types`.
 */
export interface GeneratedVocabCard {
  version: string
  id: string
  deckId: string
  cardTypeId: 'vocabulary'
  createdAt: string
  updatedAt: string
  content: {
    fields: Record<string, string>
    fieldMedia: Record<string, FieldMediaSlot>
  }
  scheduling: GeneratedCardScheduling
  tags: string[]
  revLog: unknown[]
}

/** Parameters accepted by {@link generateDeckFromVocab}. */
export interface GenerateDeckParams {
  language: string
  pos: string
  difficulty: string
  count: number
  name?: string
  subcategory?: string
  selectedLevels?: string[]
}

/** A card whose duplicate key can be derived (mirrors persisted vocabulary cards). */
interface DuplicateCheckCard {
  cardTypeId?: string
  content?: {
    fields?: Record<string, string>
  }
}

/** An entry in the virtual deck index produced by {@link generateVirtualDeckIndex}. */
export interface VirtualDeckEntry {
  id: string
  path: string
  language: string
  category: string
  subcategory: string
  cardCount: number
  difficulty: string
  tags: string[]
  _generateParams: QuickPickDeck
  _langInfo: LanguageInfo
}

/** The virtual deck index returned by {@link generateVirtualDeckIndex}. */
export interface VirtualDeckIndex {
  version: string
  lastUpdated: string
  decks: VirtualDeckEntry[]
  languages: Record<string, { count: number; categories: string[] }>
  categories: Record<string, { count: number; label: string }>
}

/** Deck metadata returned by {@link generateDeckMetadata}. */
export interface GeneratedDeckMetadata {
  id: string
  name?: string
  description: string
  language: string
  targetLang: string
  nativeLang: string
  category: string
  subcategory?: string
  tags: string[]
  cardCount: number
  difficulty: string
  estimatedStudyTime: string
  version: string
  createdAt: string
  updatedAt: string
  author: string
  preview: {
    sampleWords: string[]
    sampleCount: number
  }
}

/**
 * Get CEFR levels for a difficulty range
 * @param difficulty - Difficulty string like "A1-A2", "B1-B2", "C1-C2"
 * @returns Array of CEFR levels
 */
function getCEFRLevels(difficulty: string): string[] {
  if (difficulty === 'A1-A2') return ['A1', 'A2'];
  if (difficulty === 'B1-B2') return ['B1', 'B2'];
  if (difficulty === 'C1-C2') return ['C1', 'C2'];
  return [];
}

/**
 * Get vocab file name for a language
 * @param language - Language name (e.g., "spanish", "portuguese")
 * @returns File name or null if not found
 */
function getVocabFileName(language: string): string | null {
  // Handle special cases
  if (language === 'portuguese') return 'portuguese_generic.json';
  if (language === 'chinese') return 'mandarin.json';

  // Standard mapping
  const fileName = `${language}.json`;
  return LANGUAGE_MAP[fileName] ? fileName : null;
}

/**
 * Get language info from language name
 * @param language - Language name (e.g., "spanish")
 * @returns Language info or null
 */
function getLanguageInfo(language: string): LanguageInfo | null {
  const fileName = getVocabFileName(language);
  if (!fileName) return null;
  return LANGUAGE_MAP[fileName];
}

/**
 * Normalize a field value for duplicate comparison
 * Removes audio markers, trims whitespace, converts to lowercase
 * @param field - Field value to normalize
 * @returns Normalized field value
 */
function normalizeField(field: string | null | undefined): string {
  if (!field || typeof field !== 'string') return '';
  return field
    .replace(/\n\[AUDIO:\d+\]/g, '') // Remove audio markers like [AUDIO:0]
    .trim()                           // Remove leading/trailing whitespace
    .toLowerCase();                   // Case-insensitive comparison
}

/**
 * Generate a duplicate key from a vocabulary card
 * Uses normalized Word + Translation for comparison
 * @param card - Card object (must have cardTypeId === 'vocabulary')
 * @returns Duplicate key or null if invalid card
 */
export function getVocabularyDuplicateKey(card: DuplicateCheckCard | null | undefined): string | null {
  if (!card || card.cardTypeId !== 'vocabulary') {
    return null;
  }

  const fields = card.content?.fields || {};
  const word = normalizeField(fields.Word || '');
  const translation = normalizeField(fields.Translation || '');

  // Both fields must be non-empty for a valid key
  if (!word || !translation) {
    return null;
  }

  return `${word}|${translation}`;
}

/**
 * Build a Set of duplicate keys from existing cards
 * Only processes vocabulary cards
 * @param existingCards - Object mapping cardId to card objects
 * @returns Set of duplicate keys
 */
export function buildDuplicateKeySet(
  existingCards: Record<string, DuplicateCheckCard> | null | undefined
): Set<string> {
  const duplicateKeys = new Set<string>();

  if (!existingCards || typeof existingCards !== 'object') {
    return duplicateKeys;
  }

  Object.values(existingCards).forEach(card => {
    const key = getVocabularyDuplicateKey(card);
    if (key) {
      duplicateKeys.add(key);
    }
  });

  return duplicateKeys;
}

/**
 * Generate a duplicate key from a vocab entry
 * @param vocabEntry - Vocab entry from JSON
 * @returns Duplicate key or null if invalid entry
 */
function getVocabEntryDuplicateKey(vocabEntry: VocabEntry | null | undefined): string | null {
  if (!vocabEntry) {
    return null;
  }

  const word = normalizeField(vocabEntry.word || '');
  const translation = normalizeField(vocabEntry.english_translation || '');

  // Both fields must be non-empty for a valid key
  if (!word || !translation) {
    return null;
  }

  return `${word}|${translation}`;
}

/**
 * Check if a vocab entry would create a duplicate card
 * @param vocabEntry - Vocab entry from JSON
 * @param duplicateKeys - Set of existing duplicate keys
 * @returns True if duplicate, false otherwise
 */
function isVocabEntryDuplicate(
  vocabEntry: VocabEntry | null | undefined,
  duplicateKeys: Set<string> | null | undefined
): boolean {
  if (!vocabEntry || !duplicateKeys || duplicateKeys.size === 0) {
    return false;
  }

  const key = getVocabEntryDuplicateKey(vocabEntry);
  if (!key) {
    return false;
  }

  return duplicateKeys.has(key);
}

/**
 * Transform vocab entry to card format
 * @param vocabEntry - Vocab entry from JSON
 * @param deckId - Deck ID
 * @param languageName - Language display name
 * @returns Card object
 */
function vocabToCard(vocabEntry: VocabEntry, deckId: string, languageName: string): GeneratedVocabCard {
  const now = new Date().toISOString();
  const cardId = 'card-' + generateId();

  // Build tags
  const pos = (vocabEntry.pos || '').toLowerCase();
  const tags = [
    languageName.toLowerCase(),
    pos,
    'frequency',
    vocabEntry.cefr_level || 'unknown'
  ].filter(Boolean);

  return {
    version: '1.0',
    id: cardId,
    deckId: deckId,
    cardTypeId: 'vocabulary',
    createdAt: now,
    updatedAt: now,
    content: {
      fields: {
        Word: vocabEntry.word || '',
        Translation: vocabEntry.english_translation || '',
        Example: vocabEntry.example_sentence_native || '',
        ExampleTranslation: vocabEntry.example_sentence_english || '',
        PartOfSpeech: vocabEntry.pos || '',
        Frequency: vocabEntry.word_frequency != null ? String(vocabEntry.word_frequency) : '',
        CEFRLevel: vocabEntry.cefr_level || ''
      },
      fieldMedia: {
        Word: { images: [], audio: [] },
        Translation: { images: [], audio: [] },
        Example: { images: [], audio: [] },
        ExampleTranslation: { images: [], audio: [] },
        PartOfSpeech: { images: [], audio: [] },
        Frequency: { images: [], audio: [] },
        CEFRLevel: { images: [], audio: [] }
      }
    },
    scheduling: {
      state: 'new',
      interval: 0,
      ease: 2.5,
      dueDate: now,
      lapses: 0,
      stepsIndex: 0
    },
    tags: tags,
    revLog: []
  };
}

/**
 * Generate virtual deck index from quick picks
 * This replaces the prebuilt-decks/index.json
 * @returns Virtual index object
 */
export function generateVirtualDeckIndex(): VirtualDeckIndex {
  const decks = QUICK_PICK_DECKS.map((pick, index) => {
    const langInfo = getLanguageInfo(pick.language);
    if (!langInfo) return null;

    const difficultyTag = pick.difficulty.includes('A') ? 'beginner' :
                          pick.difficulty.includes('B') ? 'intermediate' : 'advanced';

    return {
      id: `virtual-${langInfo.code}-${pick.difficulty.toLowerCase().replace('-', '-')}-${pick.pos}`,
      path: `${pick.language}/${pick.difficulty.toLowerCase()}-${pick.pos}`, // Virtual path for compatibility
      language: pick.language,
      category: 'frequency',
      subcategory: pick.subcategory,
      cardCount: pick.count,
      difficulty: pick.difficulty,
      tags: [pick.pos, 'frequency', difficultyTag, pick.language],
      // Store generation parameters for on-demand generation
      _generateParams: pick,
      _langInfo: langInfo
    };
  }).filter((deck): deck is VirtualDeckEntry => Boolean(deck));

  // Build languages object
  const languages: VirtualDeckIndex['languages'] = {};
  decks.forEach(deck => {
    if (!languages[deck.language]) {
      languages[deck.language] = { count: 0, categories: ['frequency'] };
    }
    languages[deck.language].count++;
  });

  // Build categories object
  const categories: VirtualDeckIndex['categories'] = {
    frequency: { count: decks.length, label: 'By Frequency' }
  };

  return {
    version: '2.0',
    lastUpdated: new Date().toISOString(),
    decks: decks,
    languages: languages,
    categories: categories
  };
}

/**
 * Generate deck cards on-demand from vocab_data
 * @param vocabDataCache - Object mapping file names to vocab data arrays (from vocabLoader)
 * @param params - Generation parameters { language, pos, difficulty, count, name }
 * @param existingCards - Optional object mapping cardId to existing card objects (for duplicate checking)
 * @returns Array of card objects (guaranteed to have count unique cards, or as many as available)
 */
export function generateDeckFromVocab(
  vocabDataCache: VocabDataCache | null | undefined,
  params: GenerateDeckParams,
  existingCards: Record<string, DuplicateCheckCard> | null = null
): GeneratedVocabCard[] {
  if (!vocabDataCache || typeof vocabDataCache !== 'object') {
    console.warn('[VocabDeckGenerator] Vocab data cache not provided or invalid');
    return [];
  }

  const { language, pos, difficulty, count, name } = params;

  try {
    // Get vocab file name
    const fileName = getVocabFileName(language);
    if (!fileName) {
      console.warn(`[VocabDeckGenerator] No vocab file for language: ${language}`);
      return [];
    }

    // Read vocab data from cache
    const vocabData = vocabDataCache[fileName];
    if (!vocabData) {
      console.warn(`[VocabDeckGenerator] Could not read vocab file from cache: ${fileName}`);
      return [];
    }

    // Ensure it's an array
    const vocabArray = Array.isArray(vocabData) ? vocabData : [];
    if (vocabArray.length === 0) {
      console.warn(`[VocabDeckGenerator] Empty vocab data for: ${fileName}`);
      return [];
    }

    // Get CEFR levels for filtering
    // Support both old format (difficulty string like "A1-A2") and new format (selectedLevels array)
    let cefrLevels: string[] = [];
    if (params.selectedLevels && Array.isArray(params.selectedLevels)) {
      // New format: use the array directly
      cefrLevels = params.selectedLevels;
    } else if (difficulty && difficulty.includes(',')) {
      // Comma-separated levels (e.g., "A1,A2,B1")
      cefrLevels = difficulty.split(',').map(l => l.trim());
    } else {
      // Old format: use getCEFRLevels for ranges like "A1-A2"
      cefrLevels = getCEFRLevels(difficulty);
    }

    // Filter by POS, CEFR level, and useful_for_flashcard flag
    let filtered = vocabArray.filter(entry => {
      if (!entry.useful_for_flashcard) return false;

      const entryPos = (entry.pos || '').toLowerCase();
      const matchesPos = entryPos === pos.toLowerCase();

      const entryCefr = entry.cefr_level || '';
      const matchesDifficulty = cefrLevels.length === 0 || cefrLevels.includes(entryCefr);

      return matchesPos && matchesDifficulty;
    });

    // Sort by frequency (ascending - lower number = more frequent/common word)
    filtered.sort((a, b) => {
      const freqA = a.word_frequency != null ? a.word_frequency : Infinity;
      const freqB = b.word_frequency != null ? b.word_frequency : Infinity;
      // Lower frequency number = more common word, so sort ascending
      return freqA - freqB;
    });

    // Build duplicate key set from existing cards if provided
    const existingCardKeys = existingCards ? buildDuplicateKeySet(existingCards) : new Set<string>();
    const hasExistingCards = existingCardKeys.size > 0;

    // Track seen keys from JSON source (to deduplicate JSON duplicates)
    const seenJsonKeys = new Set<string>();

    // Select unique cards, deduplicating on-the-fly from both JSON source and existing cards
    const selected: VocabEntry[] = [];
    let jsonDuplicatesSkipped = 0;
    let existingCardDuplicatesSkipped = 0;

    for (const entry of filtered) {
      // If we have enough cards, stop early
      if (selected.length >= count) {
        break;
      }

      // Generate duplicate key for this entry
      const entryKey = getVocabEntryDuplicateKey(entry);

      // Skip if invalid entry (missing word or translation)
      if (!entryKey) {
        continue;
      }

      // Check for duplicates in JSON source (deduplicate JSON duplicates)
      if (seenJsonKeys.has(entryKey)) {
        jsonDuplicatesSkipped++;
        continue; // Skip this duplicate from JSON
      }

      // Check for duplicates in existing cards (if adding to existing deck)
      if (hasExistingCards && existingCardKeys.has(entryKey)) {
        existingCardDuplicatesSkipped++;
        continue; // Skip this duplicate from existing deck
      }

      // Entry is unique - add it
      seenJsonKeys.add(entryKey);
      selected.push(entry);
    }

    // Log duplicate information if applicable
    if (jsonDuplicatesSkipped > 0 || existingCardDuplicatesSkipped > 0) {
      const parts: string[] = [];
      if (jsonDuplicatesSkipped > 0) {
        parts.push(`${jsonDuplicatesSkipped} JSON duplicate(s)`);
      }
      if (existingCardDuplicatesSkipped > 0) {
        parts.push(`${existingCardDuplicatesSkipped} existing deck duplicate(s)`);
      }
      console.log(
        `[VocabDeckGenerator] Skipped ${parts.join(', ')}, selected ${selected.length} unique card(s)`
      );
    }

    // Warn if we couldn't get the requested count
    if (selected.length < count) {
      const totalSkipped = jsonDuplicatesSkipped + existingCardDuplicatesSkipped;
      const available = filtered.length;
      const requested = count;
      console.warn(
        `[VocabDeckGenerator] Requested ${requested} cards but only ${selected.length} unique cards available ` +
        `(${available} total matching criteria, ${totalSkipped} duplicates skipped)`
      );
    }

    // Get language info for card generation
    const langInfo = getLanguageInfo(language);
    if (!langInfo) {
      console.warn(`[VocabDeckGenerator] No language info for: ${language}`);
      return [];
    }

    // Generate temporary deck ID for card generation
    const tempDeckId = `temp-${langInfo.code}-${difficulty}-${pos}`;

    // Transform to cards
    const cards = selected.map(entry => vocabToCard(entry, tempDeckId, langInfo.displayName));

    return cards;
  } catch (error) {
    console.error(`[VocabDeckGenerator] Error generating deck:`, error);
    return [];
  }
}

/**
 * Generate deck metadata from generation parameters
 * @param deckEntry - Deck entry from virtual index
 * @param cards - Generated cards
 * @returns Deck metadata object
 */
export function generateDeckMetadata(
  deckEntry: VirtualDeckEntry,
  cards: GeneratedVocabCard[]
): GeneratedDeckMetadata | null {
  const { _generateParams, _langInfo } = deckEntry;
  if (!_generateParams || !_langInfo) {
    return null;
  }

  const { name, difficulty, count } = _generateParams;
  const difficultyTag = difficulty.includes('A') ? 'beginner' :
                        difficulty.includes('B') ? 'intermediate' : 'advanced';

  const description = difficulty === 'A1-A2'
    ? `The ${count} most frequently used ${_langInfo.displayName} ${_generateParams.pos}s, perfect for building your vocabulary foundation.`
    : `A curated collection of ${count} ${_langInfo.displayName} ${_generateParams.pos}s at the ${difficulty} level.`;

  const estimatedTime = difficulty === 'A1-A2' ? '3-4 weeks' :
                       difficulty === 'B1-B2' ? '4-6 weeks' : '6-8 weeks';

  return {
    id: deckEntry.id,
    name: name,
    description: description,
    language: _generateParams.language,
    targetLang: _langInfo.code,
    nativeLang: 'en',
    category: 'frequency',
    subcategory: _generateParams.subcategory,
    tags: [ _generateParams.pos, 'frequency', difficultyTag, _generateParams.language ],
    cardCount: cards.length,
    difficulty: difficulty,
    estimatedStudyTime: estimatedTime,
    version: '2.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'system',
    preview: {
      sampleWords: cards.slice(0, 10).map(card => card.content.fields.Word || ''),
      sampleCount: Math.min(10, cards.length)
    }
  };
}

/**
 * Get available languages from virtual index
 * @param index - Virtual index object
 * @returns Array of language names
 */
export function getAvailableLanguages(index: VirtualDeckIndex | null | undefined): string[] {
  if (!index || !index.languages) return [];
  return Object.keys(index.languages).sort();
}

/**
 * Filter decks by language
 * @param decks - Array of deck entries
 * @param language - Language to filter by (null for all)
 * @returns Filtered decks
 */
export function filterDecksByLanguage(
  decks: VirtualDeckEntry[] | null | undefined,
  language: string | null
): VirtualDeckEntry[] {
  if (!decks || !Array.isArray(decks)) return [];
  if (!language) return decks;
  return decks.filter(deck => deck.language === language);
}

/**
 * Search decks by name, description, or tags
 * @param decks - Array of deck entries
 * @param query - Search query
 * @param deckMetadata - Optional metadata map for enhanced search
 * @returns Filtered decks
 */
export function searchDecks(
  decks: VirtualDeckEntry[] | null | undefined,
  query: string,
  deckMetadata: Record<string, GeneratedDeckMetadata> = {}
): VirtualDeckEntry[] {
  if (!decks || !Array.isArray(decks)) return [];
  if (!query || !query.trim()) return decks;

  const lowerQuery = query.toLowerCase().trim();
  return decks.filter(deck => {
    const meta = deckMetadata[deck.id];
    const name = (meta?.name || deck._generateParams?.name || '').toLowerCase();
    const description = (meta?.description || '').toLowerCase();
    const tags = (deck.tags || []).join(' ').toLowerCase();
    const language = (deck.language || '').toLowerCase();

    return name.includes(lowerQuery) ||
           description.includes(lowerQuery) ||
           tags.includes(lowerQuery) ||
           language.includes(lowerQuery);
  });
}
