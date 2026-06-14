import React, { useState, useCallback } from 'react';
import type { SoftTheme } from '../../types';

interface TabNavProps {
  activeMode: string;
  setActiveMode: (id: string) => void;
  currentTheme: SoftTheme;
  onTabChange?: () => void;
}

function TabNav({ activeMode, setActiveMode, currentTheme, onTabChange }: TabNavProps) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const handleSwitch = useCallback((id: string) => {
    setActiveMode(id);
    if (onTabChange) {
      onTabChange();
    }
  }, [onTabChange, setActiveMode]);

  const tabs = [
    { id: 'create', label: 'Create Card' },
    { id: 'auto', label: 'Auto generate' },
    { id: 'data', label: 'Use data' }
  ];

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: '-36px',
      marginLeft: '-36px',
      marginRight: '-36px',
      marginBottom: '32px',
      padding: '16px 36px 0 36px',
      gap: '0'
    }}>
      {tabs.map((tab, index) => {
        const isActive = activeMode === tab.id;
        const isHovered = hoveredTab === tab.id;

        return (
          <React.Fragment key={tab.id}>
            <button
              onClick={() => handleSwitch(tab.id)}
              onMouseEnter={() => setHoveredTab(tab.id)}
              onMouseLeave={() => setHoveredTab(null)}
              style={{
                flex: '1',
                padding: '12px 24px',
                fontSize: '15px',
                fontWeight: isActive ? '600' : '500',
                color: (isActive || isHovered) ? currentTheme.primary : currentTheme.textSecondary,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'color 0.2s ease',
                letterSpacing: '0.3px',
                position: 'relative',
                textAlign: 'center'
              }}
            >
              {tab.label}

              {/* Animated Underline */}
              <div style={{
                position: 'absolute',
                bottom: '-4px',
                left: '50%',
                width: '80%',
                height: '2px',
                background: currentTheme.primary,
                borderRadius: '1px',
                transformOrigin: 'center',
                transition: 'transform 0.3s ease, opacity 0.3s ease',
                opacity: (isActive || isHovered) ? 1 : 0,
                transform: (isActive || isHovered)
                  ? 'translateX(-50%) scaleX(1)'
                  : 'translateX(-50%) scaleX(0)'
              }}
              />
            </button>
            {index < tabs.length - 1 && (
              <div style={{
                width: '1px',
                height: '20px',
                background: currentTheme.cardBorder,
                opacity: 0.3
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default TabNav;
