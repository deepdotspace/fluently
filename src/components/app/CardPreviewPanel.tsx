import React, { useMemo } from 'react';
import CardPreview from './CardPreview';
import { getFieldName } from '../../utils/fieldSystem';
import type { CardType, CardContent, MediaRecord, RecordEnvelope, SoftTheme } from '../../types';

/** Media records as returned by the SDK, passed through to `CardPreview`. */
type MediaRecords = RecordEnvelope<MediaRecord>[] | null;

/** Combined per-side media: ordered arrays of URLs / `media:` references. */
interface Media {
  images?: string[];
  audio?: string[];
}

interface CardPreviewPanelProps {
  cardType?: CardType | null;
  fieldValues?: CardContent;
  fieldMedia?: Record<string, Media>;
  theme?: SoftTheme;
  compact?: boolean;
  mediaRecords?: MediaRecords;
  deckDesignId?: string | null;
}

/**
 * CardPreviewPanel - Simplified preview-only panel
 * Shows live card preview that updates as user types
 */
function CardPreviewPanel({
  cardType = null,
  fieldValues = {},
  fieldMedia = {},
  theme,
  compact = false,
  mediaRecords = null,
  deckDesignId = null
}: CardPreviewPanelProps) {
  // Combine all field values with remapped media indices so placeholders
  // from different fields don't collide in the combined media array.
  const { allFieldValues, allMedia } = useMemo(() => {
    const combined: { images: string[]; audio: string[] } = { images: [], audio: [] };
    const adjusted: CardContent = { ...fieldValues };
    let imageOffset = 0;
    let audioOffset = 0;

    // Use card type field order for deterministic iteration
    const fieldNames = cardType?.fields
      ? cardType.fields.map(f => getFieldName(f))
      : Object.keys(fieldMedia || {});

    // Include any extra field media keys not in the card type
    Object.keys(fieldMedia || {}).forEach(fn => {
      if (!fieldNames.includes(fn)) fieldNames.push(fn);
    });

    for (const fieldName of fieldNames) {
      const fm = (fieldMedia || {})[fieldName] || { images: [], audio: [] };
      const fieldImages = fm.images || [];
      const fieldAudio = fm.audio || [];

      if (fieldImages.length > 0 && imageOffset > 0 && adjusted[fieldName]) {
        adjusted[fieldName] = adjusted[fieldName].replace(
          /\[IMAGE:(\d+)\]/g,
          (match, num) => `[IMAGE:${parseInt(num) + imageOffset}]`
        );
      }
      if (fieldAudio.length > 0 && audioOffset > 0 && adjusted[fieldName]) {
        adjusted[fieldName] = adjusted[fieldName].replace(
          /\[AUDIO:(\d+)\]/g,
          (match, num) => `[AUDIO:${parseInt(num) + audioOffset}]`
        );
      }

      combined.images.push(...fieldImages);
      combined.audio.push(...fieldAudio);
      imageOffset += fieldImages.length;
      audioOffset += fieldAudio.length;
    }

    return { allFieldValues: adjusted, allMedia: combined };
  }, [fieldValues, fieldMedia, cardType]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      height: '100%'
    }}>
      {/* Preview */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: compact ? '16px' : '24px',
        paddingBottom: '40px', // Space for flip hint
        background: 'rgba(255, 255, 255, 0.3)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: '16px',
        border: `1px solid ${theme?.cardBorder || 'rgba(0,0,0,0.08)'}`,
        minHeight: compact ? '300px' : '400px'
      }}>
        {/* Label */}
        <div style={{
          fontSize: '11px',
          fontWeight: '600',
          color: theme?.textSecondary || '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          marginBottom: '16px',
          opacity: 0.7
        }}>
          Card Preview
        </div>

        {/* Card Preview */}
        <div style={{
          width: '100%',
          maxWidth: compact ? '280px' : '340px',
          position: 'relative'
        }}>
          <CardPreview
            cardType={cardType}
            fieldValues={allFieldValues}
            media={allMedia}
            theme={theme}
            compact={compact}
            mediaRecords={mediaRecords}
            deckDesignId={deckDesignId}
          />
        </div>
      </div>
    </div>
  );
}

export default CardPreviewPanel;
