/**
 * Vocabulary Data Loader
 * Loads vocab_data files from GitHub raw URLs (on-demand, no global storage)
 * Follows the same pattern as other widgets in the library (e.g., dataset.js)
 */

/**
 * GitHub repository base URL for vocab_data files
 * Uses the same repo structure as dataset.js: language/language.json
 */
const VOCAB_DATA_BASE_URL = 'https://cdn.jsdelivr.net/gh/vbvss199/Language-Learning-decks@main';

/**
 * Map language name to GitHub file path
 * GitHub repo structure: language/language.json (e.g., spanish/spanish.json)
 */
function getLanguageFilePath(language) {  
  const languageMap = {
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
 * @param {string} fileName - Name of the vocab file (e.g., 'spanish.json') OR language name (e.g., 'spanish')
 * @returns {Promise<Array|null>} Vocab data array or null if failed
 */
export async function loadVocabFile(fileName) {
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
    
    const data = await response.json();
    if (!Array.isArray(data)) {
      console.warn(`[VocabLoader] Data from ${language} is not an array`);
      return null;
    }
    
    console.log(`[VocabLoader] ✓ Successfully loaded ${language} with ${data.length} entries`);
    return data;
  } catch (error) {
    console.error(`[VocabLoader] Error loading ${fileName}:`, error);
    return null;
  }
}

/**
 * Load all vocab files for available languages
 * @param {Array<string>} languages - Optional array of language names to load
 * @returns {Promise<Object>} Object mapping file names to vocab data arrays
 */
export async function loadAllVocabData(languages = null) {
  const defaultLanguages = [
    'spanish', 'french', 'german', 'italian', 'portuguese',
    'russian', 'korean', 'chinese', 'arabic', 'hindi'
  ];
  
  const languagesToLoad = languages || defaultLanguages;
  const cache = {};
  
  // Map language names to file names
  const languageToFile = {
    'spanish': 'spanish.json',
    'french': 'french.json',
    'german': 'german.json',
    'italian': 'italian.json',
    'portuguese': 'portuguese_generic.json',
    'russian': 'russian.json',
    'korean': 'korean.json',
    'chinese': 'mandarin.json',
    'arabic': 'arabic.json',
    'hindi': 'hindi.json'
  };
  
  // Load all files in parallel
  const loadPromises = languagesToLoad.map(async (lang) => {
    const fileName = languageToFile[lang];
    if (!fileName) return;
    
    const data = await loadVocabFile(fileName);
    if (data) {
      cache[fileName] = data;
    }
  });
  
  await Promise.all(loadPromises);
  
  return cache;
}

/**
 * Get vocab file name for a language
 * @param {string} language - Language name (e.g., "spanish", "portuguese")
 * @returns {string|null} File name or null if not found
 */
export function getVocabFileName(language) {
  if (language === 'portuguese') return 'portuguese_generic.json';
  if (language === 'chinese') return 'mandarin.json';
  
  const fileName = `${language}.json`;
  return fileName;
}
