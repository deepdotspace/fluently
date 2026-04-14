import React, { useState, useRef, useEffect } from 'react';

const CARD_TYPES = [
  { value: 'Basic', label: 'Basic', desc: 'Standard question and answer cards' },
  { value: 'BasicReversed', label: 'Basic + Reversed', desc: 'Creates both normal and reversed cards' },
  { value: 'Cloze', label: 'Cloze', desc: 'Fill-in-the-blank cards (only front text needed)' }
];

function BulkTypeSelector({ bulkCardTypes, setBulkCardTypes, currentTheme, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{ marginBottom: '24px', position: 'relative' }} ref={dropdownRef}>
      <label style={{
        display: 'block',
        fontSize: '14px',
        fontWeight: '600',
        color: currentTheme.textPrimary,
        marginBottom: '10px',
        letterSpacing: '0.3px'
      }}>
        Card Types (Select Multiple)
      </label>

      <button
        onClick={(e) => {
          if (disabled) return;
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '14px 18px',
          fontSize: '15px',
          background: disabled ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.5)',
          border: `1px solid ${currentTheme.cardBorder}`,
          borderRadius: '12px',
          color: disabled ? currentTheme.textSecondary : currentTheme.textPrimary,
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          marginBottom: '8px',
          opacity: disabled ? 0.6 : 1
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {bulkCardTypes.length === 0
            ? 'Select card types...'
            : bulkCardTypes.map(t => t === 'BasicReversed' ? 'Basic + Reversed' : t).join(', ')}
        </span>
        <span style={{ fontSize: '12px', opacity: 0.6 }}>
          {isOpen ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'white',
          border: `1px solid ${currentTheme.cardBorder}`,
          borderRadius: '16px',
          padding: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginTop: '4px'
        }}>
          {CARD_TYPES.map(({ value, label, desc }) => (
            <label
              key={value}
              onClick={(e) => e.stopPropagation()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                background: bulkCardTypes.includes(value) ? `${currentTheme.primary}15` : 'transparent',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!bulkCardTypes.includes(value)) {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
                }
              }}
              onMouseLeave={(e) => {
                if (!bulkCardTypes.includes(value)) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <input
                type="checkbox"
                checked={bulkCardTypes.includes(value)}
                disabled={disabled}
                onChange={(e) => {
                  if (disabled) return;
                  if (e.target.checked) {
                    setBulkCardTypes([...bulkCardTypes, value]);
                  } else {
                    setBulkCardTypes(bulkCardTypes.filter(t => t !== value));
                  }
                }}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.5 : 1
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: currentTheme.textPrimary
                }}>
                  {label}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: currentTheme.textSecondary,
                  opacity: 0.7
                }}>
                  {desc}
                </div>
              </div>
            </label>
          ))}
        </div>
      )}

      {bulkCardTypes.length === 0 && (
        <div style={{
          padding: '12px 16px',
          marginTop: '12px',
          marginBottom: '16px',
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#EF4444',
          border: '1px solid #EF4444'
        }}>
          Please select at least one card type.
        </div>
      )}
    </div>
  );
}

export default BulkTypeSelector;

