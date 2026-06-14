import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SimpleHtmlField from './SimpleHtmlField';
import CardPreviewPanel from './CardPreviewPanel';
import CardTypeEditor from './CardTypeEditor';
import LucideIcon from './LucideIcon';
import useIsMobile from '../../hooks/useIsMobile';
import { getCardType, getDefaultCardTypes, sanitizeHTML, getRequiredFields, getFieldName } from '../../utils/fieldSystem';
import { saveMedia, base64ToBlob, isMediaReference } from '../../utils/mediaStorage';
import { saveCard } from '../../utils/cardStorage';
import { stripHTML } from '../../utils/helpers';
import { showToast } from '../../utils/toast';
import type {
  Card,
  CardContent,
  CardType,
  CardTypeMap,
  DeckMap,
  MediaRecord,
  RecordEnvelope,
  SoftTheme,
} from '../../types';

/** Card type as authored, allowing the pronunciation-only `isPronunciation` flag. */
type ExtendedCardType = CardType & { isPronunciation?: boolean };

/** Combined per-field media: ordered arrays of URLs / `media:` references. */
interface Media {
  images: string[];
  audio: string[];
}

/**
 * Loose runtime view of a card's `content`. New-format cards carry `fields` /
 * `fieldMedia`; legacy cards carry `text`/`clozes` (Cloze) or `front`/`back`
 * plus per-side media. Both formats are read/written here, so the strict
 * `CardContent` (string map) is widened to this view for dynamic access.
 */
interface LegacyCardContent {
  fields?: CardContent;
  fieldMedia?: Record<string, Media>;
  text?: string;
  clozes?: string[];
  front?: string;
  back?: string;
  frontMedia?: Media;
  backMedia?: Media;
  [key: string]: unknown;
}

/** Loose view of a card exposing the legacy `type` discriminator + content. */
type LegacyCard = Omit<Card, 'content'> & { type?: string; content: LegacyCardContent };

/** Mutations surface from `useMutations('cards')`. */
interface CardMutations {
  create: (data: Record<string, unknown>) => void;
  put: (recordId: string, data: Record<string, unknown>) => void;
  remove: (recordId: string) => void;
}

/** Mutations surface from `useMutations('media')`. */
interface MediaMutations {
  create: (data: MediaRecord) => void;
  put: (recordId: string, data: MediaRecord) => void;
  remove: (recordId: string) => void;
}

interface CardEditDialogProps {
  card: Card;
  cardMutations?: CardMutations;
  mediaRecords?: RecordEnvelope<MediaRecord>[] | null;
  mediaMutations?: MediaMutations;
  decks: DeckMap;
  cardTypes?: CardTypeMap;
  theme: SoftTheme;
  onClose: () => void;
  onSave?: (card: Card) => void;
  updateCardTypes?: (types: CardTypeMap) => void;
}

/**
 * CardEditDialog - Unified card editing dialog
 *
 * Shows the same interface as CreateCardForm but for editing existing cards
 * Features:
 * - Full-screen modal dialog
 * - Input fields on left, preview on right
 * - Support for all card types
 */
function CardEditDialog({ card, cardMutations, mediaRecords, mediaMutations, decks, cardTypes = {}, theme, onClose, onSave, updateCardTypes }: CardEditDialogProps) {
  // Loose view for legacy `type` / mixed-format `content` dynamic access.
  const legacyCard = card as LegacyCard;
  const isMobile = useIsMobile();
  const [isWideScreen, setIsWideScreen] = useState<boolean>(window.innerWidth >= 900);

  // Field values (keyed by field name)
  const [fieldValues, setFieldValues] = useState<CardContent>({});

  // Field media (keyed by field name)
  const [fieldMedia, setFieldMedia] = useState<Record<string, Media>>({});

  // Tags
  const [tags, setTags] = useState<string>(card.tags?.join(', ') || '');

  // Card type editor
  const [showCardTypeEditor, setShowCardTypeEditor] = useState(false);

  // Get active card type
  const activeCardType = useMemo<ExtendedCardType>(() => {
    const allCardTypes = { ...getDefaultCardTypes(), ...cardTypes };
    if (card.cardTypeId) {
      return getCardType(allCardTypes, card.cardTypeId) || allCardTypes.basic;
    }
    // Legacy cards: map to basic type
    return allCardTypes.basic;
  }, [card, cardTypes]);

  // Initialize field values from card
  useEffect(() => {
    if (legacyCard.cardTypeId && legacyCard.content?.fields) {
      // New format: use fields directly
      setFieldValues(legacyCard.content.fields || {});
      setFieldMedia(legacyCard.content.fieldMedia || {});
    } else {
      // Legacy format: map to basic card type fields
      const legacyFields: CardContent = {};
      const legacyMedia: Record<string, Media> = {};

      if (legacyCard.type === 'Cloze') {
        legacyFields['Text'] = legacyCard.content?.text || '';
        legacyMedia['Text'] = { images: [], audio: [] };
      } else {
        legacyFields['Front'] = legacyCard.content?.front || '';
        legacyFields['Back'] = legacyCard.content?.back || '';
        legacyMedia['Front'] = legacyCard.content?.frontMedia || { images: [], audio: [] };
        legacyMedia['Back'] = legacyCard.content?.backMedia || { images: [], audio: [] };
      }

      setFieldValues(legacyFields);
      setFieldMedia(legacyMedia);
    }
  }, [card]);

  // Normalize editor value to plain text for validation
  const isFieldEmpty = useCallback((value: string | undefined) => {
    // Strip HTML tags and non-breaking spaces to ensure true emptiness
    const text = stripHTML(value || '').replace(/ /g, ' ').trim();
    return text.length === 0;
  }, []);

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => setIsWideScreen(window.innerWidth >= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle field value change
  const handleFieldChange = useCallback((fieldName: string, value: string) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  }, []);

  // Handle field media generated
  const handleFieldMediaGenerated = useCallback((fieldName: string, mediaData: { type: string; url: string }) => {
    setFieldMedia(prev => {
      const fieldMediaData = prev[fieldName] || { images: [], audio: [] };
      if (mediaData.type === 'image') {
        return {
          ...prev,
          [fieldName]: { ...fieldMediaData, images: [...fieldMediaData.images, mediaData.url] }
        };
      } else {
        return {
          ...prev,
          [fieldName]: { ...fieldMediaData, audio: [...fieldMediaData.audio, mediaData.url] }
        };
      }
    });
  }, []);

  // Handle field media remove
  const handleFieldMediaRemove = useCallback((fieldName: string, type: 'image' | 'audio', index: number) => {
    setFieldMedia(prev => {
      const fieldMediaData = prev[fieldName] || { images: [], audio: [] };
      if (type === 'image') {
        return {
          ...prev,
          [fieldName]: { ...fieldMediaData, images: fieldMediaData.images.filter((_, i) => i !== index) }
        };
      } else {
        return {
          ...prev,
          [fieldName]: { ...fieldMediaData, audio: fieldMediaData.audio.filter((_, i) => i !== index) }
        };
      }
    });
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!cardMutations) {
      showToast('Card storage not ready', 'error');
      return;
    }

    // Validate required fields - check current fieldValues state
    const requiredFields = getRequiredFields(activeCardType);

    const missingFields = requiredFields.filter(fieldName => {
      const value = fieldValues[fieldName];
      // Check if value is empty after stripping HTML/whitespace
      return isFieldEmpty(value);
    });

    if (missingFields.length > 0) {
      showToast(`Please fill in required fields: ${missingFields.join(', ')}`, 'error');
      return;
    }

    // Sanitize all field values
    const sanitizedFields: CardContent = {};
    Object.keys(fieldValues).forEach(fieldName => {
      sanitizedFields[fieldName] = sanitizeHTML(fieldValues[fieldName] || '');
    });

    // Convert base64 media to file references
    const processedFieldMedia: Record<string, Media> = {};
    try {
      for (const [fieldName, media] of Object.entries(fieldMedia)) {
        processedFieldMedia[fieldName] = {
          images: await Promise.all(((media.images || []) as unknown[]).map(async (dataUrl) => {
            if (isMediaReference(dataUrl)) {
              return dataUrl;
            }
            if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
              try {
                const blob = base64ToBlob(dataUrl);
                const mediaId = await saveMedia(mediaMutations!, mediaRecords, blob, 'image');
                return `media:image:${mediaId}`;
              } catch (error) {
                console.error('Failed to save image:', error);
                return dataUrl;
              }
            }
            return dataUrl;
          })) as string[],
          audio: await Promise.all(((media.audio || []) as unknown[]).map(async (dataUrl) => {
            if (isMediaReference(dataUrl)) {
              return dataUrl;
            }
            if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
              try {
                const blob = base64ToBlob(dataUrl);
                const mediaId = await saveMedia(mediaMutations!, mediaRecords, blob, 'audio');
                return `media:audio:${mediaId}`;
              } catch (error) {
                console.error('Failed to save audio:', error);
                return dataUrl;
              }
            }
            return dataUrl;
          })) as string[]
        };
      }
    } catch (error) {
      console.error('Failed to process media:', error);
      showToast('Failed to save media. Please try again.', 'error');
      return;
    }

    // Create updated card
    let updatedCard: LegacyCard;

    if (legacyCard.cardTypeId && legacyCard.content?.fields) {
      // New format: update fields
      updatedCard = {
        ...legacyCard,
        content: {
          ...legacyCard.content,
          fields: sanitizedFields,
          fieldMedia: processedFieldMedia
        },
        tags: tags.split(',').map(t => t.trim()).filter(Boolean)
      };
    } else {
      // Legacy format: update front/back or text
      if (legacyCard.type === 'Cloze') {
        const text = sanitizedFields['Text'] || '';
        const clozePattern = /\{\{([^}]+)\}\}/g;
        const clozes: string[] = [];
        let match;
        while ((match = clozePattern.exec(text)) !== null) {
          clozes.push(match[1]);
        }

        updatedCard = {
          ...legacyCard,
          content: {
            ...legacyCard.content,
            text: text,
            clozes: clozes
          },
          tags: tags.split(',').map(t => t.trim()).filter(Boolean)
        };
      } else {
        updatedCard = {
          ...legacyCard,
          content: {
            ...legacyCard.content,
            front: sanitizedFields['Front'] || '',
            back: sanitizedFields['Back'] || '',
            frontMedia: processedFieldMedia['Front'] || { images: [], audio: [] },
            backMedia: processedFieldMedia['Back'] || { images: [], audio: [] }
          },
          tags: tags.split(',').map(t => t.trim()).filter(Boolean)
        };
      }
    }

    // Save card
    saveCard(cardMutations, updatedCard as unknown as Card);

    // Notify parent
    if (onSave) {
      onSave(updatedCard as unknown as Card);
    }

    // Close dialog
    onClose();
  }, [card, cardMutations, mediaMutations, mediaRecords, activeCardType, fieldValues, fieldMedia, tags, onSave, onClose, isFieldEmpty]);

  // Check if form is valid - must check current fieldValues state
  const isValid = useMemo(() => {
    const requiredFields = getRequiredFields(activeCardType);

    // Check that all required fields have non-empty values
    const allFieldsFilled = requiredFields.every(fieldName => {
      const value = fieldValues[fieldName];
      // Must have a value and not be just whitespace/HTML noise
      return !isFieldEmpty(value);
    });

    return allFieldsFilled;
  }, [activeCardType, fieldValues, isFieldEmpty]);

  // Get field names for display (normalized to strings)
  const fieldNames = useMemo<string[]>(() => {
    if (card.cardTypeId && activeCardType.fields) {
      // Normalize field objects to strings
      return activeCardType.fields.map(f => getFieldName(f));
    }
    // Legacy format
    if (legacyCard.type === 'Cloze') {
      return ['Text'];
    }
    return ['Front', 'Back'];
  }, [card, activeCardType]);

  return (
    <div
      className="anim-fade-in"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'center',
        padding: isMobile ? '0' : '24px',
        boxSizing: 'border-box',
        overflow: 'auto'
      }}
    >
      <div
        className="anim-fade-slide-down"
        style={{
          width: '100%',
          maxWidth: isMobile ? '100%' : '1300px',
          maxHeight: isMobile ? '100vh' : '92vh',
          height: isMobile ? '100vh' : undefined,
          background: '#ffffff',
          borderRadius: isMobile ? '0' : '28px',
          boxShadow: isMobile ? 'none' : '0 25px 60px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: isMobile ? 'none' : `1px solid ${theme.cardBorder || 'rgba(0, 0, 0, 0.1)'}`
        }}
      >
        {/* Header - always visible / sticky */}
        <div style={{
          padding: isMobile ? '16px 16px' : '24px 40px',
          borderBottom: `1px solid ${theme.cardBorder || 'rgba(0, 0, 0, 0.08)'}`,
          background: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
          flexShrink: 0,
          position: 'sticky',
          top: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '16px', minWidth: 0, flex: 1 }}>
            {!isMobile && (
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.textSecondary} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: `0 8px 16px ${theme.primary}30`,
                flexShrink: 0
              }}>
                <LucideIcon name="edit-3" size={24} color="white" />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <h2 style={{
                fontSize: isMobile ? '18px' : '24px',
                fontWeight: '800',
                color: theme.textPrimary,
                margin: 0,
                letterSpacing: '-0.5px'
              }}>
                Edit Card
              </h2>
              {!isMobile && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '6px'
                }}>
                  <p style={{
                    fontSize: '13px',
                    color: theme.textSecondary,
                    margin: 0,
                    fontWeight: '500'
                  }}>
                    Update content and review settings
                  </p>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    background: `${theme.primary}10`,
                    borderRadius: '8px',
                    border: `1px solid ${theme.primary}20`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                    onClick={() => setShowCardTypeEditor(true)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `${theme.primary}20`;
                      e.currentTarget.style.borderColor = theme.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = `${theme.primary}10`;
                      e.currentTarget.style.borderColor = `${theme.primary}20`;
                    }}
                    title="Click to edit card type definition"
                  >
                    <LucideIcon name="layers" size={12} color={theme.primary} />
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      color: theme.primary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {activeCardType.name}
                    </span>
                    <LucideIcon name="edit-2" size={10} color={theme.primary} />
                  </div>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: isMobile ? '36px' : '44px',
              height: isMobile ? '36px' : '44px',
              borderRadius: isMobile ? '10px' : '12px',
              border: `1px solid ${theme.cardBorder || 'rgba(0, 0, 0, 0.1)'}`,
              background: 'rgba(0, 0, 0, 0.02)',
              color: theme.textPrimary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.transform = 'rotate(90deg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)';
              e.currentTarget.style.color = theme.textPrimary;
              e.currentTarget.style.borderColor = theme.cardBorder || 'rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.transform = 'rotate(0deg)';
            }}
          >
            <LucideIcon name="x" size={isMobile ? 20 : 24} color="currentColor" />
          </button>
        </div>

        {/* Content */}
        <div
          className="no-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isMobile ? '16px 16px 40px' : '40px',
            background: '#f8fafc',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          <div style={{
            display: 'flex',
            flexDirection: (isWideScreen && !isMobile) ? 'row' : 'column',
            gap: isMobile ? '20px' : '40px',
            alignItems: 'stretch'
          }}>
            {/* Left Side: Form */}
            <div style={{
              flex: isWideScreen ? '1 1 60%' : '1 1 auto',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: isMobile ? '20px' : '32px'
            }}>
              {/* Dynamic Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '28px' }}>
                {fieldNames.map((fieldName, index) => {
                  const normalizedFieldName = typeof fieldName === 'string' ? fieldName : getFieldName(fieldName);
                  const isRequired = activeCardType?.isPronunciation
                    ? normalizedFieldName === 'Word'
                    : index < 2;
                  const value = fieldValues[normalizedFieldName] || '';
                  const media = fieldMedia[normalizedFieldName] || { images: [], audio: [] };
                  const isBackField = index > 0;
                  const frontFieldValue = fieldValues[fieldNames[0]] || '';
                  const isClozeField = legacyCard.type === 'Cloze' || activeCardType?.isCloze;

                  return (
                    <div key={normalizedFieldName} style={{
                      background: '#ffffff',
                      padding: isMobile ? '14px' : '24px',
                      borderRadius: isMobile ? '14px' : '20px',
                      border: `1px solid ${theme.cardBorder || 'rgba(0, 0, 0, 0.08)'}`,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
                    }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                        fontWeight: '700',
                        color: theme.textPrimary,
                        marginBottom: '16px',
                        letterSpacing: '0.8px',
                        textTransform: 'uppercase'
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <LucideIcon name={index === 0 ? "type" : "help-circle"} size={14} color={theme.primary} />
                          {normalizedFieldName}
                          {isRequired && <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>}
                        </span>
                        {isBackField && (
                          <span style={{
                            fontSize: '10px',
                            color: theme.primary,
                            fontWeight: '800',
                            background: `${theme.primary}15`,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: `1px solid ${theme.primary}20`
                          }}>
                            ANSWER
                          </span>
                        )}
                      </label>
                      <SimpleHtmlField
                        key={`field-${normalizedFieldName}`}
                        value={value}
                        onChange={(newValue) => handleFieldChange(normalizedFieldName, newValue)}
                        placeholder={`Enter ${normalizedFieldName.toLowerCase()}...`}
                        theme={theme}
                        onMediaGenerated={(mediaData) => handleFieldMediaGenerated(normalizedFieldName, mediaData)}
                        media={media}
                        onMediaRemove={(type, index) => handleFieldMediaRemove(normalizedFieldName, type, index)}
                        allowCloze={isClozeField}
                        editorId={`edit-field-${normalizedFieldName}`}
                        isBackField={isBackField}
                        frontText={frontFieldValue}
                        deck={decks[card.deckId]}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Tags Input */}
              <div style={{
                background: '#ffffff',
                padding: '24px',
                borderRadius: '20px',
                border: `1px solid ${theme.cardBorder || 'rgba(0, 0, 0, 0.08)'}`,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: theme.textPrimary,
                  marginBottom: '16px',
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase'
                }}>
                  <LucideIcon name="tag" size={14} color={theme.primary} />
                  Tags
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="verbs, lesson-1, difficult..."
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    fontSize: '15px',
                    border: `2px solid ${theme.cardBorder || '#e2e8f0'}`,
                    borderRadius: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#fcfdfe',
                    color: theme.textPrimary,
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = theme.primary;
                    e.target.style.background = '#ffffff';
                    e.target.style.boxShadow = `0 0 0 4px ${theme.primary}15`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = theme.cardBorder || '#e2e8f0';
                    e.target.style.background = '#fcfdfe';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: isMobile ? '10px' : '16px',
                marginTop: '8px'
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? '10px' : '16px',
                  alignItems: isMobile ? 'stretch' : 'center',
                  flexWrap: 'wrap'
                }}>
                  <button
                    onClick={handleSave}
                    disabled={!isValid}
                    style={{
                      padding: isMobile ? '14px 20px' : '18px 40px',
                      background: !isValid
                        ? 'rgba(156, 163, 175, 0.2)'
                        : `linear-gradient(135deg, ${theme.primary} 0%, ${theme.textSecondary} 100%)`,
                      color: 'white',
                      border: 'none',
                      borderRadius: isMobile ? '12px' : '16px',
                      fontSize: isMobile ? '14px' : '16px',
                      fontWeight: '700',
                      cursor: !isValid ? 'not-allowed' : 'pointer',
                      boxShadow: !isValid ? 'none' : `0 12px 24px -6px ${theme.primary}50`,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      opacity: !isValid ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px'
                    }}
                    onMouseEnter={(e) => {
                      if (isValid) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = `0 15px 30px -5px ${theme.primary}60`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isValid) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = `0 12px 24px -6px ${theme.primary}50`;
                      }
                    }}
                  >
                    <LucideIcon name="check-circle" size={isMobile ? 18 : 20} color="white" />
                    Save Changes
                  </button>

                  <button
                    onClick={onClose}
                    style={{
                      padding: isMobile ? '14px 20px' : '18px 40px',
                      background: '#ffffff',
                      color: theme.textPrimary,
                      border: `2px solid ${theme.cardBorder || 'rgba(0, 0, 0, 0.1)'}`,
                      borderRadius: isMobile ? '12px' : '16px',
                      fontSize: isMobile ? '14px' : '16px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)';
                      e.currentTarget.style.borderColor = theme.textPrimary;
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = theme.cardBorder || 'rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <LucideIcon name="x-circle" size={isMobile ? 18 : 20} color="currentColor" />
                    Discard
                  </button>
                </div>

                {/* Validation message */}
                {!isValid && (
                  <div style={{
                    fontSize: '13px',
                    color: '#EF4444',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 20px',
                    background: 'rgba(239, 68, 68, 0.05)',
                    borderRadius: '12px',
                    border: '1px solid rgba(239, 68, 68, 0.1)'
                  }}>
                    <LucideIcon name="alert-circle" size={16} />
                    <span>Please fill in all required fields to save your changes</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Preview - hidden on mobile to save space */}
            {!isMobile && (<div style={{
              flex: isWideScreen ? '0 0 450px' : '1 1 auto',
              minWidth: isWideScreen ? '400px' : 'auto',
              maxWidth: isWideScreen ? '500px' : 'none',
              position: isWideScreen ? 'sticky' : 'static',
              top: isWideScreen ? '0px' : 'auto',
              alignSelf: isWideScreen ? 'flex-start' : 'stretch',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}>
              <div style={{
                background: '#ffffff',
                padding: '28px',
                borderRadius: '24px',
                border: `1px solid ${theme.cardBorder || 'rgba(0, 0, 0, 0.08)'}`,
                boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: theme.primary,
                  fontSize: '13px',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  <LucideIcon name="eye" size={16} color={theme.primary} />
                  Live Preview
                </div>
                <CardPreviewPanel
                  cardType={activeCardType}
                  fieldValues={fieldValues}
                  fieldMedia={fieldMedia}
                  theme={theme}
                  compact={!isWideScreen}
                  mediaRecords={mediaRecords}
                />
              </div>

              {/* Quick Info */}
              <div style={{
                background: '#ffffff',
                padding: '24px',
                borderRadius: '20px',
                border: `1px solid ${theme.cardBorder || 'rgba(0, 0, 0, 0.08)'}`,
                fontSize: '14px',
                color: theme.textSecondary,
                lineHeight: '1.6',
                boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{
                  fontWeight: '800',
                  color: theme.textPrimary,
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  <LucideIcon name="info" size={14} color={theme.primary} />
                  Card Metadata
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                    <span style={{ opacity: 0.7, fontWeight: '500' }}>Type:</span>
                    <span style={{ color: theme.textPrimary, fontWeight: '600' }}>{activeCardType.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                    <span style={{ opacity: 0.7, fontWeight: '500' }}>Status:</span>
                    <span style={{
                      color: card.scheduling?.state === 'review' ? '#10b981' : theme.primary,
                      fontWeight: '700',
                      textTransform: 'capitalize'
                    }}>{card.scheduling?.state || 'New'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.7, fontWeight: '500' }}>Created:</span>
                    <span style={{ color: theme.textPrimary, fontWeight: '600' }}>{new Date(card.createdAt as string).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
            </div>)}
          </div>
        </div>
      </div>
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Card Type Editor Modal */}
      {showCardTypeEditor && (
        <CardTypeEditor
          cardType={activeCardType}
          cardTypes={cardTypes}
          theme={theme}
          onClose={() => setShowCardTypeEditor(false)}
          onSave={(updatedCardType) => {
            if (updateCardTypes) {
              updateCardTypes({
                ...cardTypes,
                [updatedCardType.id]: updatedCardType
              } as unknown as CardTypeMap);
            }
            setShowCardTypeEditor(false);
          }}
        />
      )}
    </div>
  );
}

export default CardEditDialog;
