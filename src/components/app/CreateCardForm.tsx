import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DeckSelector from './DeckSelector';
import CardTypeSelector from './CardTypeSelector';
import SimpleHtmlField from './SimpleHtmlField';
import CardPreviewPanel from './CardPreviewPanel';
import LucideIcon from './LucideIcon';
import { getCardType, getDefaultCardTypes, sanitizeHTML, getRequiredFields, getFieldName } from '../../utils/fieldSystem';
import { saveMedia, base64ToBlob, isMediaReference } from '../../utils/mediaStorage';
import { showToast } from '../../utils/toast';
import type { CardType, CardTypeMap, DeckMap, MediaRecord, RecordEnvelope, SoftTheme, StoredDeck } from '../../types';

/** Per-field media: ordered arrays of URLs / `media:` references. */
interface FieldMediaState {
  images: string[];
  audio: string[];
}

/** Field name → media collection. */
type FieldMediaMap = Record<string, FieldMediaState>;

/** Media records / mutations as returned by the SDK hooks. */
type MediaEnvelope = RecordEnvelope<MediaRecord>;
interface MediaMutations {
  create: (data: MediaRecord) => void;
  put: (recordId: string, data: MediaRecord) => void;
  remove: (recordId: string) => void;
}

/** Payload handed to the parent `handleCreateCard` for the card-type API. */
interface CreateCardPayload {
  cardTypeId: string;
  fields: Record<string, string>;
  fieldMedia: FieldMediaMap;
  tags: string[];
}

/** Media notification surfaced by a SimpleHtmlField after AI generation. */
interface MediaGenerated {
  type: string;
  url: string;
}

interface CreateCardFormProps {
  currentTheme: SoftTheme;
  selectedDeck: string | null;
  setSelectedDeck: (deckId: string) => void;
  decks: DeckMap;
  currentDeck: StoredDeck | null;
  tags: string;
  setTags: (tags: string) => void;
  handleCreateCard: (cardData: CreateCardPayload) => void;
  cardTypes?: CardTypeMap;
  updateCardTypes: (cardTypes: CardTypeMap) => void;
  mediaRecords?: MediaEnvelope[] | null;
  mediaMutations?: MediaMutations | null;
  // Card type editor state lifted to parent (CardCreation) so modal renders outside GlassCard
  selectedCardTypeId: string;
  setSelectedCardTypeId: (id: string) => void;
  onOpenCardTypeEditor: () => void;
  onEditCardType: (cardType: CardType) => void;
}

/**
 * CreateCardForm - Simplified card creation form using card types
 *
 * Features:
 * - Card type selection with dynamic fields
 * - HTML field editors with WYSIWYG toggle
 * - Live preview
 * - Media support per field
 */
function CreateCardForm({
  currentTheme,
  selectedDeck,
  setSelectedDeck,
  decks,
  currentDeck,
  tags,
  setTags,
  handleCreateCard: parentHandleCreateCard,
  cardTypes = {},
  updateCardTypes,
  mediaRecords,
  mediaMutations,
  // Card type editor state lifted to parent (CardCreation) so modal renders outside GlassCard
  selectedCardTypeId,
  setSelectedCardTypeId,
  onOpenCardTypeEditor,
  onEditCardType
}: CreateCardFormProps) {
  // Responsive layout
  const [isWideScreen, setIsWideScreen] = useState(window.innerWidth >= 900);
  const [showPreview, setShowPreview] = useState(true);

  // Field values (keyed by field name)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  // Field media (keyed by field name)
  const [fieldMedia, setFieldMedia] = useState<FieldMediaMap>({});

  // Get active card type
  const activeCardType = useMemo(() => {
    return getCardType(cardTypes, selectedCardTypeId) || getDefaultCardTypes().basic;
  }, [cardTypes, selectedCardTypeId]);

  // Initialize field values when card type changes
  useEffect(() => {
    if (activeCardType?.fields) {
      const newValues = { ...fieldValues };
      const newMedia = { ...fieldMedia };

      // Get field names as strings
      const fieldNameStrings = activeCardType.fields.map(f => getFieldName(f));

      fieldNameStrings.forEach(fieldName => {
        if (!(fieldName in newValues)) {
          newValues[fieldName] = '';
        }
        if (!(fieldName in newMedia)) {
          newMedia[fieldName] = { images: [], audio: [] };
        }
      });

      // Remove values for fields that no longer exist
      Object.keys(newValues).forEach(fieldName => {
        if (!fieldNameStrings.includes(fieldName)) {
          delete newValues[fieldName];
          delete newMedia[fieldName];
        }
      });

      setFieldValues(newValues);
      setFieldMedia(newMedia);
    }
  }, [activeCardType?.id]); // Only when card type ID changes

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => setIsWideScreen(window.innerWidth >= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle field value change
  const handleFieldChange = useCallback((fieldName: string, value: string) => {
    setFieldValues(prev => {
      const newValues = {
        ...prev,
        [fieldName]: value
      };
      return newValues;
    });
  }, []);

  // Handle field media generated
  const handleFieldMediaGenerated = useCallback((fieldName: string, mediaData: MediaGenerated) => {
    setFieldMedia(prev => {
      const fieldMediaData = prev[fieldName] || { images: [], audio: [] };
      let newFieldMedia;
      if (mediaData.type === 'image') {
        newFieldMedia = {
          ...prev,
          [fieldName]: { ...fieldMediaData, images: [...fieldMediaData.images, mediaData.url] }
        };
      } else {
        newFieldMedia = {
          ...prev,
          [fieldName]: { ...fieldMediaData, audio: [...fieldMediaData.audio, mediaData.url] }
        };
      }
      return newFieldMedia;
    });
  }, []);

  // Handle field media remove
  const handleFieldMediaRemove = useCallback((fieldName: string, type: 'image' | 'audio', index: number) => {
    setFieldMedia(prev => {
      const fieldMediaData = prev[fieldName] || { images: [], audio: [] };
      let newFieldMedia;
      if (type === 'image') {
        newFieldMedia = {
          ...prev,
          [fieldName]: { ...fieldMediaData, images: fieldMediaData.images.filter((_, i) => i !== index) }
        };
      } else {
        newFieldMedia = {
          ...prev,
          [fieldName]: { ...fieldMediaData, audio: fieldMediaData.audio.filter((_, i) => i !== index) }
        };
      }

      // Update placeholders in field values
      setFieldValues(prevValues => {
        const newValues = { ...prevValues };
        const currentValue = prevValues[fieldName] || '';

        if (type === 'image') {
          // Update image placeholders - decrement indices higher than the removed index
          const updatedValue = currentValue
            .replace(/\[IMAGE:(\d+)\]/g, (match, num) => {
              const placeholderIndex = parseInt(num);
              if (placeholderIndex === index) {
                // Remove this placeholder entirely
                return '';
              } else if (placeholderIndex > index) {
                // Decrement higher indices
                return `[IMAGE:${placeholderIndex - 1}]`;
              }
              // Keep lower indices unchanged
              return match;
            })
            .replace(/\s+/g, ' ') // Clean up extra spaces
            .trim();

          newValues[fieldName] = updatedValue;
        } else if (type === 'audio') {
          // Update audio placeholders - decrement indices higher than the removed index
          const updatedValue = currentValue
            .replace(/\[AUDIO:(\d+)\]/g, (match, num) => {
              const placeholderIndex = parseInt(num);
              if (placeholderIndex === index) {
                // Remove this placeholder entirely
                return '';
              } else if (placeholderIndex > index) {
                // Decrement higher indices
                return `[AUDIO:${placeholderIndex - 1}]`;
              }
              // Keep lower indices unchanged
              return match;
            })
            .replace(/\s+/g, ' ') // Clean up extra spaces
            .trim();

          newValues[fieldName] = updatedValue;
        }

        return newValues;
      });

      return newFieldMedia;
    });
  }, []);

  // Card type save is now handled by parent (CardCreation)

  // Handle create card
  const handleCreateCard = useCallback(async () => {
    if (!selectedDeck) {
      showToast('Please select a deck', 'error');
      return;
    }

    if (!mediaMutations) {
      showToast('Media storage not ready', 'error');
      return;
    }

    // Validate required fields
    const requiredFields = getRequiredFields(activeCardType);

    const missingFields = requiredFields.filter(fieldName => {
      const value = fieldValues[fieldName];
      return !value || !value.trim();
    });

    if (missingFields.length > 0) {
      showToast(`Please fill in: ${missingFields.join(', ')}`, 'error');
      return;
    }

    // Sanitize all field values
    const sanitizedFields: Record<string, string> = {};
    Object.keys(fieldValues).forEach(fieldName => {
      sanitizedFields[fieldName] = sanitizeHTML(fieldValues[fieldName] || '');
    });

    // Convert all media (base64 and HTTPS URLs) to persistent file references.
    // HTTPS URLs (e.g. from AI image generation) can expire, so we fetch and
    // store them as base64 in the media collection for reliable playback.
    const processedFieldMedia: FieldMediaMap = {};
    try {
      for (const [fieldName, media] of Object.entries(fieldMedia)) {
        // The map bodies operate on `unknown` so the `isMediaReference` predicate
        // doesn't collapse the post-guard branches to `never`; every produced
        // value is a string at runtime, so cast back to the field-media shape.
        processedFieldMedia[fieldName] = {
          images: await Promise.all((media.images || []).map(async (dataUrl: unknown) => {
            if (isMediaReference(dataUrl)) return dataUrl;
            // Convert base64 data URL to media reference
            if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
              try {
                const blob = base64ToBlob(dataUrl);
                const mediaId = await saveMedia(mediaMutations, mediaRecords, blob, 'image');
                return `media:image:${mediaId}`;
              } catch (error) {
                console.error('Failed to save image:', error);
                return dataUrl;
              }
            }
            // Convert HTTPS URL to media reference (fetch → blob → save)
            if (typeof dataUrl === 'string' && (dataUrl.startsWith('http://') || dataUrl.startsWith('https://'))) {
              try {
                const response = await fetch(dataUrl);
                if (response.ok) {
                  const blob = await response.blob();
                  const mediaId = await saveMedia(mediaMutations, mediaRecords, blob, 'image');
                  return `media:image:${mediaId}`;
                }
              } catch (error) {
                console.error('Failed to fetch and save remote image:', error);
              }
              return dataUrl; // Fallback to URL if fetch fails
            }
            return dataUrl;
          })),
          audio: await Promise.all((media.audio || []).map(async (dataUrl: unknown) => {
            if (isMediaReference(dataUrl)) return dataUrl;
            // Convert base64 data URL to media reference
            if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
              try {
                const blob = base64ToBlob(dataUrl);
                const mediaId = await saveMedia(mediaMutations, mediaRecords, blob, 'audio');
                return `media:audio:${mediaId}`;
              } catch (error) {
                console.error('Failed to save audio:', error);
                return dataUrl;
              }
            }
            // Convert HTTPS URL to media reference (fetch → blob → save)
            if (typeof dataUrl === 'string' && (dataUrl.startsWith('http://') || dataUrl.startsWith('https://'))) {
              try {
                const response = await fetch(dataUrl);
                if (response.ok) {
                  const blob = await response.blob();
                  const mediaId = await saveMedia(mediaMutations, mediaRecords, blob, 'audio');
                  return `media:audio:${mediaId}`;
                }
              } catch (error) {
                console.error('Failed to fetch and save remote audio:', error);
              }
              return dataUrl;
            }
            return dataUrl;
          }))
        } as FieldMediaState;
      }
    } catch (error) {
      console.error('Failed to process media:', error);
      showToast('Failed to save media. Please try again.', 'error');
      return;
    }

    // Call parent handler
    if (parentHandleCreateCard) {
      parentHandleCreateCard({
        cardTypeId: selectedCardTypeId,
        fields: sanitizedFields,
        fieldMedia: processedFieldMedia,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean)
      });

      // Clear form
      const clearedValues: Record<string, string> = {};
      activeCardType.fields.forEach(field => {
        const fieldName = getFieldName(field);
        clearedValues[fieldName] = '';
      });
      setFieldValues(clearedValues);

      const clearedMedia: FieldMediaMap = {};
      activeCardType.fields.forEach(field => {
        const fieldName = getFieldName(field);
        clearedMedia[fieldName] = { images: [], audio: [] };
      });
      setFieldMedia(clearedMedia);
      setTags('');
    }
  }, [selectedDeck, mediaMutations, mediaRecords, activeCardType, fieldValues, fieldMedia, tags, selectedCardTypeId, parentHandleCreateCard]);

  // Check if form is valid
  const isValid = useMemo(() => {
    if (!selectedDeck) return false;
    const requiredFields = getRequiredFields(activeCardType);
    return requiredFields.every(fieldName => {
      const value = fieldValues[fieldName];
      return value && value.trim();
    });
  }, [selectedDeck, activeCardType, fieldValues]);


  return (
    <>
      <div style={{
        display: 'flex',
        flexDirection: isWideScreen ? 'row' : 'column',
        gap: '24px',
        alignItems: 'stretch'
      }}>
        {/* Left Side: Form */}
        <div style={{
          flex: isWideScreen ? '1 1 55%' : '1 1 auto',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* Deck Selector */}
          <DeckSelector
            decks={decks}
            selectedDeck={selectedDeck}
            setSelectedDeck={setSelectedDeck}
            currentTheme={currentTheme}
            marginBottom="0px"
          />

          {/* Card Type Selector */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: currentTheme.textPrimary,
              marginBottom: '10px',
              letterSpacing: '0.3px'
            }}>
              Card Type
            </label>
            <CardTypeSelector
              cardTypes={cardTypes}
              selectedCardTypeId={selectedCardTypeId}
              onCardTypeChange={setSelectedCardTypeId}
              onEditClick={onOpenCardTypeEditor}
              onEditCardType={onEditCardType}
              theme={currentTheme}
            />
          </div>

          {/* Dynamic Fields */}
          {activeCardType?.fields?.map((field, index) => {
            // Extract field name (handles both string and object formats)
            const fieldName = getFieldName(field);
            // Check if field is required using getRequiredFields helper
            const requiredFields = getRequiredFields(activeCardType);
            const isRequired = requiredFields.includes(fieldName);
            const value = fieldValues[fieldName] || '';
            const media = fieldMedia[fieldName] || { images: [], audio: [] };
            const isBackField = index > 0; // Fields after first are considered "back" fields
            const firstFieldName = getFieldName(activeCardType.fields[0]);
            const frontFieldValue = fieldValues[firstFieldName] || '';

            return (
              <div key={fieldName}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: currentTheme.textPrimary,
                  marginBottom: '10px',
                  letterSpacing: '0.3px'
                }}>
                  {fieldName}
                  {isRequired && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                </label>
                <SimpleHtmlField
                  key={`field-${fieldName}`}
                  value={value}
                  onChange={(newValue) => handleFieldChange(fieldName, newValue)}
                  placeholder={`Enter ${fieldName.toLowerCase()}...`}
                  theme={currentTheme}
                  onMediaGenerated={(mediaData) => handleFieldMediaGenerated(fieldName, mediaData)}
                  media={media}
                  onMediaRemove={(type, index) => handleFieldMediaRemove(fieldName, type, index)}
                  allowCloze={activeCardType?.isCloze}
                  editorId={`field-${fieldName}`}
                  // AI features
                  deck={currentDeck}
                  isBackField={isBackField}
                  frontText={frontFieldValue}
                />
              </div>
            );
          })}

          {/* Tags Input */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: currentTheme.textPrimary,
              marginBottom: '10px',
              letterSpacing: '0.3px'
            }}>
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., verbs, unit-1, difficult"
              style={{
                width: '100%',
                padding: '14px 18px',
                fontSize: '15px',
                border: `1px solid ${currentTheme.cardBorder}`,
                borderRadius: '12px',
                outline: 'none',
                boxSizing: 'border-box',
                background: 'rgba(255, 255, 255, 0.5)',
                color: currentTheme.textPrimary
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={handleCreateCard}
              disabled={!isValid}
              style={{
                padding: '18px 36px',
                background: !isValid
                  ? 'rgba(156, 163, 175, 0.5)'
                  : `linear-gradient(135deg, ${currentTheme.primary} 0%, ${currentTheme.textSecondary} 100%)`,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: !isValid ? 'not-allowed' : 'pointer',
                boxShadow: `0 4px 20px ${currentTheme.primary}40`,
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <LucideIcon name="plus" size={20} color="white" />
              Create Card
            </button>

            {!isWideScreen && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                style={{
                  padding: '14px 20px',
                  background: showPreview ? `${currentTheme.primary}15` : 'rgba(255, 255, 255, 0.5)',
                  color: currentTheme.textPrimary,
                  border: `1px solid ${showPreview ? currentTheme.primary : currentTheme.cardBorder}`,
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
                <LucideIcon name={showPreview ? 'eye' : 'eye-off'} size={18} color={currentTheme.textPrimary} />
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Preview */}
        {(isWideScreen || showPreview) && (
          <div style={{
            flex: isWideScreen ? '0 0 400px' : '1 1 auto',
            minWidth: isWideScreen ? '350px' : 'auto',
            maxWidth: isWideScreen ? '450px' : 'none',
            position: isWideScreen ? 'sticky' : 'static',
            top: isWideScreen ? '24px' : 'auto',
            alignSelf: isWideScreen ? 'flex-start' : 'stretch',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <CardPreviewPanel
              cardType={activeCardType}
              fieldValues={fieldValues}
              fieldMedia={fieldMedia}
              theme={currentTheme}
              compact={!isWideScreen}
              mediaRecords={mediaRecords}
              deckDesignId={currentDeck?.designId}
            />
          </div>
        )}
      </div>

      {/* CardTypeEditor modal is now rendered in CardCreation (parent)
          outside of GlassCard to avoid backdrop-filter breaking position:fixed */}
    </>
  );
}

export default CreateCardForm;
