import { saveMedia } from './mediaStorage';
import { saveCard } from './cardStorage';
import { generateId } from './storage';
import { generateTemplateFromFields } from './fieldSystem.js';

// Prefer unpkg (more reliable here) and a slightly older sql.js that serves correct MIME
const JSZIP_CDN = 'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js';
const SQLJS_CDN = 'https://unpkg.com/sql.js@1.8.0/dist/sql-wasm.js';
const SQLJS_WASM = 'https://unpkg.com/sql.js@1.8.0/dist/sql-wasm.wasm';
// anki-reader CDN fallback removed due to 404/MIME issues

// ---------------------------------------------------------------------------
// External loaders (CDN based to avoid local dependency installs)
// ---------------------------------------------------------------------------

const scriptCache = new Map();

function loadScriptOnce(url) {
  if (scriptCache.has(url)) return scriptCache.get(url);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
  scriptCache.set(url, promise);
  return promise;
}

// Helper to wait for a global variable to be available after script load
function waitForGlobal(varName, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (window[varName]) {
      resolve(window[varName]);
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (window[varName]) {
        clearInterval(checkInterval);
        resolve(window[varName]);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error(`Timeout waiting for ${varName} (${timeout}ms)`));
      }
    }, 50);
  });
}

async function loadJSZip() {
  if (window.JSZip) return window.JSZip;
  await loadScriptOnce(JSZIP_CDN);
  return await waitForGlobal('JSZip', 5000);
}

async function loadSqlJs() {
  if (window.initSqlJs) {
    return window.initSqlJs({ locateFile: () => SQLJS_WASM });
  }
  await loadScriptOnce(SQLJS_CDN);
  const initSqlJs = await waitForGlobal('initSqlJs', 5000);
  return initSqlJs({ locateFile: () => SQLJS_WASM });
}

async function loadAnkiReader() {
  if (window.AnkiReader) return window.AnkiReader;
  await loadScriptOnce(ANKI_READER_CDN);
  return await waitForGlobal('AnkiReader', 5000);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeId(name, prefix) {
  const base = (name || 'unnamed')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const random = generateId();
  return `${prefix}-${base || 'item'}-${random}`;
}

function splitFields(raw) {
  if (!raw) return [];
  return raw.split('\u001f'); // 0x1f separator in Anki
}

function mapTags(raw) {
  if (!raw) return [];
  return raw
    .split(' ')
    .map(t => t.trim())
    .filter(Boolean);
}

function getCardScheduling(ankiCard, mode = 'reset') {
  const now = new Date();
  if (mode === 'preserve' && ankiCard) {
    const intervalDays = ankiCard.ivl || 0;
    const ease = (ankiCard.factor || 2500) / 1000;
    const dueDate = ankiCard.due
      ? new Date(now.getTime() + intervalDays * 86400000)
      : now;
    const queueState = (() => {
      if (ankiCard.queue === 0) return 'new';
      if (ankiCard.queue === 1) return 'learning';
      return 'review';
    })();
    return {
      state: queueState,
      interval: intervalDays,
      ease: Math.max(1.3, Math.min(3.0, ease)),
      dueDate: dueDate.toISOString(),
      lapses: ankiCard.lapses || 0,
      stepsIndex: 0
    };
  }

  return {
    state: 'new',
    interval: 0,
    ease: 2.5,
    dueDate: now.toISOString(),
    lapses: 0,
    stepsIndex: 0
  };
}

// Replace media references in HTML fields with placeholders and save media files.
async function processFieldMedia({ fieldValue, fieldName, mediaLookup, mediaMutations, mediaRecords, fieldMedia }) {
  if (!fieldValue) return { value: fieldValue, fieldMedia };
  let updated = fieldValue;
  const mediaEntry = fieldMedia[fieldName] || { images: [], audio: [] };

  // Handle <img src="...">
  const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(fieldValue)) !== null) {
    const src = imgMatch[1];
    const mediaBlob = mediaLookup[src];
    if (mediaBlob && mediaMutations) {
      try {
        const mediaId = await saveMedia(mediaMutations, mediaRecords, mediaBlob, 'image');
        const placeholder = `[IMAGE:${mediaEntry.images.length}]`;
        mediaEntry.images.push(`media:image:${mediaId}`);
        updated = updated.replace(src, placeholder);
      } catch (err) {
        console.error('Failed to import image media', src, err);
      }
    }
  }

  // Handle [sound:filename]
  const soundRegex = /\[sound:([^\]]+)\]/gi;
  let soundMatch;
  while ((soundMatch = soundRegex.exec(fieldValue)) !== null) {
    const soundName = soundMatch[1];
    const mediaBlob = mediaLookup[soundName];
    if (mediaBlob && mediaMutations) {
      try {
        const mediaId = await saveMedia(mediaMutations, mediaRecords, mediaBlob, 'audio');
        const placeholder = `[AUDIO:${mediaEntry.audio.length}]`;
        mediaEntry.audio.push(`media:audio:${mediaId}`);
        updated = updated.replace(soundMatch[0], placeholder);
      } catch (err) {
        console.error('Failed to import audio media', soundName, err);
      }
    }
  }

  fieldMedia[fieldName] = mediaEntry;
  return { value: updated, fieldMedia };
}

// ---------------------------------------------------------------------------
// Main parsing entry
// ---------------------------------------------------------------------------

// Helper to detect MIME type from filename
function getMimeTypeFromFilename(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mimeMap = {
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'oga': 'audio/ogg',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',
    'flac': 'audio/flac',
    'wma': 'audio/x-ms-wma',
    // Images
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp'
  };
  return mimeMap[ext] || 'application/octet-stream';
}

export async function parseApkgFile(file) {
  // Primary: local JSZip + sql.js
  try {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(file);

    const mediaMapEntry = zip.file('media');
    const mediaMap = mediaMapEntry ? JSON.parse(await mediaMapEntry.async('string')) : {};

    // Build lookup of original media names -> Blob with correct MIME type
    const mediaLookup = {};
    await Promise.all(
      Object.keys(mediaMap || {}).map(async (key) => {
        const fileName = mediaMap[key];
        const zipFile = zip.file(key);
        if (zipFile) {
          // Extract as array buffer first, then create blob with correct MIME type
          const arrayBuffer = await zipFile.async('arraybuffer');
          const mimeType = getMimeTypeFromFilename(fileName);
          mediaLookup[fileName] = new Blob([arrayBuffer], { type: mimeType });
        }
      })
    );

    const collectionFile = zip.file('collection.anki2');
    if (!collectionFile) {
      throw new Error('Missing collection.anki2 in .apkg');
    }
    const collectionBuffer = await collectionFile.async('uint8array');

    const SQL = await loadSqlJs();
    const db = new SQL.Database(collectionBuffer);

    const queryAll = (sql) => {
      const stmt = db.prepare(sql);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    };

    const colRow = queryAll('SELECT * FROM col LIMIT 1')[0] || {};
    const models = colRow.models ? JSON.parse(colRow.models) : {};
    const decks = colRow.decks ? JSON.parse(colRow.decks) : {};
    const notes = queryAll('SELECT id, guid, mid, flds, tags FROM notes');
    const cards = queryAll('SELECT id, nid, did, ord, ivl, due, factor, reps, lapses, queue, type FROM cards');

    return { models, decks, notes, cards, mediaLookup };
  } catch (primaryError) {
    console.warn('Primary Anki parse failed, falling back to anki-reader', primaryError);
  }

  // Fallback: anki-reader (bundles sql.js/JSZip internally)
  const AnkiReader = await loadAnkiReader();
  try {
    const { collection, media } = await AnkiReader.readAnkiPackage(file);

    // Build media lookup
    const mediaLookup = {};
    for (const [name, blob] of Object.entries(media || {})) {
      mediaLookup[name] = blob;
    }

    // Extract raw objects from collection
    const raw = collection.getRawCollection ? collection.getRawCollection() : null;
    const models = raw?.models || {};
    const decks = raw?.decks || {};
    const notes = raw?.notes || [];
    const cards = raw?.cards || [];

    if (!raw) {
      console.warn('anki-reader: getRawCollection unavailable, attempting deck/card expansion');
      // Best-effort extraction if API differs
      const decksMap = collection.getDecks ? collection.getDecks() : {};
      const cardsArr = [];
      Object.values(decksMap || {}).forEach((deck) => {
        const deckCards = deck.getCards ? deck.getCards() : {};
        Object.values(deckCards || {}).forEach((c) => cardsArr.push(c.getRawCard ? c.getRawCard() : c));
      });
      return {
        models: collection.getModels ? collection.getModels() : {},
        decks: decksMap,
        notes: collection.getNotes ? collection.getNotes() : [],
        cards: cardsArr,
        mediaLookup
      };
    }

    return { models, decks, notes, cards, mediaLookup };
  } catch (fallbackError) {
    console.error('Failed to parse Anki package via fallback anki-reader', fallbackError);
    throw new Error(fallbackError?.message || 'Failed to parse Anki package');
  }
}

// ---------------------------------------------------------------------------
// Mapping to local structures
// ---------------------------------------------------------------------------

/**
 * Extract all field names from Anki templates
 * Parses {{FieldName}} references from qfmt and afmt
 */
function extractFieldsFromAnkiTemplates(templates) {
  if (!Array.isArray(templates) || templates.length === 0) {
    return { all: new Set(), front: new Set(), back: new Set() };
  }

  const allFields = new Set();
  const frontFields = new Set();
  const backFields = new Set();

  templates.forEach(tmpl => {
    // Extract from front template (qfmt)
    // Use [^}]+ to match field names with spaces and special characters (like "Anki#", "Definición Primaria")
    if (tmpl.qfmt) {
      const qfmtMatches = tmpl.qfmt.matchAll(/\{\{[#^/]?([^}]+)\}\}/g);
      for (const match of qfmtMatches) {
        const fieldName = match[1].trim();
        if (fieldName !== 'FrontSide') {
          allFields.add(fieldName);
          frontFields.add(fieldName);
        }
      }
    }

    // Extract from back template (afmt)
    // Use [^}]+ to match field names with spaces and special characters
    if (tmpl.afmt) {
      const afmtMatches = tmpl.afmt.matchAll(/\{\{[#^/]?([^}]+)\}\}/g);
      for (const match of afmtMatches) {
        const fieldName = match[1].trim();
        if (fieldName !== 'FrontSide') {
          allFields.add(fieldName);
          backFields.add(fieldName);
        }
      }
    }
  });

  return { all: allFields, front: frontFields, back: backFields };
}

/**
 * Determine field sides based on template usage
 * Returns a map of field name -> side ('front', 'back', or 'both')
 */
function determineFieldSides(model) {
  const templateFields = extractFieldsFromAnkiTemplates(model.tmpls || []);
  const fieldSides = {};

  // For each field in the model, determine its side based on template usage
  (model.flds || []).forEach(field => {
    const name = field.name;
    if (!name) return;

    const inFront = templateFields.front.has(name);
    const inBack = templateFields.back.has(name);

    if (inFront && inBack) {
      fieldSides[name] = 'both';
    } else if (inFront) {
      fieldSides[name] = 'front';
    } else if (inBack) {
      fieldSides[name] = 'back';
    } else {
      // Field not referenced in templates, default to back
      fieldSides[name] = 'back';
    }
  });

  return fieldSides;
}

/**
 * Validate Anki model structure
 */
function validateAnkiModel(model) {
  const errors = [];

  if (!model) {
    errors.push('Model is null or undefined');
    return { valid: false, errors };
  }

  if (!model.name) {
    errors.push('Model missing name');
  }

  if (!Array.isArray(model.flds)) {
    errors.push('Model.flds is not an array');
  } else {
    model.flds.forEach((field, idx) => {
      if (!field || typeof field !== 'object') {
        errors.push(`Field ${idx} is not an object`);
      } else if (!field.name || typeof field.name !== 'string') {
        errors.push(`Field ${idx} missing or invalid name: ${JSON.stringify(field)}`);
      }
    });
  }

  if (!Array.isArray(model.tmpls) || model.tmpls.length === 0) {
    errors.push('Model.tmpls is not an array or is empty');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function mapAnkiModelToCardType(model) {
  if (!model) {
    console.error('[Anki Import] Model is null or undefined');
    return null;
  }

  // Validate model structure
  const validation = validateAnkiModel(model);
  if (!validation.valid) {
    console.error('[Anki Import] Invalid model structure:', validation.errors);
    console.error('[Anki Import] Model data:', model);
    // Try to continue with best effort
  }

  const id = sanitizeId(model.name || 'model', 'anki-type');

  // Extract fields from templates to ensure we capture all referenced fields
  const templateFields = extractFieldsFromAnkiTemplates(model.tmpls || []);

  // Determine field sides based on template usage
  const fieldSides = determineFieldSides(model);

  // Build fields array from model.flds
  const fields = [];
  if (Array.isArray(model.flds)) {
    model.flds.forEach((f, idx) => {
      const fieldName = f.name || `Field${idx + 1}`;

      // Warn if field name is missing
      if (!f.name) {
        console.warn(`[Anki Import] Field ${idx} missing name, using fallback: ${fieldName}`);
      }

      fields.push({
        name: fieldName,
        side: fieldSides[fieldName] || (idx === 0 ? 'front' : 'back'),
        order: typeof f.ord === 'number' ? f.ord : idx,
        required: idx === 0 // First field is typically required
      });
    });
  }

  // Check if all template-referenced fields exist in model.flds
  templateFields.all.forEach(fieldName => {
    const exists = fields.some(f => f.name === fieldName);
    if (!exists) {
      console.warn(`[Anki Import] Template references field "${fieldName}" but it's not in model.flds`);
      // Add missing field to fields array
      fields.push({
        name: fieldName,
        side: fieldSides[fieldName] || 'back',
        order: fields.length,
        required: false
      });
    }
  });

  // Sort fields by order
  fields.sort((a, b) => (a.order || 0) - (b.order || 0));

  const reversible = Array.isArray(model.tmpls) && model.tmpls.length === 2;
  const isCloze = model.type === 1;

  // Generate clean templates instead of using Anki's original HTML
  // This ensures proper rendering of fields with spaces/unicode characters
  const generatedTemplates = generateTemplateFromFields(fields);

  // Log field extraction for debugging
  console.log(`[Anki Import] Model "${model.name}": Generated clean templates for ${fields.length} fields`,
    fields.map(f => `${f.name}(${f.side})`));

  return {
    id,
    name: model.name || 'Anki Import Type',
    fields,
    fieldMetadata: fields.reduce((acc, f) => ({
      ...acc,
      [f.name]: {
        required: f.required,
        side: f.side,
        order: f.order
      }
    }), {}),
    reversible,
    isCloze,
    // Use generated templates instead of Anki's original templates
    frontTemplate: generatedTemplates.frontTemplate,
    backTemplate: generatedTemplates.backTemplate,
    css: generatedTemplates.css
  };
}

export async function mapAnkiNoteToCards({
  note,
  model,
  ankiCardsByOrd,
  deckId,
  deckName,
  cardTypeId,
  schedulingMode = 'reset',
  mediaMutations,
  mediaRecords,
  mediaLookup
}) {
  if (!note || !model) {
    console.error('[Anki Import] mapAnkiNoteToCards: note or model is null');
    return [];
  }

  // Split field values from note
  const fieldValues = splitFields(note.flds);

  // Extract field names from model
  const fieldNames = (model.flds || []).map(f => f.name).filter(Boolean);

  // Validate field count matches
  if (fieldValues.length !== fieldNames.length) {
    console.warn(
      `[Anki Import] Field count mismatch for note ${note.id}: ` +
      `Expected ${fieldNames.length} fields (${fieldNames.join(', ')}), ` +
      `got ${fieldValues.length} values. ` +
      `Note model: ${model.name}`
    );

    // Log the actual values for debugging
    console.warn('[Anki Import] Field values:', fieldValues);
    console.warn('[Anki Import] Field names:', fieldNames);
  }

  // Build fields object, mapping by index
  const fieldsObject = {};
  fieldNames.forEach((name, idx) => {
    if (!name) {
      console.warn(`[Anki Import] Field name at index ${idx} is empty or undefined`);
      return;
    }

    // Use the value at the corresponding index, or empty string if missing
    const value = idx < fieldValues.length ? (fieldValues[idx] || '') : '';
    fieldsObject[name] = value;

    // Log empty or missing fields for debugging
    if (!value && idx < fieldValues.length) {
      console.log(`[Anki Import] Field "${name}" is empty in note ${note.id}`);
    } else if (idx >= fieldValues.length) {
      console.warn(`[Anki Import] Field "${name}" has no corresponding value in note ${note.id}`);
    }
  });

  // Process media for each field
  const fieldMedia = {};
  const processedFields = {};
  for (const name of fieldNames) {
    if (!name) continue;

    try {
      const processed = await processFieldMedia({
        fieldValue: fieldsObject[name],
        fieldName: name,
        mediaLookup,
        mediaMutations,
        mediaRecords,
        fieldMedia
      });
      processedFields[name] = processed.value;
    } catch (err) {
      console.error(`[Anki Import] Error processing media for field "${name}":`, err);
      // Use unprocessed value as fallback
      processedFields[name] = fieldsObject[name] || '';
    }
  }

  // Generate cards from templates
  const cards = [];
  (model.tmpls || []).forEach((tmpl) => {
    const ord = typeof tmpl.ord === 'number' ? tmpl.ord : 0;
    const scheduling = getCardScheduling(ankiCardsByOrd[ord], schedulingMode);
    const cardId = `card-${generateId()}`;

    cards.push({
      id: cardId,
      deckId,
      // Prefer the mapped card type id (sanitized), fall back to the model id
      cardTypeId: cardTypeId || model.id,
      content: {
        fields: processedFields,
        fieldMedia
      },
      tags: mapTags(note.tags),
      scheduling,
      revLog: [],
      metadata: {
        source: 'anki-import',
        noteId: note.id,
        modelName: model.name,
        deckName
      }
    });
  });

  return cards;
}

export async function importApkg({
  file,
  cardMutations,
  mediaMutations,
  mediaRecords,
  existingCardTypes,
  decksState,
  deckMutations,
  schedulingMode = 'reset',
  targetLang = 'en',
  nativeLang = 'en'
}) {
  const parsed = await parseApkgFile(file);
  const { models, decks, notes, cards, mediaLookup } = parsed;

  // Map models to card types, merging by name if similar
  const cardTypesToAdd = {};
  // Track mapping from original Anki model id -> resolved cardTypeId used for cards
  const modelIdToCardTypeId = {};
  Object.values(models || {}).forEach((model) => {
    const mapped = mapAnkiModelToCardType(model);
    if (!mapped) return;
    // Avoid duplicate names
    const existing = Object.values(existingCardTypes || {}).find(ct => ct.name === mapped.name);
    const resolvedId = existing ? existing.id : mapped.id;
    mapped.id = resolvedId;
    cardTypesToAdd[resolvedId] = mapped;
    // Store mapping so cards created from this model use the sanitized/merged id
    modelIdToCardTypeId[model.id] = resolvedId;
  });

  // Prepare deck mapping Anki did -> new deckId
  const deckIdMap = {};
  const updatedDecks = { ...(decksState || {}) };
  Object.values(decks || {}).forEach((deck) => {
    const deckName = deck.name || 'Imported Deck';
    const existing = Object.values(updatedDecks).find(d => d.name === deckName);
    const deckId = existing ? existing.id : sanitizeId(deckName, 'deck');
    deckIdMap[deck.id] = deckId;
    if (!existing) {
      updatedDecks[deckId] = {
        id: deckId,
        name: deckName,
        targetLang,
        nativeLang,
        designId: null,
        settingsOverride: null,
        cardCounts: { new: 0, learning: 0, review: 0 },
        lastStudiedAt: null
      };
    }
  });

  // Group cards by note
  const cardsByNote = {};
  cards.forEach((c) => {
    if (!cardsByNote[c.nid]) cardsByNote[c.nid] = {};
    cardsByNote[c.nid][c.ord] = c;
  });

  // Generate card objects
  const createdCards = [];
  for (const note of notes) {
    const model = models[note.mid];
    if (!model) continue;
    const deckId = deckIdMap[(cardsByNote[note.id] && Object.values(cardsByNote[note.id])[0]?.did) || Object.keys(deckIdMap)[0]];
    const deckName = Object.values(decks).find(d => d.id === deckId)?.name || 'Imported Deck';
    const resolvedCardTypeId = modelIdToCardTypeId[model.id] || model.id;
    const cardList = await mapAnkiNoteToCards({
      note,
      model,
      ankiCardsByOrd: cardsByNote[note.id] || {},
      deckId,
      deckName,
      cardTypeId: resolvedCardTypeId,
      schedulingMode,
      mediaMutations,
      mediaRecords,
      mediaLookup
    });
    createdCards.push(...cardList);
  }

  // Save cards via mutations with batching for large imports
  const BATCH_SIZE = 100;
  const totalCards = createdCards.length;

  console.log(`[Anki Import] Saving ${totalCards} cards in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < createdCards.length; i += BATCH_SIZE) {
    const batch = createdCards.slice(i, i + BATCH_SIZE);
    batch.forEach(card => saveCard(cardMutations, card));

    if (totalCards > 500 && (i + BATCH_SIZE) % 500 === 0) {
      console.log(`[Anki Import] Saved ${Math.min(i + BATCH_SIZE, totalCards)}/${totalCards} cards...`);
    }

    // Yield to event loop between batches
    if (i + BATCH_SIZE < createdCards.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // Create decks via mutations (only new ones not in decksState)
  Object.values(updatedDecks).forEach(deck => {
    if (!decksState || !decksState[deck.id]) {
      deckMutations.create(deck);
    }
  });

  console.log(`[Anki Import] Successfully saved ${totalCards} cards`);

  return {
    cardTypesToAdd,
    updatedDecks,
    createdCardsCount: createdCards.length,
    deckCount: Object.keys(updatedDecks).length
  };
}

