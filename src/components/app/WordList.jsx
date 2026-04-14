import React, { useState, useEffect, useRef } from 'react';
import LucideIcon from './LucideIcon';

/**
 * WordList Component
 * Displays paginated list of words with multi-select functionality
 */
function WordList({ 
  words, 
  selectedWords, 
  onSelectWord, 
  onToggleSelect, 
  onSelectAll,
  onBatchCreate,
  currentPage,
  totalPages,
  onPageChange,
  startIndex,
  endIndex,
  totalItems,
  theme 
}) {
  const [hoveredWord, setHoveredWord] = useState(null);
  const listRef = useRef(null);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedWords.size > 0) {
        onSelectAll(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWords, onSelectAll]);

  const allSelected = words.length > 0 && words.every(w => selectedWords.has(w.word));

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      {/* Selection Controls */}
      {selectedWords.size > 0 && (
        <div style={{
          padding: '12px 16px',
          background: theme.primary + '15',
          border: `1px solid ${theme.primary}40`,
          borderRadius: '12px',
          marginBottom: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          animation: 'slideDown 0.2s ease'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{
              fontSize: '13px',
              fontWeight: '600',
              color: theme.textPrimary
            }}>
              {selectedWords.size} word{selectedWords.size !== 1 ? 's' : ''} selected
            </div>
            <button
              onClick={() => onSelectAll(false)}
              style={{
                padding: '4px 12px',
                background: 'transparent',
                border: `1px solid ${theme.textSecondary}40`,
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                color: theme.textSecondary,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = theme.textSecondary + '15';
                e.target.style.borderColor = theme.textSecondary;
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = theme.textSecondary + '40';
              }}
            >
              Clear
            </button>
          </div>
          <button
            onClick={() => {
              if (typeof onBatchCreate === 'function') {
                onBatchCreate();
              }
            }}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primary}dd 100%)`,
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: `0 4px 12px ${theme.primary}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = `0 6px 16px ${theme.primary}40`;
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = `0 4px 12px ${theme.primary}30`;
            }}
          >
            <LucideIcon name="plus" size={16} color="white" />
            Create {selectedWords.size} Card{selectedWords.size !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Select All Toggle */}
      <div style={{
        padding: '8px 16px',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: '500',
          color: theme.textSecondary,
          userSelect: 'none'
        }}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
            style={{
              width: '16px',
              height: '16px',
              cursor: 'pointer',
              accentColor: theme.primary
            }}
          />
          Select All (page)
        </label>
      </div>

      {/* Word List */}
      <div 
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          marginBottom: '12px'
        }}
      >
        {words.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: theme.textSecondary,
            fontSize: '14px'
          }}>
            No words found
          </div>
        ) : (
          words.map((word, index) => {
            const isSelected = selectedWords.has(word.word);
            const isHovered = hoveredWord === word.word;

            return (
              <div
                key={word.word + index}
                style={{
                  padding: '12px 16px',
                  marginBottom: '4px',
                  background: isSelected 
                    ? theme.primary + '10' 
                    : isHovered 
                      ? 'rgba(255, 255, 255, 0.5)' 
                      : 'transparent',
                  border: `1px solid ${isSelected ? theme.primary + '40' : 'transparent'}`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
                onClick={() => onSelectWord(word)}
                onMouseEnter={() => setHoveredWord(word.word)}
                onMouseLeave={() => setHoveredWord(null)}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleSelect(word.word);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: '16px',
                    height: '16px',
                    cursor: 'pointer',
                    accentColor: theme.primary,
                    flexShrink: 0
                  }}
                />

                {/* Word Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '8px',
                    marginBottom: '2px'
                  }}>
                    <span style={{
                      fontSize: '15px',
                      fontWeight: '600',
                      color: theme.textPrimary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {word.word}
                    </span>
                    {word.cefr_level && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        color: theme.textSecondary,
                        padding: '2px 6px',
                        background: theme.highlight,
                        borderRadius: '4px',
                        flexShrink: 0
                      }}>
                        {word.cefr_level}
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: theme.textSecondary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {word.english_translation}
                  </div>
                </div>

                {/* Arrow */}
                <div style={{
                  fontSize: '14px',
                  color: theme.textSecondary,
                  opacity: isHovered ? 1 : 0.3,
                  transition: 'opacity 0.15s ease',
                  flexShrink: 0
                }}>
                  <LucideIcon name="ChevronRight" size={14} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          border: `1px solid ${theme.cardBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          {/* Page Info */}
          <div style={{
            fontSize: '12px',
            color: theme.textSecondary,
            fontWeight: '500'
          }}>
            Showing {startIndex}-{endIndex} of {totalItems}
          </div>

          {/* Page Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              style={{
                padding: '6px 12px',
                background: currentPage === 1 ? 'transparent' : 'rgba(255, 255, 255, 0.7)',
                border: `1px solid ${theme.cardBorder}`,
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '500',
                color: currentPage === 1 ? theme.textSecondary + '60' : theme.textPrimary,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: currentPage === 1 ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (currentPage !== 1) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.9)';
                  e.target.style.borderColor = theme.primary + '40';
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== 1) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.7)';
                  e.target.style.borderColor = theme.cardBorder;
                }
              }}
            >
              <LucideIcon name="ChevronLeft" size={14} color="currentColor" />
            </button>

            {/* Page Numbers */}
            <div style={{
              fontSize: '13px',
              fontWeight: '600',
              color: theme.textPrimary,
              padding: '0 8px'
            }}>
              {currentPage} / {totalPages}
            </div>

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              style={{
                padding: '6px 12px',
                background: currentPage === totalPages ? 'transparent' : 'rgba(255, 255, 255, 0.7)',
                border: `1px solid ${theme.cardBorder}`,
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '500',
                color: currentPage === totalPages ? theme.textSecondary + '60' : theme.textPrimary,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: currentPage === totalPages ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (currentPage !== totalPages) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.9)';
                  e.target.style.borderColor = theme.primary + '40';
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== totalPages) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.7)';
                  e.target.style.borderColor = theme.cardBorder;
                }
              }}
            >
              <LucideIcon name="ChevronRight" size={14} color="currentColor" />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
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

export default WordList;

