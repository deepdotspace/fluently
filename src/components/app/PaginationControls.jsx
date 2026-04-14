import React from 'react';
import LucideIcon from './LucideIcon';

function PaginationControls({ 
  currentPage, 
  totalPages, 
  totalCards, 
  cardsPerPage,
  onPageChange, 
  theme,
  isMobile = false
}) {
  const startCard = (currentPage - 1) * cardsPerPage + 1;
  const endCard = Math.min(currentPage * cardsPerPage, totalCards);

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handleFirst = () => {
    onPageChange(1);
  };

  const handleLast = () => {
    onPageChange(totalPages);
  };

  if (totalPages <= 1) {
    return null;
  }

  if (isMobile) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        background: theme.cardBg,
        backdropFilter: `blur(${theme.backdropBlur})`,
        WebkitBackdropFilter: `blur(${theme.backdropBlur})`,
        borderTop: `1px solid ${theme.cardBorder}`,
        borderBottomLeftRadius: '12px',
        borderBottomRightRadius: '12px'
      }}>
        <div style={{
          fontSize: '12px',
          color: theme.textSecondary,
          fontWeight: '500'
        }}>
          {startCard}-{endCard} of {totalCards} cards
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          justifyContent: 'center'
        }}>
          <button
            onClick={handlePrevious}
            disabled={currentPage === 1}
            style={{
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: '600',
              borderRadius: '8px',
              border: `1px solid ${theme.cardBorder}`,
              background: currentPage === 1 ? 'rgba(0, 0, 0, 0.03)' : 'white',
              color: currentPage === 1 ? theme.textSecondary : theme.primary,
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 1 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <LucideIcon name="chevron-left" size={14} color="currentColor" />
            Prev
          </button>

          <div style={{
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: '700',
            color: theme.textPrimary,
            background: theme.primary + '15',
            borderRadius: '8px',
            border: `1px solid ${theme.primary}40`,
            textAlign: 'center',
            whiteSpace: 'nowrap'
          }}>
            {currentPage} / {totalPages}
          </div>

          <button
            onClick={handleNext}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: '600',
              borderRadius: '8px',
              border: `1px solid ${theme.cardBorder}`,
              background: currentPage === totalPages ? 'rgba(0, 0, 0, 0.03)' : 'white',
              color: currentPage === totalPages ? theme.textSecondary : theme.primary,
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage === totalPages ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Next
            <LucideIcon name="chevron-right" size={14} color="currentColor" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      background: theme.cardBg,
      backdropFilter: `blur(${theme.backdropBlur})`,
      WebkitBackdropFilter: `blur(${theme.backdropBlur})`,
      borderTop: `1px solid ${theme.cardBorder}`,
      borderBottomLeftRadius: '16px',
      borderBottomRightRadius: '16px'
    }}>
      <div style={{
        fontSize: '14px',
        color: theme.textSecondary,
        fontWeight: '500'
      }}>
        Showing {startCard}-{endCard} of {totalCards} cards
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <button
          onClick={handleFirst}
          disabled={currentPage === 1}
          title="First page"
          style={{
            padding: '8px 12px',
            fontSize: '14px',
            fontWeight: '600',
            borderRadius: '8px',
            border: `1px solid ${theme.cardBorder}`,
            background: currentPage === 1 ? 'rgba(0, 0, 0, 0.03)' : 'white',
            color: currentPage === 1 ? theme.textSecondary : theme.primary,
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage === 1 ? 0.5 : 1,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (currentPage !== 1) {
              e.currentTarget.style.background = theme.highlight;
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== 1) {
              e.currentTarget.style.background = 'white';
            }
          }}
        >
          <LucideIcon name="chevrons-left" size={16} color="currentColor" />
        </button>

        <button
          onClick={handlePrevious}
          disabled={currentPage === 1}
          title="Previous page"
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '600',
            borderRadius: '8px',
            border: `1px solid ${theme.cardBorder}`,
            background: currentPage === 1 ? 'rgba(0, 0, 0, 0.03)' : 'white',
            color: currentPage === 1 ? theme.textSecondary : theme.primary,
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage === 1 ? 0.5 : 1,
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          onMouseEnter={(e) => {
            if (currentPage !== 1) {
              e.currentTarget.style.background = theme.highlight;
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== 1) {
              e.currentTarget.style.background = 'white';
            }
          }}
        >
          <LucideIcon name="chevron-left" size={16} color="currentColor" />
          <span>Previous</span>
        </button>

        <div style={{
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: '700',
          color: theme.textPrimary,
          background: theme.primary + '15',
          borderRadius: '8px',
          border: `1px solid ${theme.primary}40`,
          minWidth: '120px',
          textAlign: 'center'
        }}>
          Page {currentPage} of {totalPages}
        </div>

        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          title="Next page"
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '600',
            borderRadius: '8px',
            border: `1px solid ${theme.cardBorder}`,
            background: currentPage === totalPages ? 'rgba(0, 0, 0, 0.03)' : 'white',
            color: currentPage === totalPages ? theme.textSecondary : theme.primary,
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            opacity: currentPage === totalPages ? 0.5 : 1,
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          onMouseEnter={(e) => {
            if (currentPage !== totalPages) {
              e.currentTarget.style.background = theme.highlight;
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== totalPages) {
              e.currentTarget.style.background = 'white';
            }
          }}
        >
          <span>Next</span>
          <LucideIcon name="chevron-right" size={16} color="currentColor" />
        </button>

        <button
          onClick={handleLast}
          disabled={currentPage === totalPages}
          title="Last page"
          style={{
            padding: '8px 12px',
            fontSize: '14px',
            fontWeight: '600',
            borderRadius: '8px',
            border: `1px solid ${theme.cardBorder}`,
            background: currentPage === totalPages ? 'rgba(0, 0, 0, 0.03)' : 'white',
            color: currentPage === totalPages ? theme.textSecondary : theme.primary,
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            opacity: currentPage === totalPages ? 0.5 : 1,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (currentPage !== totalPages) {
              e.currentTarget.style.background = theme.highlight;
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== totalPages) {
              e.currentTarget.style.background = 'white';
            }
          }}
        >
          <LucideIcon name="chevrons-right" size={16} color="currentColor" />
        </button>
      </div>
    </div>
  );
}

export default PaginationControls;
