import React, { useState, useEffect, useRef, useMemo } from 'react';
import LucideIcon from './LucideIcon';

function CustomDropdown({ value, options, onChange, placeholder, theme, style, fontSize, padding, dropUp = false, searchable = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchable && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const selectedOption = value ? options.find(opt => opt.value === value) : null;
  const selectedLabel = selectedOption?.label || (value ? value.charAt(0).toUpperCase() + value.slice(1) : placeholder);
  const selectedFontFamily = selectedOption?.fontFamily;

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(opt => opt.label.toLowerCase().includes(term));
  }, [options, searchTerm, searchable]);

  const hexToRgba = (hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    const next = !isOpen;
    setIsOpen(next);
    if (!next) setSearchTerm('');
  };

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  const triggerStyle = {
    width: '100%',
    padding: padding || '12px 16px',
    paddingRight: '40px',
    background: theme.cardBg,
    border: `1px solid ${isOpen ? theme.primary : theme.cardBorder}`,
    borderRadius: '12px',
    color: theme.textPrimary,
    fontSize: fontSize || '14px',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.2s',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: isOpen ? `0 0 0 3px ${hexToRgba(theme.primary, 0.2)}` : 'none'
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', ...style }} onClick={(e) => e.stopPropagation()}>
      {searchable && isOpen ? (
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={selectedLabel || placeholder}
            style={{
              ...triggerStyle,
              cursor: 'text',
              fontFamily: 'inherit',
              fontWeight: '500',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsOpen(false);
                setSearchTerm('');
              }
            }}
          />
          <span style={{
            position: 'absolute',
            right: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: theme.textSecondary,
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none'
          }}>
            <LucideIcon name="search" size={14} />
          </span>
        </div>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          style={triggerStyle}
          onMouseEnter={(e) => {
            if (!isOpen) e.currentTarget.style.borderColor = theme.primary;
          }}
          onMouseLeave={(e) => {
            if (!isOpen) e.currentTarget.style.borderColor = theme.cardBorder;
          }}
        >
          <span style={{
            color: value ? theme.textPrimary : theme.textSecondary,
            fontWeight: value ? '500' : '400',
            fontFamily: selectedFontFamily || 'inherit'
          }}>
            {selectedLabel}
          </span>
          <span style={{
            position: 'absolute',
            right: '16px',
            color: theme.textSecondary,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            display: 'flex',
            alignItems: 'center'
          }}>
            <LucideIcon name="ChevronDown" size={14} />
          </span>
        </button>
      )}

      {isOpen && (
        <div style={{
          position: 'absolute',
          ...(dropUp
            ? { bottom: '100%', marginBottom: '8px' }
            : { top: '100%', marginTop: '8px' }),
          left: 0,
          right: 0,
          background: '#ffffff',
          opacity: 1,
          border: `1px solid ${theme.cardBorder}`,
          borderRadius: '12px',
          boxShadow: `0 8px 32px ${hexToRgba(theme.primary, 0.15)}, 0 4px 16px rgba(0, 0, 0, 0.1)`,
          zIndex: 1000,
          maxHeight: '250px',
          overflowY: 'auto',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none'
        }}>
          {!searchable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(null);
              }}
              style={{
                width: '100%',
                padding: padding || '12px 16px',
                background: value === null ? hexToRgba(theme.primary, 0.1) : 'transparent',
                border: 'none',
                color: value === null ? theme.primary : theme.textPrimary,
                fontSize: fontSize || '14px',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: value === null ? '600' : '400',
                transition: 'all 0.15s',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px'
              }}
              onMouseEnter={(e) => {
                if (value !== null) {
                  e.currentTarget.style.background = hexToRgba(theme.primary, 0.1);
                  e.currentTarget.style.color = theme.primary;
                }
              }}
              onMouseLeave={(e) => {
                if (value !== null) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = theme.textPrimary;
                }
              }}
            >
              {placeholder}
            </button>
          )}
          {filteredOptions.length === 0 && searchable && (
            <div style={{
              padding: padding || '12px 16px',
              fontSize: fontSize || '14px',
              color: theme.textSecondary,
              textAlign: 'center'
            }}>
              No matches found
            </div>
          )}
          {filteredOptions.map((option, idx) => (
            <button
              key={option.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(option.value);
              }}
              style={{
                width: '100%',
                padding: padding || '12px 16px',
                background: value === option.value ? hexToRgba(theme.primary, 0.1) : 'transparent',
                border: 'none',
                color: value === option.value ? theme.primary : theme.textPrimary,
                fontSize: fontSize || '14px',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: value === option.value ? '600' : '400',
                transition: 'all 0.15s',
                borderTop: idx === 0 && searchable ? 'none' : `1px solid ${theme.cardBorder}20`,
                borderTopLeftRadius: idx === 0 ? '12px' : 0,
                borderTopRightRadius: idx === 0 ? '12px' : 0,
                fontFamily: option.fontFamily || 'inherit'
              }}
              onMouseEnter={(e) => {
                if (value !== option.value) {
                  e.currentTarget.style.background = hexToRgba(theme.primary, 0.1);
                  e.currentTarget.style.color = theme.primary;
                }
              }}
              onMouseLeave={(e) => {
                if (value !== option.value) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = theme.textPrimary;
                }
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default CustomDropdown;
