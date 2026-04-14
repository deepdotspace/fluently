/**
 * Wiktionary Audio Fetcher
 * Fetches pronunciation audio from Wiktionary and resolves to Wikimedia Commons URLs
 */

// Use CORS proxy to bypass CORS restrictions
const CORS_PROXY = 'https://corsproxy.io/?';
const WIKTIONARY_API_BASE = 'https://en.wiktionary.org/w/api.php';
const COMMONS_API_BASE = 'https://commons.wikimedia.org/w/api.php';

/**
 * Fetch wikitext for a term from Wiktionary
 * @param {string} term - The vocabulary term to look up
 * @returns {Promise<string|null>} The wikitext content or null if not found
 */
async function fetchWiktionaryWikitext(term) {
  try {
    const encodedTerm = encodeURIComponent(term);
    const apiUrl = `${WIKTIONARY_API_BASE}?action=parse&page=${encodedTerm}&prop=wikitext&format=json&origin=*`;
    const url = `${CORS_PROXY}${encodeURIComponent(apiUrl)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.warn(`[Wiktionary API] Response not OK for "${term}":`, response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    // Check if page exists and has content
    if (data.error || !data.parse || !data.parse.wikitext || !data.parse.wikitext['*']) {
      return null;
    }
    
    return data.parse.wikitext['*'];
  } catch (error) {
    // Enhanced error logging for debugging iframe/CORS issues
    console.warn(`[Wiktionary API] Failed to fetch wikitext for "${term}":`, error);
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      console.warn(`[Wiktionary API] This may be a CORS or network issue. Check if the iframe allows cross-origin requests.`);
    }
    return null;
  }
}

/**
 * Extract audio filenames from wikitext
 * Looks for audio files in ALL Pronunciation sections (handles multi-language pages)
 * @param {string} wikitext - The wikitext content
 * @returns {string[]} Array of audio filenames (without duplicates)
 */
function extractAudioFilenames(wikitext) {
  if (!wikitext) return [];
  
  const filenames = new Set();
  
  // Find ALL Pronunciation sections (multi-language pages have multiple)
  // Use global flag to find all matches
  const pronunciationRegex = /===?\s*Pronunciation\s*===?([\s\S]*?)(?=\n===?[^=]|$)/gi;
  const pronunciationMatches = [...wikitext.matchAll(pronunciationRegex)];
  
  if (pronunciationMatches.length === 0) {
    return [];
  }
  
  // Process each pronunciation section
  pronunciationMatches.forEach((sectionMatch, sectionIdx) => {
    const pronunciationSection = sectionMatch[1];
  
    // Pattern 1: Direct [[File:filename.ogg]] or [[File:filename.wav]] references
    const filePattern = /\[\[File:([^\]]+\.(ogg|wav|mp3))\]\]/gi;
    let match;
    while ((match = filePattern.exec(pronunciationSection)) !== null) {
      const filename = match[1].trim();
      // Remove any parameters after | (e.g., [[File:name.ogg|thumb|...]])
      const cleanFilename = filename.split('|')[0].trim();
      if (cleanFilename) {
        filenames.add(cleanFilename);
      }
    }
    
    // Pattern 2: Audio files in pronunciation templates
    // Examples: 
    //   {{es-pr|a=LL-Q143 (epo)-Lepticed7-ministerio.wav}}
    //   {{es-pr|+<audio:LL-Q1321 (spa)-Millars-perro.wav<a:Spain>>}}
    //   {{eo-pr|a=FILENAME.wav}}, {{audio|FILENAME.ogg|lang=es}}
    // Note: Filenames can contain spaces, parentheses, and hyphens (e.g., "LL-Q1321 (spa)-Millars-perro.wav")
    const templatePatterns = [
      // Match audio: prefix followed by filename with extension
      // Handles both <audio:...> and escaped unicode \u003Caudio:...\u003C
      // Captures everything after "audio:" until we hit < or > or end of valid filename chars
      /audio:([A-Za-z0-9_\-\(\)\s]+\.(ogg|wav|mp3))/gi,
      // Match {{template|a=FILENAME.ext}} - captures filename with spaces/parentheses
      // Uses greedy match to capture full filename until extension
      /\{\{[^|}]+\|a=([^\|}]+\.(ogg|wav|mp3))/gi,
      // Match {{audio|FILENAME.ext|...}}
      /\{\{audio\|([^\|}]+\.(ogg|wav|mp3))/gi,
      // Match {{template|FILENAME.ext|...}} (fallback for other template formats)
      /\{\{[^|}]+\|([^\|}]+\.(ogg|wav|mp3))/gi
    ];
    
    templatePatterns.forEach((pattern, idx) => {
      pattern.lastIndex = 0; // Reset regex state
      while ((match = pattern.exec(pronunciationSection)) !== null) {
        const filename = match[1].trim();
        // Remove any trailing template characters that might have been captured
        // Handle both template syntax (|, }) and HTML-like tags (<, >)
        const cleanFilename = filename.split('|')[0].split('}')[0].split('<')[0].split('>')[0].trim();
        if (cleanFilename && (cleanFilename.endsWith('.ogg') || cleanFilename.endsWith('.wav') || cleanFilename.endsWith('.mp3'))) {
          filenames.add(cleanFilename);
        }
      }
    });
    
    // Pattern 3: Look for audio file references in any format
    // This catches variations like "LL-Q1321 (spa)-Millars-perro.wav"
    const loosePattern = /([A-Za-z0-9_\-\(\)\s]+\.(ogg|wav|mp3))/g;
    while ((match = loosePattern.exec(pronunciationSection)) !== null) {
      const filename = match[1].trim();
      // Filter out common false positives
      if (filename.length > 5 && !filename.includes('http') && !filename.includes('www')) {
        filenames.add(filename);
      }
    }
  }); // End of forEach for pronunciation sections
  
  return Array.from(filenames);
}

/**
 * Resolve an audio filename to a direct Wikimedia Commons URL
 * @param {string} filename - The audio filename
 * @returns {Promise<string|null>} The direct audio URL or null if not found
 */
async function resolveCommonsAudioUrl(filename) {
  try {
    const encodedFilename = encodeURIComponent(filename);
    const apiUrl = `${COMMONS_API_BASE}?action=query&titles=File:${encodedFilename}&prop=imageinfo&iiprop=url&format=json&origin=*`;
    const url = `${CORS_PROXY}${encodeURIComponent(apiUrl)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.warn(`[Commons API] Response not OK for "${filename}":`, response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    // Check if query and pages exist
    if (!data.query || !data.query.pages) {
      return null;
    }
    
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];
    
    // Check if file is missing (missing files have "missing": "" field and no imageinfo)
    // Missing files: {"-1": {"missing": "", "imagerepository": ""}}
    // Existing files: {"85339459": {"pageid": 85339459, "imageinfo": [...]}}
    if (page.missing !== undefined || !page.imageinfo || page.imageinfo.length === 0) {
      return null;
    }
    
    // Extract the audio URL from imageinfo
    const imageInfo = page.imageinfo[0];
    const audioUrl = imageInfo.url;
    
    // Validate URL is from upload.wikimedia.org (as per API response structure)
    if (!audioUrl || !audioUrl.startsWith('https://upload.wikimedia.org/')) {
      return null;
    }
    
    return audioUrl;
  } catch (error) {
    console.warn(`[Commons API] Failed to resolve audio URL for "${filename}":`, error);
    return null;
  }
}

/**
 * Get pronunciation audio URL for a vocabulary term
 * @param {string} term - The vocabulary term
 * @param {string} language - Optional language hint for preference
 * @returns {Promise<{source: string, url: string}|null>} Audio object or null if not found
 */
export async function getWiktionaryAudio(term, language = null) {
  if (!term || !term.trim()) {
    return null;
  }
  
  const trimmedTerm = term.trim();
  
  try {
    // Fetch wikitext
    const wikitext = await fetchWiktionaryWikitext(trimmedTerm);
    if (!wikitext) {
      return null;
    }
    
    // Extract audio filenames
    const audioFilenames = extractAudioFilenames(wikitext);
    if (audioFilenames.length === 0) {
      return null;
    }
    
    // Try to resolve each filename to a Commons URL
    // Prefer files that might match the language (simple heuristic)
    const sortedFilenames = [...audioFilenames];
    if (language) {
      // Simple language matching: if language is Spanish, prefer files with "spa" or "es"
      const langLower = language.toLowerCase();
      const langCodes = {
        'spanish': ['spa', 'es'],
        'french': ['fra', 'fr'],
        'german': ['deu', 'de'],
        'italian': ['ita', 'it'],
        'portuguese': ['por', 'pt'],
        'russian': ['rus', 'ru'],
        'japanese': ['jpn', 'ja'],
        'korean': ['kor', 'ko'],
        'mandarin': ['cmn', 'zh'],
        'arabic': ['ara', 'ar'],
        'hindi': ['hin', 'hi'],
        'esperanto': ['epo', 'eo']
      };
      
      const codes = langCodes[langLower] || [];
      sortedFilenames.sort((a, b) => {
        const aMatches = codes.some(code => a.toLowerCase().includes(code.toLowerCase()));
        const bMatches = codes.some(code => b.toLowerCase().includes(code.toLowerCase()));
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
        return 0;
      });
    }
    
    // Try each filename until we find a valid URL
    for (let i = 0; i < sortedFilenames.length; i++) {
      const filename = sortedFilenames[i];
      const audioUrl = await resolveCommonsAudioUrl(filename);
      if (audioUrl) {
        return {
          source: 'wikimedia_commons',
          url: audioUrl
        };
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`[Wiktionary Audio] Error fetching audio for "${trimmedTerm}":`, error);
    return null;
  }
}

