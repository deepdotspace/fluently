import React, { useCallback, useMemo, useState } from 'react';
import LucideIcon from './LucideIcon';

const stripPlaceholders = (text = '') => text.replace(/\[IMAGE:\d+\]|\[AUDIO:\d+\]/g, '');

const adjustPlaceholders = (text = '', type, removedIndex) => text.replace(new RegExp(`\\[${type}:(\\d+)\\]`, 'g'), (match, num) => {
  const idx = parseInt(num, 10);
  if (idx === removedIndex) return '';
  if (idx > removedIndex) return `[${type}:${idx - 1}]`;
  return match;
});

function GeneratedCardsPanel({
  generatedCards,
  setGeneratedCards,
  currentTheme,
  onSave,
  onStartOver,
  generateImageForCard,
  generateAudioForCard,
  setMediaNotification
}) {
  const [expandedCardIndex, setExpandedCardIndex] = useState(null);
  const [expandedFrontText, setExpandedFrontText] = useState('');
  const [expandedBackText, setExpandedBackText] = useState('');
  const [expandedTags, setExpandedTags] = useState('');
  const [expandedCardType, setExpandedCardType] = useState('Basic');
  const [expandedFrontMedia, setExpandedFrontMedia] = useState({ images: [], audio: [] });
  const [expandedBackMedia, setExpandedBackMedia] = useState({ images: [], audio: [] });
  const [regeneratingMedia, setRegeneratingMedia] = useState(null);

  const handleExpandCard = useCallback((idx) => {
    const card = generatedCards[idx];
    setExpandedCardIndex(idx);
    setExpandedFrontText(card.front || '');
    setExpandedBackText(card.back || '');
    setExpandedTags(card.tags?.join(', ') || '');
    setExpandedCardType(card.type || 'Basic');
    setExpandedFrontMedia(card.frontMedia || { images: [], audio: [] });
    setExpandedBackMedia(card.backMedia || { images: [], audio: [] });
  }, [generatedCards]);

  const handleUpdateExpandedCard = useCallback(() => {
    if (expandedCardIndex === null) return;
    const updatedCard = {
      ...generatedCards[expandedCardIndex],
      front: expandedFrontText,
      back: expandedBackText,
      tags: expandedTags.split(',').map(t => t.trim()).filter(Boolean),
      type: expandedCardType,
      frontMedia: expandedFrontMedia,
      backMedia: expandedBackMedia
    };
    setGeneratedCards(prev => prev.map((card, idx) => idx === expandedCardIndex ? updatedCard : card));
    setExpandedCardIndex(null);
  }, [expandedBackMedia, expandedBackText, expandedCardIndex, expandedCardType, expandedFrontMedia, expandedFrontText, expandedTags, generatedCards, setGeneratedCards]);

  const handleCancelExpandedCard = useCallback(() => {
    setExpandedCardIndex(null);
  }, []);

  const removeGeneratedCard = useCallback((id) => {
    setGeneratedCards(prev => prev.filter(card => card.id !== id));
    if (expandedCardIndex !== null) {
      setExpandedCardIndex(null);
    }
  }, [expandedCardIndex, setGeneratedCards]);

  const handleRegenerateImage = useCallback(async (side, index) => {
    if (expandedCardIndex === null) return;
    setRegeneratingMedia({ type: 'image', side, index });
    try {
      const cardData = {
        front: expandedFrontText,
        back: expandedBackText,
        type: expandedCardType
      };
      let prompt = 'Generate mnemonic image for: {word}';
      if (cardData.front) {
        const word = cardData.front.replace(/\*\*/g, '').replace(/\*/g, '').split(' ')[0];
        prompt = prompt.replace(/\{word\}/g, word);
      }
      if (cardData.back) {
        const translation = cardData.back.replace(/\*\*/g, '').replace(/\*/g, '').split('.')[0].split('\n')[0];
        prompt = prompt.replace(/\{translation\}/g, translation);
      }
      const imageUrl = await generateImageForCard(prompt, cardData);
      if (imageUrl) {
        if (side === 'front') {
          const next = { ...expandedFrontMedia };
          next.images[index] = imageUrl;
          setExpandedFrontMedia(next);
        } else {
          const next = { ...expandedBackMedia };
          next.images[index] = imageUrl;
          setExpandedBackMedia(next);
        }
        setMediaNotification?.({ type: 'success', message: 'Image generated successfully' });
        setTimeout(() => setMediaNotification?.(null), 2000);
      } else {
        setMediaNotification?.({ type: 'error', message: 'Image generation failed' });
        setTimeout(() => setMediaNotification?.(null), 2000);
      }
    } finally {
      setRegeneratingMedia(null);
    }
  }, [expandedBackMedia, expandedBackText, expandedCardIndex, expandedCardType, expandedFrontMedia, expandedFrontText, generateImageForCard, setMediaNotification]);

  const handleRegenerateAudio = useCallback(async (side, index) => {
    if (expandedCardIndex === null) return;
    setRegeneratingMedia({ type: 'audio', side, index });
    try {
      const cardData = {
        front: expandedFrontText,
        back: expandedBackText,
        type: expandedCardType
      };
      let prompt = 'Pronounce: {word}';
      if (cardData.front) {
        const word = cardData.front.replace(/\*\*/g, '').replace(/\*/g, '').split(' ')[0];
        prompt = prompt.replace(/\{word\}/g, word);
      }
      if (cardData.back) {
        const translation = cardData.back.replace(/\*\*/g, '').replace(/\*/g, '').split('.')[0].split('\n')[0];
        prompt = prompt.replace(/\{translation\}/g, translation);
      }
      const audioUrl = await generateAudioForCard(prompt, cardData);
      if (audioUrl) {
        if (side === 'front') {
          const next = { ...expandedFrontMedia };
          next.audio[index] = audioUrl;
          setExpandedFrontMedia(next);
        } else {
          const next = { ...expandedBackMedia };
          next.audio[index] = audioUrl;
          setExpandedBackMedia(next);
        }
        setMediaNotification?.({ type: 'success', message: 'Audio generated successfully' });
        setTimeout(() => setMediaNotification?.(null), 2000);
      } else {
        setMediaNotification?.({ type: 'error', message: 'Audio generation failed' });
        setTimeout(() => setMediaNotification?.(null), 2000);
      }
    } finally {
      setRegeneratingMedia(null);
    }
  }, [expandedBackMedia, expandedBackText, expandedCardIndex, expandedCardType, expandedFrontMedia, expandedFrontText, generateAudioForCard, setMediaNotification]);

  const mediaButton = (label, onClick, disabled) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '36px',
        height: '36px',
        background: currentTheme.primary,
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
        boxShadow: `0 2px 4px ${currentTheme.primary}40`,
        opacity: disabled ? 0.7 : 1
      }}
      title={label}
    >
      {disabled ? (
        <span style={{
          display: 'inline-block',
          width: '16px',
          height: '16px',
          border: '2px solid rgba(255,255,255,0.3)',
          borderTopColor: 'white',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
      ) : <LucideIcon name="RefreshCw" size={16} />}
    </button>
  );

  const renderMediaList = useCallback((items, side, type) => {
    const isImage = type === 'image';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {items.map((url, index) => (
          <div key={`${side}-${type}-${index}`} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '16px',
            background: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '12px',
            border: `1px solid ${currentTheme.cardBorder}`
          }}>
            {isImage ? (
              <img
                src={url}
                alt={`${side} image ${index + 1}`}
                style={{
                  width: '120px',
                  height: '120px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: `1px solid ${currentTheme.cardBorder}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              />
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  const audio = new Audio(url);
                  audio.play().catch(() => { });
                }}
                style={{
                  width: '120px',
                  height: '120px',
                  background: `${currentTheme.primary}15`,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid ${currentTheme.cardBorder}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  color: currentTheme.primary
                }}
              >
                <LucideIcon name="Volume2" size={48} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {mediaButton('Regenerate', () => isImage ? handleRegenerateImage(side, index) : handleRegenerateAudio(side, index),
                regeneratingMedia?.type === type && regeneratingMedia?.side === side && regeneratingMedia?.index === index)}
              <button
                onClick={() => {
                  if (side === 'front') {
                    if (isImage) {
                      setExpandedFrontMedia(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
                      setExpandedFrontText(prev => adjustPlaceholders(prev, 'IMAGE', index));
                    } else {
                      setExpandedFrontMedia(prev => ({ ...prev, audio: prev.audio.filter((_, i) => i !== index) }));
                      setExpandedFrontText(prev => adjustPlaceholders(prev, 'AUDIO', index));
                    }
                  } else {
                    if (isImage) {
                      setExpandedBackMedia(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
                      setExpandedBackText(prev => adjustPlaceholders(prev, 'IMAGE', index));
                    } else {
                      setExpandedBackMedia(prev => ({ ...prev, audio: prev.audio.filter((_, i) => i !== index) }));
                      setExpandedBackText(prev => adjustPlaceholders(prev, 'AUDIO', index));
                    }
                  }
                }}
                style={{
                  width: '36px',
                  height: '36px',
                  background: '#EF4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '18px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)'
                }}
                title="Remove"
              >
                <LucideIcon name="X" size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }, [currentTheme.cardBorder, currentTheme.primary, handleRegenerateAudio, handleRegenerateImage, regeneratingMedia]);

  const collapsedCards = useMemo(() => generatedCards.map((card, idx) => {
    const isExpanded = expandedCardIndex === idx;
    if (isExpanded) {
      return (
        <div key={card.id} style={{
          background: 'rgba(255, 255, 255, 0.8)',
          border: `2px solid ${currentTheme.primary}`,
          borderRadius: '16px',
          padding: '24px',
          boxShadow: `0 8px 32px ${currentTheme.primary}20`
        }}>
          <div
            onClick={() => handleCancelExpandedCard()}
            style={{
              background: 'rgba(255, 255, 255, 0.6)',
              border: `1px solid ${currentTheme.cardBorder}`,
              borderRadius: '12px',
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: '48px',
              marginBottom: '20px'
            }}
          >
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: currentTheme.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '600',
                color: 'white'
              }}>
                {idx + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: currentTheme.textPrimary,
                  marginBottom: '2px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {stripPlaceholders(card.front || '').substring(0, 60)}
                </div>
                {card.type !== 'Cloze' && card.back && (
                  <div style={{
                    fontSize: '12px',
                    color: currentTheme.textSecondary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {stripPlaceholders(card.back || '').substring(0, 60)}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
              <span style={{
                fontSize: '12px',
                color: currentTheme.textSecondary,
                padding: '4px 8px',
                background: 'rgba(0,0,0,0.05)',
                borderRadius: '6px',
                textTransform: 'capitalize'
              }}>
                {card.type === 'BasicReversed' ? 'Basic + Rev' : card.type}
              </span>
              <button
                onClick={() => removeGeneratedCard(card.id)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#EF4444',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
              >
                <LucideIcon name="X" size={14} />
              </button>
            </div>
          </div>

          <div style={{ paddingTop: '20px', borderTop: `1px solid ${currentTheme.cardBorder}` }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '20px' }}>
              <button
                onClick={handleCancelExpandedCard}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(255, 255, 255, 0.7)',
                  color: currentTheme.textSecondary,
                  border: `1px solid ${currentTheme.cardBorder}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateExpandedCard}
                style={{
                  padding: '8px 16px',
                  background: currentTheme.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  boxShadow: `0 2px 8px ${currentTheme.primary}40`
                }}
              >
                Save Changes
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: currentTheme.textPrimary,
                marginBottom: '12px'
              }}>
                Card Type
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { value: 'Basic', label: 'Basic' },
                  { value: 'BasicReversed', label: 'Basic + Reversed' },
                  { value: 'Cloze', label: 'Cloze' }
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setExpandedCardType(value)}
                    style={{
                      padding: '8px 16px',
                      background: expandedCardType === value ? currentTheme.primary : 'rgba(255, 255, 255, 0.7)',
                      color: expandedCardType === value ? 'white' : currentTheme.textPrimary,
                      border: expandedCardType === value ? 'none' : `1px solid ${currentTheme.cardBorder}`,
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: currentTheme.textPrimary,
                marginBottom: '8px'
              }}>
                {expandedCardType === 'Cloze' ? 'Text (use {{word}} for blanks)' : 'Front Text'}
              </label>
              {expandedCardType === 'Cloze' ? (
                <textarea
                  value={expandedFrontText}
                  onChange={(e) => setExpandedFrontText(e.target.value)}
                  placeholder="Enter text with {{blanks}}... Example: The capital of France is {{Paris}}."
                  style={{
                    width: '100%',
                    minHeight: '120px',
                    padding: '16px',
                    fontSize: '15px',
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.9)',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    color: currentTheme.textPrimary,
                    lineHeight: '1.5'
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={expandedFrontText}
                  onChange={(e) => setExpandedFrontText(e.target.value)}
                  placeholder="Front side..."
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '15px',
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.9)',
                    boxSizing: 'border-box',
                    color: currentTheme.textPrimary
                  }}
                />
              )}
            </div>

            {expandedCardType !== 'Cloze' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: currentTheme.textPrimary,
                  marginBottom: '8px'
                }}>
                  Back Text
                </label>
                <textarea
                  value={expandedBackText}
                  onChange={(e) => setExpandedBackText(e.target.value)}
                  placeholder="Back side..."
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '16px',
                    fontSize: '15px',
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.9)',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    color: currentTheme.textPrimary,
                    lineHeight: '1.5'
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: currentTheme.textPrimary,
                marginBottom: '8px'
              }}>
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={expandedTags}
                onChange={(e) => setExpandedTags(e.target.value)}
                placeholder="e.g., grammar, unit-1, difficult"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '14px',
                  border: `1px solid ${currentTheme.cardBorder}`,
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.9)',
                  boxSizing: 'border-box',
                  color: currentTheme.textPrimary
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              {expandedFrontMedia.images.length > 0 && renderMediaList(expandedFrontMedia.images, 'front', 'image')}
              {expandedFrontMedia.audio.length > 0 && renderMediaList(expandedFrontMedia.audio, 'front', 'audio')}
              {expandedBackMedia.images.length > 0 && renderMediaList(expandedBackMedia.images, 'back', 'image')}
              {expandedBackMedia.audio.length > 0 && renderMediaList(expandedBackMedia.audio, 'back', 'audio')}
            </div>

            {expandedCardType === 'Cloze' && (
              <div style={{
                padding: '12px 16px',
                background: `${currentTheme.primary}15`,
                borderRadius: '8px',
                fontSize: '13px',
                color: currentTheme.textSecondary,
                border: `1px solid ${currentTheme.primary}30`
              }}>
                <strong>Cloze Format:</strong> Use double curly braces like {'{{word}}'} to create blanks. The back side will be automatically generated from the blanks.
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        key={card.id}
        onClick={() => handleExpandCard(idx)}
        style={{
          background: 'rgba(255, 255, 255, 0.6)',
          border: `1px solid ${currentTheme.cardBorder}`,
          borderRadius: '12px',
          padding: '16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '48px'
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: currentTheme.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: '600',
            color: 'white'
          }}>
            {idx + 1}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '500',
              color: currentTheme.textPrimary,
              marginBottom: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {stripPlaceholders(card.front || '').substring(0, 60) || 'No front text'}
            </div>
            {card.type !== 'Cloze' && card.back && (
              <div style={{
                fontSize: '12px',
                color: currentTheme.textSecondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {stripPlaceholders(card.back || '').substring(0, 60)}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
          <span style={{
            fontSize: '12px',
            color: currentTheme.textSecondary,
            padding: '4px 8px',
            background: 'rgba(0,0,0,0.05)',
            borderRadius: '6px',
            textTransform: 'capitalize'
          }}>
            {card.type === 'BasicReversed' ? 'Basic + Rev' : card.type}
          </span>
          <button
            onClick={() => removeGeneratedCard(card.id)}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: 'none',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#EF4444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
          >
            ×
          </button>
        </div>
      </div>
    );
  }), [currentTheme.cardBorder, currentTheme.primary, currentTheme.textPrimary, currentTheme.textSecondary, expandedCardIndex, generatedCards, handleCancelExpandedCard, handleExpandCard, handleUpdateExpandedCard, removeGeneratedCard, renderMediaList]);

  return (
    <div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginBottom: '28px',
        maxHeight: '500px',
        overflowY: 'auto'
      }}>
        {collapsedCards}
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={onSave}
          style={{
            padding: '16px 32px',
            background: `linear-gradient(135deg, ${currentTheme.primary} 0%, ${currentTheme.textSecondary} 100%)`,
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: `0 4px 20px ${currentTheme.primary}40`,
            transition: 'all 0.3s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <LucideIcon name="Check" size={18} /> Save All Cards
        </button>
        <button
          onClick={onStartOver}
          style={{
            padding: '16px 32px',
            background: 'rgba(255, 255, 255, 0.7)',
            color: currentTheme.textPrimary,
            border: `1px solid ${currentTheme.cardBorder}`,
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Start Over
        </button>
      </div>
    </div>
  );
}

export default GeneratedCardsPanel;

