/**
 * Media Storage Utilities
 *
 * Collection-based media storage with deduplication and reference counting.
 * Each media item is a record in the 'media' collection with fields:
 *   mediaId, mediaType, hash, data (base64), mimeType, ext, size, refCount
 *
 * READ functions accept `mediaRecords` (array from useQuery('media')).
 * WRITE functions accept `mutations` from useMutations('media').
 */

// ============================================================================
// Hashing
// ============================================================================

/**
 * Generate SHA-256 hash from blob data.
 * @param {Blob|ArrayBuffer} data
 * @returns {Promise<string>} hex hash
 */
export async function generateHash(data) {
  try {
    let arrayBuffer;
    if (data instanceof Blob) {
      arrayBuffer = await data.arrayBuffer();
    } else if (data instanceof ArrayBuffer) {
      arrayBuffer = data;
    } else {
      throw new Error('Data must be Blob or ArrayBuffer');
    }
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Failed to generate hash:', error);
    return `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// MIME / extension helpers (pure — unchanged)
// ============================================================================

export function getExtension(type, mimeType = '') {
  if (type === 'image') {
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
    if (mimeType.includes('gif')) return 'gif';
    if (mimeType.includes('webp')) return 'webp';
    return 'png';
  } else if (type === 'audio') {
    if (mimeType.includes('mp3') || mimeType.includes('mpeg')) return 'mp3';
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('m4a')) return 'm4a';
    return 'mp3';
  }
  return 'bin';
}

export function getMimeType(type, ext) {
  if (type === 'image') {
    const m = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
    return m[ext] || 'image/png';
  } else if (type === 'audio') {
    const m = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4' };
    return m[ext] || 'audio/mpeg';
  }
  return 'application/octet-stream';
}

// ============================================================================
// Blob / base64 converters
// ============================================================================

export function base64ToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const base64 = parts[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ============================================================================
// Image compression
// ============================================================================

// Maximum pixel dimension (longest side). Images larger than this are
// downscaled proportionally. 1024px is plenty for flashcard display.
const MAX_IMAGE_DIMENSION = 1024;

// Target maximum blob size in bytes (~500 KB). If the image exceeds this
// after the first compression pass we re-encode at progressively lower quality.
const MAX_IMAGE_BYTES = 500 * 1024;

/**
 * Compress an image blob by resizing and re-encoding as JPEG.
 *
 * - Downscales to MAX_IMAGE_DIMENSION on the longest side (preserving aspect ratio).
 * - Re-encodes as JPEG at decreasing quality until the result is ≤ MAX_IMAGE_BYTES.
 * - If the original blob is already under MAX_IMAGE_BYTES and within the pixel
 *   limit it is returned unchanged (no quality loss for small images).
 *
 * @param {Blob} blob - Source image blob
 * @returns {Promise<Blob>} Compressed image blob (JPEG)
 */
export async function compressImage(blob) {
  // Skip compression for tiny images
  if (blob.size <= MAX_IMAGE_BYTES) {
    // Still need to check pixel dimensions — load into an Image to measure.
    // For very small files we can assume dimensions are fine and skip entirely.
    if (blob.size <= 100 * 1024) return blob;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // If already within both size and dimension limits, return as-is
      if (blob.size <= MAX_IMAGE_BYTES && width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
        resolve(blob);
        return;
      }

      // Downscale if either dimension exceeds the limit
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Draw onto an offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Iteratively encode at decreasing quality until under the size cap
      const qualitySteps = [0.82, 0.7, 0.55, 0.4, 0.3];
      for (const quality of qualitySteps) {
        const result = await new Promise(res =>
          canvas.toBlob(res, 'image/jpeg', quality)
        );
        if (result && result.size <= MAX_IMAGE_BYTES) {
          resolve(result);
          return;
        }
      }

      // Last resort: return the lowest-quality encode regardless of size
      canvas.toBlob(
        (result) => resolve(result || blob),
        'image/jpeg',
        0.25
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // If we can't decode the image (e.g. SVG, corrupt file), return as-is
      console.warn('[compressImage] Failed to decode image, storing uncompressed');
      resolve(blob);
    };

    img.src = objectUrl;
  });
}

// ============================================================================
// READ operations
// ============================================================================

/**
 * Find a media record by its mediaId.
 * @param {Array} mediaRecords - from useQuery('media')
 * @param {string} mediaId
 * @returns {Object|null} the record (with recordId + data.*)
 */
function findMediaByMediaId(mediaRecords, mediaId) {
  if (!mediaRecords || !mediaId) return null;
  return mediaRecords.find(r => r.data.mediaId === mediaId) || null;
}

/**
 * Find a media record by content hash.
 * @param {Array} mediaRecords
 * @param {string} hash
 * @param {string} mediaType - 'image' or 'audio'
 * @returns {Object|null}
 */
function findMediaByHash(mediaRecords, hash, mediaType) {
  if (!mediaRecords || !hash) return null;
  return mediaRecords.find(r => r.data.hash === hash && r.data.mediaType === mediaType) || null;
}

/**
 * Get the data URL for a media item for display.
 * @param {Array} mediaRecords - from useQuery('media')
 * @param {string} mediaId
 * @returns {string|null} base64 data URL
 */
export function getMediaUrl(mediaRecords, mediaId) {
  const record = findMediaByMediaId(mediaRecords, mediaId);
  if (!record) return null;

  const content = record.data.data;
  if (!content) return null;

  // Already a data URL
  if (typeof content === 'string' && content.startsWith('data:')) {
    return content;
  }
  // Raw base64
  if (typeof content === 'string') {
    return `data:${record.data.mimeType};base64,${content}`;
  }
  return null;
}

// ============================================================================
// WRITE operations
// ============================================================================

/**
 * Save a media file with deduplication.
 * If the same content (by hash) already exists, increments refCount.
 *
 * @param {Object} mutations - { create, put, remove } from useMutations('media')
 * @param {Array} mediaRecords - current records from useQuery('media')
 * @param {Blob|string} data - Blob or base64 data URL
 * @param {string} type - 'image' or 'audio'
 * @returns {Promise<string>} mediaId
 */
export async function saveMedia(mutations, mediaRecords, data, type) {
  let blob;
  let mimeType = '';
  if (typeof data === 'string' && data.startsWith('data:')) {
    blob = base64ToBlob(data);
    mimeType = data.split(',')[0];
  } else if (data instanceof Blob) {
    blob = data;
    mimeType = data.type;
  } else {
    throw new Error('Data must be Blob or base64 data URL');
  }

  // Compress images to stay within RecordRoom size limits.
  // Audio is left untouched (typically small TTS files).
  if (type === 'image') {
    try {
      const originalSize = blob.size;
      blob = await compressImage(blob);
      if (blob.size !== originalSize) {
        mimeType = blob.type || 'image/jpeg';
        console.log(`[saveMedia] Compressed image: ${(originalSize / 1024).toFixed(0)} KB → ${(blob.size / 1024).toFixed(0)} KB`);
      }
    } catch (err) {
      console.warn('[saveMedia] Image compression failed, storing original:', err);
    }
  }

  const hash = await generateHash(blob);

  // Check for existing media with same hash
  const existing = findMediaByHash(mediaRecords, hash, type);
  if (existing) {
    // Increment reference count
    mutations.put(existing.recordId, {
      ...existing.data,
      refCount: (existing.data.refCount || 1) + 1
    });
    return existing.data.mediaId;
  }

  // Create new media record
  const mediaId = `${type === 'image' ? 'img' : 'audio'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const ext = getExtension(type, mimeType);
  const base64Data = await blobToBase64(blob);

  mutations.create({
    mediaId,
    mediaType: type,
    hash,
    data: base64Data,
    mimeType: blob.type || getMimeType(type, ext),
    ext,
    size: blob.size,
    refCount: 1,
  });

  return mediaId;
}

/**
 * Decrement reference count; delete record if count reaches zero.
 * @param {Object} mutations - from useMutations('media')
 * @param {Array} mediaRecords
 * @param {string} mediaId
 */
export function decrementRefCount(mutations, mediaRecords, mediaId) {
  const record = findMediaByMediaId(mediaRecords, mediaId);
  if (!record) return;

  const newCount = (record.data.refCount || 1) - 1;
  if (newCount <= 0) {
    mutations.remove(record.recordId);
  } else {
    mutations.put(record.recordId, { ...record.data, refCount: newCount });
  }
}

// ============================================================================
// Reference string helpers (pure — unchanged)
// ============================================================================

export function isMediaReference(value) {
  if (typeof value !== 'string') return false;
  return value.startsWith('media:image:') || value.startsWith('media:audio:');
}

export function extractMediaId(reference) {
  if (!isMediaReference(reference)) return null;
  return reference.split(':')[2] || null;
}

export function extractMediaType(reference) {
  if (!isMediaReference(reference)) return null;
  return reference.split(':')[1] || null;
}
