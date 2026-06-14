import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import LucideIcon from './LucideIcon';
import type { SoftTheme, ThemeMap } from '../../types';

interface ThemeSelectorProps {
  themes: ThemeMap;
  currentThemeId: string;
  onThemeChange: (themeId: string) => void;
  currentTheme: SoftTheme;
}

function ThemeSelector({ themes, currentThemeId, onThemeChange, currentTheme }: ThemeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleThemeSelect = useCallback((themeId: string) => {
    onThemeChange(themeId);
    setIsOpen(false);
  }, [onThemeChange]);

  // Safely get selected theme with fallback
  const selectedTheme = useMemo(() => {
    if (!themes || Object.keys(themes).length === 0) return null;
    return themes[currentThemeId] || Object.values(themes)[0];
  }, [themes, currentThemeId]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        style={{
          padding: '0',
          fontSize: '13px',
          fontWeight: '500',
          border: 'none',
          background: 'none',
          color: currentTheme.textSecondary,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = currentTheme.primary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = currentTheme.textSecondary;
        }}
      >
        <span>Theme</span>
        <div
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '3px',
            background: selectedTheme?.primary || currentTheme.primary,
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
        />
        <div style={{
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          display: 'flex',
          alignItems: 'center',
          opacity: 0.6,
          marginLeft: '2px'
        }}>
          <LucideIcon name="ChevronDown" size={12} />
        </div>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 12px)',
            right: 0,
            minWidth: '180px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: '12px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.12)',
            zIndex: 99999,
            maxHeight: '300px',
            overflowY: 'auto',
            padding: '8px'
          }}
        >
          {Object.values(themes).map(theme => (
            <button
              key={theme.id}
              onClick={(e) => {
                e.stopPropagation();
                handleThemeSelect(theme.id);
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: currentThemeId === theme.id
                  ? `${currentTheme.primary}10`
                  : 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left',
                fontSize: '13px',
                fontWeight: '500',
                color: currentTheme.textPrimary,
                letterSpacing: '-0.01em'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = currentThemeId === theme.id
                  ? `${currentTheme.primary}15`
                  : 'rgba(0, 0, 0, 0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = currentThemeId === theme.id
                  ? `${currentTheme.primary}10`
                  : 'transparent';
              }}
            >
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '4px',
                  background: theme.primary,
                  flexShrink: 0
                }}
              />
              <span style={{ flex: 1 }}>{theme.name}</span>
              {currentThemeId === theme.id && (
                <LucideIcon name="Check" size={14} color={currentTheme.primary} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ThemeSelector;
