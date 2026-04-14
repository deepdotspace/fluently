import React from 'react';
import LucideIcon from './LucideIcon';

/**
 * WordDetail Component
 * Displays detailed information about a selected word
 */
function WordDetail({ word, theme, onCreateCard }) {

  if (!word) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: theme.textSecondary,
        fontSize: '14px',
        textAlign: 'center',
        padding: '40px'
      }}>
        Select a word to view details
      </div>
    );
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      animation: 'fadeIn 0.3s ease'
    }}>
      {/* Word Header */}
      <div style={{
        padding: '24px',
        background: 'rgba(255, 255, 255, 0.6)',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        border: `1px solid ${theme.cardBorder}`,
        marginBottom: '16px'
      }}>
        {/* Word */}
        <h2 style={{
          fontSize: '32px',
          fontWeight: '600',
          color: theme.textPrimary,
          margin: 0,
          marginBottom: '12px',
          letterSpacing: '-0.02em'
        }}>
          {word.word}
        </h2>

        {/* Translation */}
        <div style={{
          fontSize: '20px',
          color: theme.primary,
          fontWeight: '500',
          marginBottom: '16px'
        }}>
          {word.english_translation}
        </div>

        {/* Metadata */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center'
        }}>
          {word.pos && (
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              color: theme.textSecondary,
              padding: '4px 10px',
              background: theme.highlight,
              borderRadius: '6px',
              textTransform: 'capitalize'
            }}>
              {word.pos}
            </span>
          )}
          {word.cefr_level && (
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              color: theme.textPrimary,
              padding: '4px 10px',
              background: theme.primary + '15',
              borderRadius: '6px'
            }}>
              Level: {word.cefr_level}
            </span>
          )}
          {word.word_frequency && (
            <span style={{
              fontSize: '12px',
              fontWeight: '500',
              color: theme.textSecondary,
              padding: '4px 10px',
              background: 'rgba(255, 255, 255, 0.5)',
              borderRadius: '6px'
            }}>
              Freq: #{word.word_frequency}
            </span>
          )}
        </div>
      </div>

      {/* Example Sentence */}
      {(word.example_sentence_native || word.example_sentence_english) && (
        <div style={{
          padding: '20px',
          background: 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(10px)',
          borderRadius: '14px',
          border: `1px solid ${theme.cardBorder}`,
          marginBottom: '16px'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: '600',
            color: theme.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '12px',
            opacity: 0.7
          }}>
            Example
          </div>
          {word.example_sentence_native && (
            <div style={{
              fontSize: '16px',
              color: theme.textPrimary,
              fontWeight: '500',
              marginBottom: '8px',
              lineHeight: '1.6'
            }}>
              "{word.example_sentence_native}"
            </div>
          )}
          {word.example_sentence_english && (
            <div style={{
              fontSize: '14px',
              color: theme.textSecondary,
              fontWeight: '400',
              lineHeight: '1.6'
            }}>
              "{word.example_sentence_english}"
            </div>
          )}
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Create Card Button */}
      <button
        onClick={() => onCreateCard([word])}
        style={{
          width: '100%',
          padding: '16px 24px',
          background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primary}dd 100%)`,
          border: 'none',
          borderRadius: '14px',
          color: '#ffffff',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: `0 8px 24px ${theme.primary}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'translateY(-2px)';
          e.target.style.boxShadow = `0 12px 32px ${theme.primary}40`;
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = `0 8px 24px ${theme.primary}30`;
        }}
      >
        <LucideIcon name="Plus" size={18} />
        Create Card
      </button>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default WordDetail;

