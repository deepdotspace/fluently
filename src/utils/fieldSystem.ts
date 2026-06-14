/**
 * Field System Utilities
 * Provides field management, template processing, and HTML sanitization
 * for the Anki-like flashcard system.
 */

import type {
  Field,
  FieldType,
  FieldSide,
  CardType,
  CardTypeMap,
  CardContent,
} from '../types';

// ============================================================================
// LOCAL TYPES
// ============================================================================

/** Options accepted by {@link createField}. */
interface CreateFieldOptions {
  required?: boolean;
  type?: FieldType;
  side?: FieldSide;
  order?: number;
}

/**
 * Per-field inline styling used by the template generator. These properties
 * are author-supplied editor styling and are not part of the persisted
 * {@link Field} shape.
 */
interface FieldStyle {
  special?: 'button' | 'highlight' | string;
  specialColor?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  color?: string;
  textAlign?: string;
}

/** A field as consumed by the template generator (may carry editor styling). */
type StyledField = Partial<Field> & { name: string; style?: FieldStyle };

/** Loose field shape accepted by normalize/require helpers (string or object). */
type FieldInput =
  | string
  | (Partial<Field> & { name?: string; id?: string });

/** Output of {@link generateTemplateFromFields}. */
interface GeneratedTemplate {
  frontTemplate: string;
  backTemplate: string;
  css: string;
}

/** Card type as authored, allowing the pronunciation-only `isPronunciation` flag. */
type ExtendedCardType = CardType & { isPronunciation?: boolean };

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Allowed HTML tags for sanitization (whitelist approach)
 */
const ALLOWED_TAGS = new Set<string>([
  'div', 'span', 'p', 'br', 'hr',
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'img', 'audio', 'video', 'source',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'blockquote', 'pre', 'code',
  'ruby', 'rt', 'rp' // For language learning (furigana)
]);

/**
 * Allowed attributes per tag
 */
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  '*': ['class', 'id', 'style', 'title'],
  'a': ['href', 'target', 'rel'],
  'img': ['src', 'alt', 'width', 'height'],
  'audio': ['src', 'controls', 'preload'],
  'video': ['src', 'controls', 'width', 'height', 'preload', 'poster'],
  'source': ['src', 'type'],
  'td': ['colspan', 'rowspan'],
  'th': ['colspan', 'rowspan', 'scope']
};

/**
 * Dangerous CSS properties to remove
 */
const DANGEROUS_CSS_PROPERTIES: string[] = [
  'behavior', 'expression', '-moz-binding'
];

// ============================================================================
// HTML SANITIZATION
// ============================================================================

/**
 * Sanitizes HTML content to prevent XSS attacks while preserving safe formatting.
 * Uses a whitelist approach for tags and attributes.
 *
 * @param html - Raw HTML content
 * @returns Sanitized HTML
 */
export function sanitizeHTML(html: string): string {
  if (!html || typeof html !== 'string') return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Process all nodes recursively
  sanitizeNode(doc.body);

  return doc.body.innerHTML;
}

/**
 * Recursively sanitizes a DOM node and its children
 * @param node - DOM node to sanitize
 */
function sanitizeNode(node: Node | null): void {
  if (!node) return;

  // Process child nodes (iterate backwards to handle removals safely)
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as Element;
      const tagName = element.tagName.toLowerCase();

      // Remove disallowed tags entirely
      if (!ALLOWED_TAGS.has(tagName)) {
        // For dangerous tags, remove completely
        if (['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'].includes(tagName)) {
          element.remove();
          continue;
        }
        // For other disallowed tags, unwrap (keep content)
        while (element.firstChild) {
          node.insertBefore(element.firstChild, element);
        }
        element.remove();
        continue;
      }

      // Sanitize attributes
      sanitizeAttributes(element, tagName);

      // Recursively process children
      sanitizeNode(element);
    }
  }
}

/**
 * Sanitizes attributes on an element
 * @param element - DOM element
 * @param tagName - Lowercase tag name
 */
function sanitizeAttributes(element: Element, tagName: string): void {
  const allowedForTag = ALLOWED_ATTRIBUTES[tagName] || [];
  const allowedGlobal = ALLOWED_ATTRIBUTES['*'] || [];
  const allAllowed = new Set([...allowedGlobal, ...allowedForTag]);

  // Get all attribute names
  const attrNames = Array.from(element.attributes).map(attr => attr.name);

  for (const attrName of attrNames) {
    const lowerAttr = attrName.toLowerCase();

    // Remove event handlers
    if (lowerAttr.startsWith('on')) {
      element.removeAttribute(attrName);
      continue;
    }

    // Remove disallowed attributes
    if (!allAllowed.has(lowerAttr)) {
      element.removeAttribute(attrName);
      continue;
    }

    // Sanitize specific attribute values
    const value = element.getAttribute(attrName);

    // Check for javascript: URLs
    if (['href', 'src'].includes(lowerAttr)) {
      if (value && /^\s*javascript:/i.test(value)) {
        element.removeAttribute(attrName);
        continue;
      }
      // Also check for data: URLs in src (except for images/audio)
      if (lowerAttr === 'src' && value && /^\s*data:/i.test(value)) {
        const mimeMatch = value.match(/^data:([^;,]+)/i);
        if (mimeMatch) {
          const mime = mimeMatch[1].toLowerCase();
          // Only allow safe data URLs
          if (!mime.startsWith('image/') && !mime.startsWith('audio/') && !mime.startsWith('video/')) {
            element.removeAttribute(attrName);
            continue;
          }
        }
      }
    }

    // Sanitize style attribute
    if (lowerAttr === 'style') {
      const sanitizedStyle = sanitizeStyleAttribute(value);
      if (sanitizedStyle) {
        element.setAttribute(attrName, sanitizedStyle);
      } else {
        element.removeAttribute(attrName);
      }
    }
  }
}

/**
 * Sanitizes a style attribute value
 * @param style - CSS style string
 * @returns Sanitized style string
 */
function sanitizeStyleAttribute(style: string | null): string {
  if (!style) return '';

  // Remove dangerous properties
  let sanitized = style;
  for (const prop of DANGEROUS_CSS_PROPERTIES) {
    const regex = new RegExp(`${prop}\\s*:`, 'gi');
    sanitized = sanitized.replace(regex, 'blocked:');
  }

  // Remove url() with javascript:
  sanitized = sanitized.replace(/url\s*\(\s*(['"]?)javascript:[^)]*\1\s*\)/gi, 'url(blocked)');

  // Remove expression() (IE)
  sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, 'blocked');

  return sanitized;
}

// ============================================================================
// TEMPLATE PROCESSING
// ============================================================================

/**
 * Renders a template with field values.
 * Supports Mustache-like syntax: {{field}} and {{#field}}...{{/field}}
 *
 * @param template - Template string with placeholders
 * @param fields - Field values object
 * @returns Rendered HTML
 */
export function renderTemplate(template: string, fields: CardContent): string {
  if (!template) return '';

  let result = template;
  // Allow field names with spaces/unicode (e.g., "Definición Primaria") while blocking control markers
  const fieldNamePattern = '[^{}#^/][^{}]*?';

  // Handle conditional sections: {{#field}}content{{/field}}
  const conditionalRegex = new RegExp(`\\{\\{#(${fieldNamePattern})\\}\\}([\\s\\S]*?)\\{\\{\\/\\1\\}\\}`, 'gu');
  result = result.replace(conditionalRegex, (match: string, fieldName: string, content: string) => {
    const trimmedFieldName = fieldName.trim();
    const value = fields[trimmedFieldName];
    // Show content only if field has a truthy value
    if (value && String(value).trim()) {
      // Recursively process the content
      return renderTemplate(content, fields);
    }
    return '';
  });

  // Handle inverted sections: {{^field}}content{{/field}}
  const invertedRegex = new RegExp(`\\{\\{\\^(${fieldNamePattern})\\}\\}([\\s\\S]*?)\\{\\{\\/\\1\\}\\}`, 'gu');
  result = result.replace(invertedRegex, (match: string, fieldName: string, content: string) => {
    const trimmedFieldName = fieldName.trim();
    const value = fields[trimmedFieldName];
    // Show content only if field is empty/falsy
    if (!value || !String(value).trim()) {
      return renderTemplate(content, fields);
    }
    return '';
  });

  // Handle simple field substitution: {{field}}
  const fieldRegex = new RegExp(`\\{\\{(${fieldNamePattern})\\}\\}`, 'gu');
  result = result.replace(fieldRegex, (match: string, fieldName: string) => {
    const trimmedFieldName = fieldName.trim();
    const value = fields[trimmedFieldName];
    return value !== undefined ? String(value) : '';
  });

  return result;
}

// ============================================================================
// FIELD MANAGEMENT
// ============================================================================

/**
 * Normalizes fields to field objects (backward compatibility)
 * Converts string[] to field objects with default values
 * @param fields - Array of field names or field objects
 * @returns Array of normalized field objects
 */
export function normalizeFields(
  fields: FieldInput[]
): Array<{ name: string; side: FieldSide; order: number; required: boolean }> {
  if (!Array.isArray(fields) || fields.length === 0) {
    return [];
  }

  // If first item is a string, convert all strings to objects
  if (typeof fields[0] === 'string') {
    return (fields as string[]).map((name, index) => ({
      name,
      side: (index === 0 ? 'front' : 'back') as FieldSide, // First field front, rest back (default behavior)
      order: index,
      required: index === 0 // First field required by default, rest optional
    }));
  }

  // Already objects, ensure they have required properties
  return (fields as Array<Partial<Field> & { name?: string; id?: string }>).map((field, index) => ({
    name: field.name || field.id || String(field),
    side: field.side || ((index === 0 ? 'front' : 'back') as FieldSide),
    order: field.order !== undefined ? field.order : index,
    required: field.required !== undefined ? field.required : (index === 0) // Default: first required, rest optional
  }));
}

/**
 * Gets field name from field object or string
 * @param field - Field name or field object
 * @returns Field name
 */
export function getFieldName(field: string | { name: string }): string {
  return typeof field === 'string' ? field : field.name;
}

/**
 * Generates templates from field configuration
 * Respects field order and side assignments
 */
/**
 * Generate inline styles for a field based on its styling properties
 * @param field - Field object with style property
 * @returns Inline style attribute
 */
function generateFieldStyles(field: StyledField): string {
  const styles: string[] = [];
  const fieldStyle: FieldStyle = field.style || {};

  // Apply special styling FIRST (background, padding, borders) - but NOT color/font-weight
  if (fieldStyle.special) {
    const specialColor = fieldStyle.specialColor || '#3b82f6';

    if (fieldStyle.special === 'button') {
      styles.push(`display: inline-block;`);
      styles.push(`padding: 8px 16px;`);
      styles.push(`background: ${specialColor};`);
      styles.push(`border-radius: 6px;`);
      // Don't force color or font-weight - let user override
    } else if (fieldStyle.special === 'highlight') {
      // Convert hex to rgba for background
      const hexToRgba = (hex: string, alpha: number): string => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };
      const bgColor = hexToRgba(specialColor, 0.1);
      styles.push(`background: ${bgColor};`);
      styles.push(`padding: 8px 12px;`);
      styles.push(`border-radius: 6px;`);
      styles.push(`border-left: 3px solid ${specialColor};`);
    }
  }

  // Apply font family (must come before other font properties for proper cascading)
  if (fieldStyle.fontFamily) {
    styles.push(`font-family: ${fieldStyle.fontFamily};`);
  }

  // Apply font size
  if (fieldStyle.fontSize) {
    styles.push(`font-size: ${fieldStyle.fontSize};`);
  }

  // Apply font weight (this will override button's default if user sets it)
  if (fieldStyle.fontWeight && fieldStyle.fontWeight !== 'normal') {
    styles.push(`font-weight: ${fieldStyle.fontWeight};`);
  } else if (fieldStyle.special === 'button' && !fieldStyle.fontWeight) {
    // Only apply default bold for button if user hasn't set font-weight
    styles.push(`font-weight: 600;`);
  }

  // Apply font style
  if (fieldStyle.fontStyle && fieldStyle.fontStyle !== 'normal') {
    styles.push(`font-style: ${fieldStyle.fontStyle};`);
  }

  // Apply text decoration
  if (fieldStyle.textDecoration && fieldStyle.textDecoration !== 'none') {
    styles.push(`text-decoration: ${fieldStyle.textDecoration};`);
  }

  // Apply color (this will override button's default white if user sets it)
  if (fieldStyle.color) {
    styles.push(`color: ${fieldStyle.color};`);
  } else if (fieldStyle.special === 'button' && !fieldStyle.color) {
    // Only apply default white for button if user hasn't set color
    styles.push(`color: white;`);
  }

  // Note: text-align is handled by the wrapper div, not applied directly to the field
  // This allows inline-block elements (like buttons) to be aligned properly

  return styles.length > 0 ? ` style="${styles.join(' ')}"` : '';
}

export function generateTemplateFromFields(fields: StyledField[]): GeneratedTemplate {
  if (!fields || fields.length === 0) {
    return {
      frontTemplate: '<div class="card-content">No fields defined</div>',
      backTemplate: '<div class="card-content">No fields defined</div>',
      css: ''
    };
  }

  // Sort fields by order
  const sortedFields = [...fields].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Get fields for each side (respecting order)
  const frontFields = sortedFields.filter(f => f.side === 'front' || f.side === 'both');
  const backFields = sortedFields.filter(f => f.side === 'back' || f.side === 'both');

  // Generate front template
  let frontTemplate = '<div class="card-side front">\n';
  for (const field of frontFields) {
    const fieldName = getFieldName(field);
    const fieldStyles = generateFieldStyles(field);
    const fieldStyle: FieldStyle = field.style || {};

    // If textAlign is set, wrap in a container div to handle alignment properly
    if (fieldStyle.textAlign) {
      frontTemplate += `  <div class="field-container" style="text-align: ${fieldStyle.textAlign};">\n`;
      frontTemplate += `    <div class="field field-${fieldName.replace(/\s+/g, '-').toLowerCase()}"${fieldStyles}>{{${fieldName}}}</div>\n`;
      frontTemplate += `  </div>\n`;
    } else {
      frontTemplate += `  <div class="field field-${fieldName.replace(/\s+/g, '-').toLowerCase()}"${fieldStyles}>{{${fieldName}}}</div>\n`;
    }
  }
  frontTemplate += '</div>';

  // Generate back template
  // Only show back-side fields and fields marked as 'both'
  let backTemplate = '<div class="card-side back">\n';

  // Fields that should appear on back side
  const backOnlyFields = sortedFields.filter(f => f.side === 'back');
  const bothFields = sortedFields.filter(f => f.side === 'both');

  // Build back template: show 'both' fields first, then back-only fields
  const allBackFields = [...bothFields, ...backOnlyFields];

  if (allBackFields.length > 0) {
    for (const field of allBackFields) {
      const fieldName = getFieldName(field);
      const fieldStyles = generateFieldStyles(field);
      const fieldStyle: FieldStyle = field.style || {};

      // If textAlign is set, wrap in a container div to handle alignment properly
      if (fieldStyle.textAlign) {
        backTemplate += `  <div class="field-container" style="text-align: ${fieldStyle.textAlign};">\n`;
        backTemplate += `    <div class="field field-${fieldName.replace(/\s+/g, '-').toLowerCase()}"${fieldStyles}>{{${fieldName}}}</div>\n`;
        backTemplate += `  </div>\n`;
      } else {
        backTemplate += `  <div class="field field-${fieldName.replace(/\s+/g, '-').toLowerCase()}"${fieldStyles}>{{${fieldName}}}</div>\n`;
      }
    }
  }

  backTemplate += '</div>';

  // Generate default CSS with better styling
  const css = `
    .card-side {
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .field {
      margin: 12px 0;
      line-height: 1.6;
      font-size: 18px;
    }

    .field.answer {
      color: #2563eb;
      font-weight: 600;
      font-size: 20px;
      margin-top: 16px;
    }

    .divider {
      border: none;
      border-top: 2px solid rgba(0, 0, 0, 0.1);
      margin: 20px 0;
    }

    /* First field styling (typically the main content) */
    .field:first-child {
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 16px;
    }
  `.trim();

  return {
    frontTemplate,
    backTemplate,
    css
  };
}

// ============================================================================
// CARD TYPES
// ============================================================================

/**
 * Default card types (Anki-like note types)
 * Each card type defines fields, templates, and CSS
 */
export function getDefaultCardTypes(): CardTypeMap {
  return {
    'basic': {
      id: 'basic',
      name: 'Basic',
      fields: [
        { name: 'Front', side: 'front', order: 0, required: true },
        { name: 'Back', side: 'back', order: 1, required: true }
      ],
      fieldMetadata: {
        'Front': { required: true },
        'Back': { required: true }
      },
      reversible: false,
      isCloze: false,
      frontTemplate: '<div style="display: flex; align-items: center; justify-content: center; height: 100%; min-height: 300px; padding: 32px; box-sizing: border-box;"><div style="font-size: 24px; line-height: 1.7; text-align: center; color: #1e293b; font-weight: 400; max-width: 100%; word-wrap: break-word;">{{Front}}</div></div>',
      backTemplate: '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 300px; padding: 32px; box-sizing: border-box; gap: 24px;"><div style="font-size: 24px; line-height: 1.7; text-align: center; color: #1e293b; font-weight: 400; max-width: 100%; word-wrap: break-word;">{{Front}}</div><div style="width: 60px; height: 1px; background: linear-gradient(to right, transparent, rgba(0,0,0,0.15), transparent); margin: 8px 0;"></div><div style="font-size: 26px; line-height: 1.6; text-align: center; color: #2563eb; font-weight: 600; max-width: 100%; word-wrap: break-word;">{{Back}}</div></div>',
      css: ''
    },
    'basic-reversed': {
      id: 'basic-reversed',
      name: 'Basic (and reversed)',
      fields: [
        { name: 'Front', side: 'front', order: 0, required: true },
        { name: 'Back', side: 'back', order: 1, required: true }
      ],
      fieldMetadata: {
        'Front': { required: true },
        'Back': { required: true }
      },
      reversible: true,
      isCloze: false,
      frontTemplate: '<div style="display: flex; align-items: center; justify-content: center; height: 100%; min-height: 300px; padding: 32px; box-sizing: border-box;"><div style="font-size: 24px; line-height: 1.7; text-align: center; color: #1e293b; font-weight: 400; max-width: 100%; word-wrap: break-word;">{{Front}}</div></div>',
      backTemplate: '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 300px; padding: 32px; box-sizing: border-box; gap: 24px;">{{FrontSide}}<div style="width: 60px; height: 1px; background: linear-gradient(to right, transparent, rgba(0,0,0,0.15), transparent); margin: 8px 0;"></div><div style="font-size: 26px; line-height: 1.6; text-align: center; color: #2563eb; font-weight: 600; max-width: 100%; word-wrap: break-word;">{{Back}}</div></div>',
      css: ''
    },
    'cloze': {
      id: 'cloze',
      name: 'Cloze',
      fields: [
        { name: 'Text', side: 'front', order: 0, required: true },
        { name: 'Extra', side: 'back', order: 1, required: false }
      ],
      fieldMetadata: {
        'Text': { required: true },
        'Extra': { required: false }
      },
      reversible: false,
      isCloze: true,
      frontTemplate: '<style>.cloze-front .cloze { font-weight: 600; color: #3b82f6; background: rgba(59, 130, 246, 0.12); padding: 4px 10px; border-radius: 6px; display: inline-block; margin: 0 2px; }</style><div style="display: flex; align-items: center; justify-content: center; height: 100%; min-height: 300px; padding: 32px; box-sizing: border-box;"><div class="cloze-front" style="font-size: 22px; line-height: 1.8; text-align: center; color: #1e293b; max-width: 100%; word-wrap: break-word;">{{cloze:Text}}</div></div>',
      backTemplate: '<style>.cloze-back .cloze { font-weight: 600; color: #2563eb; background: rgba(37, 99, 235, 0.15); padding: 4px 10px; border-radius: 6px; display: inline-block; margin: 0 2px; }</style><div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 300px; padding: 32px; box-sizing: border-box; gap: 20px;"><div class="cloze-back" style="font-size: 22px; line-height: 1.8; text-align: center; color: #1e293b; max-width: 100%; word-wrap: break-word;">{{cloze:Text}}</div>{{#Extra}}<div style="width: 60px; height: 1px; background: linear-gradient(to right, transparent, rgba(0,0,0,0.15), transparent); margin: 8px 0;"></div><div style="font-size: 16px; line-height: 1.6; text-align: center; color: #64748b; font-style: italic; max-width: 100%; word-wrap: break-word;">{{Extra}}</div>{{/Extra}}</div>',
      css: ''
    },
    'pronunciation': {
      id: 'pronunciation',
      name: 'Pronunciation Practice',
      fields: [
        { name: 'Word', side: 'front', order: 0, required: true },
        { name: 'Translation', side: 'front', order: 1, required: false },
        { name: 'Pronunciation', side: 'front', order: 2, required: false },
        { name: 'Hint', side: 'front', order: 3, required: false }
      ],
      fieldMetadata: {
        'Word': { required: true },
        'Translation': { required: false },
        'Pronunciation': { required: false },
        'Hint': { required: false }
      },
      reversible: false,
      isCloze: false,
      isPronunciation: true,
      frontTemplate: '<div class="word">{{Word}}</div>{{#Translation}}<div class="translation">{{Translation}}</div>{{/Translation}}{{#Pronunciation}}<div class="pronunciation-guide">{{Pronunciation}}</div>{{/Pronunciation}}{{#Hint}}<div class="hint">{{Hint}}</div>{{/Hint}}',
      backTemplate: '<div class="word">{{Word}}</div>{{#Translation}}<div class="translation">{{Translation}}</div>{{/Translation}}<hr class="divider" /><div class="pronunciation-result">Record your pronunciation to get AI feedback</div>',
      css: `
        .word { font-size: 32px; font-weight: 600; margin-bottom: 12px; text-align: center; }
        .translation { font-size: 20px; color: #6b7280; margin-top: 8px; margin-bottom: 8px; text-align: center; }
        .pronunciation-guide { font-size: 18px; color: #6b7280; font-family: monospace; margin-top: 8px; text-align: center; }
        .hint { font-size: 14px; color: #6b7280; font-style: italic; margin-top: 12px; text-align: center; }
        .pronunciation-result { font-size: 16px; color: #2563eb; margin: 12px 0; text-align: center; }
        .divider { border: none; border-top: 1px solid rgba(0,0,0,0.1); margin: 16px 0; }
      `.trim()
    },
    'vocabulary': {
      id: 'vocabulary',
      name: 'Vocabulary',
      fields: [
        { name: 'Word', side: 'front', order: 0, required: true },
        { name: 'Translation', side: 'back', order: 1, required: true },
        { name: 'Example', side: 'back', order: 2, required: false },
        { name: 'ExampleTranslation', side: 'back', order: 3, required: false },
        { name: 'PartOfSpeech', side: 'front', order: 4, required: false },
        { name: 'Frequency', side: 'front', order: 5, required: false },
        { name: 'CEFRLevel', side: 'front', order: 6, required: false }
      ],
      fieldMetadata: {
        'Word': { required: true },
        'Translation': { required: true },
        'Example': { required: false },
        'ExampleTranslation': { required: false },
        'PartOfSpeech': { required: false },
        'Frequency': { required: false },
        'CEFRLevel': { required: false }
      },
      reversible: false,
      isCloze: false,
      frontTemplate: '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 350px; padding: 40px 32px; box-sizing: border-box;"><div style="font-size: 64px; font-weight: 700; text-align: center; color: #1e293b; line-height: 1.2; letter-spacing: -0.02em; margin-bottom: 24px; word-break: break-word; max-width: 100%;">{{Word}}</div><div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-items: center; margin-top: 16px;">{{#PartOfSpeech}}<span style="display: inline-block; padding: 6px 14px; background: rgba(59, 130, 246, 0.12); color: #3b82f6; border-radius: 10px; font-size: 12px; font-weight: 600;">{{PartOfSpeech}}</span>{{/PartOfSpeech}}{{#CEFRLevel}}<span style="display: inline-block; padding: 6px 14px; background: #3b82f6; color: white; border-radius: 12px; font-size: 12px; font-weight: 600; letter-spacing: 0.3px;">{{CEFRLevel}}</span>{{/CEFRLevel}}</div>{{#Frequency}}<div style="font-size: 14px; color: #94a3b8; text-align: center; font-weight: 500; margin-top: 12px; letter-spacing: 0.2px;">Frequency: #{{Frequency}}</div>{{/Frequency}}</div>',
      backTemplate: '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 350px; padding: 40px 32px; box-sizing: border-box; gap: 32px;"><div style="font-size: 56px; color: #2563eb; font-weight: 700; text-align: center; line-height: 1.2; letter-spacing: -0.01em; word-break: break-word; max-width: 100%;">{{Translation}}</div>{{#Example}}<div style="padding: 20px 24px; background: rgba(59, 130, 246, 0.08); border-radius: 16px; border: 1px solid rgba(59, 130, 246, 0.15); max-width: 90%; width: 100%; box-sizing: border-box;"><div style="font-size: 11px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; text-align: center; opacity: 0.8;">Example</div><div style="font-size: 20px; color: #475569; font-style: italic; margin-bottom: 8px; line-height: 1.7; text-align: center; font-weight: 500;">"{{Example}}"</div>{{#ExampleTranslation}}<div style="font-size: 16px; color: #64748b; line-height: 1.6; text-align: center; margin-top: 8px;">{{ExampleTranslation}}</div>{{/ExampleTranslation}}</div>{{/Example}}</div>',
      css: ''
    }
  } satisfies Record<string, ExtendedCardType>;
}

/**
 * Get card type by ID
 * @param cardTypes - Card types object
 * @param id - Card type ID
 * @returns Card type or null
 */
export function getCardType(cardTypes: CardTypeMap | null | undefined, id: string): CardType | null {
  return cardTypes?.[id] || null;
}

/**
 * Get required field names from a card type
 * @param cardType - Card type object
 * @returns Array of required field names
 */
export function getRequiredFields(cardType: ExtendedCardType | null | undefined): string[] {
  if (!cardType) return [];

  // Special case for pronunciation cards
  if (cardType?.isPronunciation) {
    return ['Word'];
  }

  // If fieldMetadata exists (new format), use it
  if (cardType.fieldMetadata) {
    return Object.keys(cardType.fieldMetadata).filter(
      fieldName => cardType.fieldMetadata[fieldName]?.required !== false
    );
  }

  // Fields is now always an array of objects with required property
  if (Array.isArray(cardType.fields) && cardType.fields.length > 0) {
    return (cardType.fields as Array<FieldInput>)
      .filter((field) => {
        // Handle both object format and legacy string format (for migration)
        if (typeof field === 'string') {
          // Legacy: first field required
          return (cardType.fields as Array<FieldInput>).indexOf(field) === 0;
        }
        return field.required !== false;
      })
      .map((field) => {
        if (typeof field === 'string') {
          return field;
        }
        return field.name || field.id || String(field);
      });
  }

  return [];
}

/**
 * Validate card type structure
 * @param cardType - Card type to validate
 */
export function validateCardType(
  cardType: Partial<CardType> | null | undefined
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!cardType) {
    errors.push('Card type is required');
    return { valid: false, errors };
  }

  if (!cardType.id) errors.push('Card type ID is required');
  if (!cardType.name) errors.push('Card type name is required');
  if (!Array.isArray(cardType.fields) || cardType.fields.length === 0) {
    errors.push('Card type must have at least one field');
  }
  if (!cardType.frontTemplate) errors.push('Front template is required');
  if (!cardType.backTemplate) errors.push('Back template is required');

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Process cloze deletions in text
 * Converts {{text}} to cloze format
 * @param text - Text with {{cloze}} markers
 * @returns Processed text with cloze spans
 */
export function processCloze(text: string): string {
  if (!text) return text;

  // Replace {{text}} with <span class="cloze">text</span>
  return text.replace(/\{\{([^}]+)\}\}/g, '<span class="cloze">$1</span>');
}

/**
 * Render template with field values (enhanced for card types)
 * Supports {{FrontSide}} which shows the front template rendered
 * @param template - Template string
 * @param fieldValues - Field values object
 * @param frontTemplate - Front template (for {{FrontSide}})
 * @returns Rendered HTML
 */
export function renderCardTemplate(
  template: string,
  fieldValues: CardContent,
  frontTemplate: string | null = null
): string {
  if (!template) return '';

  let result = template;

  // Handle {{FrontSide}} - shows rendered front template
  if (result.includes('{{FrontSide}}') && frontTemplate) {
    const frontRendered = renderTemplate(frontTemplate, fieldValues);
    result = result.replace(/\{\{FrontSide\}\}/g, frontRendered);
  }

  // Handle cloze deletions {{cloze:FieldName}}
  const clozeRegex = /\{\{cloze:(\w+)\}\}/g;
  result = result.replace(clozeRegex, (match: string, fieldName: string) => {
    const value = fieldValues[fieldName];
    if (value) {
      return processCloze(value);
    }
    return '';
  });

  // Use existing renderTemplate for other placeholders
  result = renderTemplate(result, fieldValues);

  return result;
}

/**
 * Render template with placeholder values for preview
 * Replaces {{FieldName}} with "(FIELD NAME)" for card type preview
 * @param template - Template string
 * @param fieldNames - Array of field names to show as placeholders
 * @param frontTemplate - Front template (for {{FrontSide}})
 * @returns Rendered HTML with placeholders
 */
export function renderTemplateWithPlaceholders(
  template: string,
  fieldNames: string[] = [],
  frontTemplate: string | null = null
): string {
  if (!template) return '';

  let result = template;

  // Handle {{FrontSide}} - shows rendered front template with placeholders
  if (result.includes('{{FrontSide}}') && frontTemplate) {
    const frontRendered = renderTemplateWithPlaceholders(frontTemplate, fieldNames, null);
    result = result.replace(/\{\{FrontSide\}\}/g, frontRendered);
  }

  // Handle conditional sections: {{#field}}content{{/field}}
  // For preview, always show conditional content (assume field has value)
  const conditionalRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  result = result.replace(conditionalRegex, (match: string, fieldName: string, content: string) => {
    // Recursively process the content with placeholders
    return renderTemplateWithPlaceholders(content, fieldNames, null);
  });

  // Handle inverted sections: {{^field}}content{{/field}}
  // For preview, hide inverted sections (assume field has value)
  const invertedRegex = /\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  result = result.replace(invertedRegex, (match: string, fieldName: string, content: string) => {
    return ''; // Hide inverted sections in preview
  });

  // Handle cloze deletions {{cloze:FieldName}}
  const clozeRegex = /\{\{cloze:(\w+)\}\}/g;
  result = result.replace(clozeRegex, (match: string, fieldName: string) => {
    return `<span class="cloze">(${fieldName.toUpperCase()})</span>`;
  });

  // Handle simple field substitution: {{field}} -> (FIELD NAME)
  const fieldRegex = /\{\{(\w+)\}\}/g;
  result = result.replace(fieldRegex, (match: string, fieldName: string) => {
    return `(${fieldName.toUpperCase()})`;
  });

  return result;
}
