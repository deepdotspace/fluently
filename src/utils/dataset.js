/**
 * Dataset Loading and Management
 * Loads vocabulary data from GitHub repository
 */

/**
 * Language to GitHub raw URL mapping
 */
const LANGUAGE_FILE_MAP = {
  'Spanish': 'spanish/spanish.json',
  'French': 'french/french.json',
  'Japanese (Kanji)': 'japanese/kanji.json',
  'Japanese (Hiragana)': 'japanese/hiragana.json',
  'Japanese (Katakana)': 'japanese/katakana.json',
  'German': 'german/german.json',
  'Italian': 'italian/italian.json',
  'Portuguese': 'portuguese/portuguese.json',
  'Korean': 'korean/korean.json',
  'Mandarin': 'mandarin/mandarin.json',
  'Arabic': 'arabic/arabic.json',
  'Russian': 'russian/russian.json',
  'Hindi': 'hindi/hindi.json',
  'English': 'english/english.json'
};

/**
 * Supported languages
 */
export const SUPPORTED_LANGUAGES = [
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Russian',
  'Japanese (Kanji)',
  'Japanese (Hiragana)',
  'Japanese (Katakana)',
  'Korean',
  'Mandarin',
  'Arabic',
  'Hindi',
  'English'
];

/**
 * CEFR levels
 */
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * Part of speech options
 */
export const POS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'noun', label: 'Noun' },
  { value: 'verb', label: 'Verb' },
  { value: 'adjective', label: 'Adjective' },
  { value: 'adverb', label: 'Adverb' },
  { value: 'pronoun', label: 'Pronoun' },
  { value: 'preposition', label: 'Preposition' },
  { value: 'conjunction', label: 'Conjunction' },
  { value: 'interjection', label: 'Interjection' }
];

/**
 * Dataset base URL - publicly accessible GitHub repository
 */
const DATASET_BASE_URL = 'https://cdn.jsdelivr.net/gh/vbvss199/Language-Learning-decks@main';

/**
 * Load dataset for a language
 * @param {string} language - Language name
 * @returns {Promise<Array>} Dataset array
 */
export async function loadDataset(language) {
  const filePath = LANGUAGE_FILE_MAP[language];
  if (!filePath) {
    throw new Error(`No dataset file for language: ${language}`);
  }
  
  try {
    const url = `${DATASET_BASE_URL}/${filePath}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${filePath}: ${response.status} ${response.statusText}`);
    }
    
    const dataset = await response.json();
    
    return dataset;
  } catch (error) {
    console.error('[DATASET] Loading error:', error);
    throw error;
  }
}

/**
 * Filter dataset by criteria
 * @param {Array} dataset - Full dataset
 * @param {Object} filters - Filter criteria
 * @param {Set} excludeWords - Set of words to exclude (optional)
 * @returns {Array} Filtered dataset
 */
export function filterDataset(dataset, filters = {}, excludeWords = null) {
  let filtered = [...dataset];

  // Filter by CEFR levels
  if (filters.cefrLevels && filters.cefrLevels.length > 0) {
    filtered = filtered.filter(entry =>
      filters.cefrLevels.includes(entry.cefr_level)
    );
  }

  // Filter by part of speech
  if (filters.pos && filters.pos !== 'all') {
    filtered = filtered.filter(entry =>
      entry.pos && entry.pos.toLowerCase() === filters.pos.toLowerCase()
    );
  }

  // Filter by search query
  if (filters.search && filters.search.trim()) {
    const searchLower = filters.search.toLowerCase().trim();
    filtered = filtered.filter(entry =>
      (entry.word && entry.word.toLowerCase().includes(searchLower)) ||
      (entry.english_translation && entry.english_translation.toLowerCase().includes(searchLower))
    );
  }

  // Filter by useful_for_flashcard
  if (filters.usefulOnly) {
    filtered = filtered.filter(entry => entry.useful_for_flashcard === true);
  }

  // Exclude words that already have cards
  if (excludeWords && excludeWords.size > 0) {
    filtered = filtered.filter(entry => {
      const word = entry.word.toLowerCase().trim();
      return !excludeWords.has(word);
    });
  }

  return filtered;
}

/**
 * Sort dataset
 * @param {Array} dataset - Dataset to sort
 * @param {string} sortBy - Sort criteria ('frequency', 'alphabetical')
 * @returns {Array} Sorted dataset
 */
export function sortDataset(dataset, sortBy = 'frequency') {
  const sorted = [...dataset];
  
  switch (sortBy) {
    case 'frequency':
      // Lower frequency number = more common
      return sorted.sort((a, b) => (a.word_frequency || 999999) - (b.word_frequency || 999999));
    
    case 'alphabetical':
      return sorted.sort((a, b) => {
        const wordA = (a.word || '').toLowerCase();
        const wordB = (b.word || '').toLowerCase();
        return wordA.localeCompare(wordB);
      });
    
    default:
      return sorted;
  }
}

/**
 * Paginate dataset
 * @param {Array} dataset - Dataset to paginate
 * @param {number} page - Page number (1-indexed)
 * @param {number} pageSize - Items per page
 * @returns {Object} Pagination result
 */
export function paginateDataset(dataset, page = 1, pageSize = 50) {
  const totalItems = dataset.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  
  return {
    items: dataset.slice(startIndex, endIndex),
    currentPage,
    totalPages,
    totalItems,
    startIndex: startIndex + 1,
    endIndex,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1
  };
}

/**
 * Get word by ID (word text)
 * @param {Array} dataset - Dataset
 * @param {string} wordId - Word text
 * @returns {Object|null} Word entry
 */
export function getWordById(dataset, wordId) {
  return dataset.find(entry => entry.word === wordId) || null;
}

/**
 * Get multiple words by IDs
 * @param {Array} dataset - Dataset
 * @param {Array} wordIds - Array of word texts
 * @returns {Array} Array of word entries
 */
export function getWordsByIds(dataset, wordIds) {
  return wordIds
    .map(id => getWordById(dataset, id))
    .filter(word => word !== null);
}

