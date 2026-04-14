import React, { useState, useMemo, useCallback } from 'react';
import RichTextRenderer from './RichTextRenderer';
import { renderCardTemplate, getDefaultCardTypes } from '../../utils/fieldSystem';
import { getDesignContainerStyles } from '../../utils/cardDesigns';

/**
 * CardPreview - Live preview component that shows how the card will look during review.
 * Features:
 * - 3D flip animation
 * - Real-time content updates
 * - Template-based rendering using card types
 * - Responsive sizing
 */
function CardPreview({
  // New API: card type based
  cardType = null,
  fieldValues = {},
  media = { images: [], audio: [] },
  deckDesignId = null, // Design ID from deck
  // Legacy API: for backward compatibility
  frontText = '',
  backText = '',
  frontMedia = { images: [], audio: [] },
  backMedia = { images: [], audio: [] },
  customFields = {},
  template = null,
  theme,
  compact = false,
  mediaRecords = null
}) {
  const [flipped, setFlipped] = useState(false);
  
  // Get active card type (use provided or default)
  const activeCardType = useMemo(() => {
    if (cardType) return cardType;
    // Fallback to default basic type
    const defaults = getDefaultCardTypes();
    return defaults.basic;
  }, [cardType]);
  
  // Combine field values (support both new and legacy API)
  const allFieldValues = useMemo(() => {
    if (Object.keys(fieldValues).length > 0) {
      return fieldValues;
    }
    // Legacy: convert frontText/backText to field values
    return {
      Front: frontText,
      Back: backText,
      ...customFields
    };
  }, [fieldValues, frontText, backText, customFields]);
  
  // Combine media (support both new and legacy API)
  const allMedia = useMemo(() => {
    if (media?.images?.length > 0 || media?.audio?.length > 0) {
      return media;
    }
    // Legacy: combine front and back media
    return {
      images: [...(frontMedia?.images || []), ...(backMedia?.images || [])],
      audio: [...(frontMedia?.audio || []), ...(backMedia?.audio || [])]
    };
  }, [media, frontMedia, backMedia]);
  
  // Render front and back content using card type template
  const renderedFront = useMemo(() => {
    if (activeCardType?.frontTemplate) {
      return renderCardTemplate(activeCardType.frontTemplate, allFieldValues, null);
    }
    return frontText || Object.values(allFieldValues)[0] || '';
  }, [activeCardType, allFieldValues, frontText]);
  
  const renderedBack = useMemo(() => {
    if (activeCardType?.backTemplate) {
      return renderCardTemplate(activeCardType.backTemplate, allFieldValues, activeCardType.frontTemplate);
    }
    return backText || Object.values(allFieldValues)[1] || '';
  }, [activeCardType, allFieldValues, backText]);
  
  // Check if content is empty
  const isEmpty = useMemo(() => {
    return !renderedFront.trim() && !renderedBack.trim();
  }, [renderedFront, renderedBack]);
  
  // Handle flip
  const handleFlip = useCallback(() => {
    setFlipped(prev => !prev);
  }, []);
  
  // Card dimensions
  const cardHeight = compact ? 280 : 360;
  const cardWidth = '100%';
  
  // Inline styles for the template CSS
  const templateStyles = useMemo(() => {
    if (!activeCardType?.css) return '';
    return activeCardType.css;
  }, [activeCardType]);
  
  return (
    <div 
      className="card-preview-container"
      style={{
        width: cardWidth,
        height: cardHeight,
        perspective: '1000px',
        cursor: 'pointer'
      }}
      onClick={handleFlip}
    >
      {/* Template CSS - Only for non-card-side styles */}
      <style>{`
        .card-preview-inner .rich-text-content {
          text-align: center;
        }
      `}</style>
      
      {/* 3D Flip Container */}
      <div
        className="card-preview-inner"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
        }}
      >
        {/* Front Side */}
        <CardSide
          side="front"
          content={renderedFront}
          media={allMedia}
          theme={theme}
          isFlipped={false}
          isEmpty={!renderedFront.trim()}
          compact={compact}
          mediaRecords={mediaRecords}
          deckDesignId={deckDesignId}
        />
        
        {/* Back Side */}
        <CardSide
          side="back"
          content={renderedBack}
          media={allMedia}
          theme={theme}
          isFlipped={true}
          isEmpty={!renderedBack.trim()}
          compact={compact}
          mediaRecords={mediaRecords}
          deckDesignId={deckDesignId}
        />
      </div>
      
      {/* Flip Hint */}
      <div
        style={{
          position: 'absolute',
          bottom: '-28px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '12px',
          color: theme?.textSecondary || '#6b7280',
          fontWeight: '500',
          opacity: 0.7,
          whiteSpace: 'nowrap'
        }}
      >
        Click to flip
      </div>
    </div>
  );
}

/**
 * CardSide - Individual card side (front or back)
 */
function CardSide({ side, content, media, theme, isFlipped, isEmpty, compact, mediaRecords, deckDesignId }) {
  // Get design styles from deck
  const designStyles = useMemo(() => {
    return getDesignContainerStyles(deckDesignId);
  }, [deckDesignId]);

  // Merge design styles with default styles
  const mergedStyles = useMemo(() => {
    const baseStyles = {
      position: 'absolute',
      width: '100%',
      height: '100%',
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden',
      transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      borderRadius: '16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflowY: 'auto',
      overflowX: 'hidden',
      boxSizing: 'border-box',
      padding: compact ? '20px 16px 32px' : '28px 24px 40px',
      // Default fallbacks
      background: theme?.cardBg || 'rgba(255, 255, 255, 0.8)',
      backdropFilter: `blur(${theme?.backdropBlur || '20px'})`,
      WebkitBackdropFilter: `blur(${theme?.backdropBlur || '20px'})`,
      border: `1px solid ${theme?.cardBorder || 'rgba(0, 0, 0, 0.08)'}`,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
    };

    // Apply deck design styles (override defaults)
    if (designStyles && Object.keys(designStyles).length > 0) {
      Object.assign(baseStyles, designStyles);
    }

    return baseStyles;
  }, [designStyles, theme, isFlipped, compact]);

  return (
    <div
      className="card-side"
      style={mergedStyles}
    >
      {/* Side Label */}
      <div
        style={{
          position: 'absolute',
          top: compact ? '12px' : '16px',
          left: compact ? '12px' : '16px',
          fontSize: '10px',
          fontWeight: '600',
          color: theme?.textSecondary || '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          opacity: 0.6
        }}
      >
        {side}
      </div>
      
      {/* Content */}
      <div
        style={{
          width: '100%',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: compact ? '16px' : '24px',
          fontSize: compact ? '16px' : '20px',
          color: theme?.textPrimary || '#1f2937',
          textAlign: 'center',
          lineHeight: '1.5',
          background: 'transparent',
          position: 'relative',
          zIndex: 1
        }}
      >
        {isEmpty ? (
          <div
            style={{
              color: theme?.textSecondary || '#9ca3af',
              fontStyle: 'italic',
              fontSize: compact ? '14px' : '16px'
            }}
          >
            {side === 'front' ? 'Enter front text...' : 'Enter back text...'}
          </div>
        ) : (
          <RichTextRenderer
            html={content}
            media={media}
            mediaRecords={mediaRecords}
            theme={theme}
          />
        )}
      </div>
    </div>
  );
}

export default CardPreview;

