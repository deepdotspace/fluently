/**
 * Vocabulary Data Loader
 * Loads vocab_data files from GitHub raw URLs (on-demand, no global storage)
 * Follows the same pattern as other widgets in the library (e.g., dataset.js)
 */

import type { VocabEntry } from './dataset';

/**
 * Cache mapping vocab file names to their loaded vocab entry arrays.
 */
export type VocabDataCache = Record<string, VocabEntry[]>;

/**
 * GitHub repository base URL for vocab_data files
 * Uses the same repo structure as dataset.js: language/language.json
 */
const VOCAB_DATA_BASE_URL = 'https://cdn.jsdelivr.net/gh/vbvss199/Language-Learning-decks@main';

/**
 * Map language name to GitHub file path
 * GitHub repo structure: language/language.json (e.g., spanish/spanish.json)
 */
function getLanguageFilePath(language: string): string | null {
  const languageMap: Record<string, string> = {
    'spanish': 'spanish/spanish.json',
    'french': 'french/french.json',
    'german': 'german/german.json',
    'italian': 'italian/italian.json',
    'portuguese': 'portuguese/portuguese.json',
    'russian': 'russian/russian.json',
    'korean': 'korean/korean.json',
    'chinese': 'mandarin/mandarin.json',
    'arabic': 'arabic/arabic.json',
    'hindi': 'hindi/hindi.json'
  };
  return languageMap[language] || null;
}

/**
 * Load a single vocab file from GitHub
 * @param fileName - Name of the vocab file (e.g., 'spanish.json') OR language name (e.g., 'spanish')
 * @returns Vocab data array or null if failed
 */
export async function loadVocabFile(fileName: string): Promise<VocabEntry[] | null> {
  try {
    // If fileName is just a language name (e.g., 'spanish'), convert to file path
    // If it's already a file path (e.g., 'spanish.json'), extract language name
    let language = fileName.replace('.json', '').toLowerCase();

    // Handle special cases
    if (language === 'portuguese_generic') language = 'portuguese';
    if (language === 'mandarin') language = 'chinese';

    const filePath = getLanguageFilePath(language);
    if (!filePath) {
      console.warn(`[VocabLoader] No file path mapping for language: ${language}`);
      return null;
    }

    const url = `${VOCAB_DATA_BASE_URL}/${filePath}`;

    console.log(`[VocabLoader] Loading ${language} from ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[VocabLoader] Failed to load ${language}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json() as unknown;
    if (!Array.isArray(data)) {
      console.warn(`[VocabLoader] Data from ${language} is not an array`);
      return null;
    }

    console.log(`[VocabLoader] ✓ Successfully loaded ${language} with ${data.length} entries`);
    return data as VocabEntry[];
  } catch (error) {
    console.error(`[VocabLoader] Error loading ${fileName}:`, error);
    return null;
  }
}

/**
 * Get vocab file name for a language
 * @param language - Language name (e.g., "spanish", "portuguese")
 * @returns File name or null if not found
 */
export function getVocabFileName(language: string): string | null {
  if (language === 'portuguese') return 'portuguese_generic.json';
  if (language === 'chinese') return 'mandarin.json';

  const fileName = `${language}.json`;
  return fileName;
}
