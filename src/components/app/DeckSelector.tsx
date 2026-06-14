import React, { useEffect, useMemo, useRef, useState } from 'react';
import LucideIcon from './LucideIcon';
import type { DeckMap, SoftTheme } from '../../types';

interface DeckSelectorProps {
  decks: DeckMap;
  selectedDeck: string | null;
  setSelectedDeck: (deckId: string) => void;
  currentTheme: SoftTheme;
  marginBottom?: string;
}

function DeckSelector({ decks, selectedDeck, setSelectedDeck, currentTheme, marginBottom = '24px' }: DeckSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const decksList = useMemo(() => Object.values(decks || {}), [decks]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{ marginBottom, position: 'relative' }} ref={dropdownRef}>
      <label style={{
        display: 'block',
        fontSize: '14px',
        fontWeight: '600',
        color: currentTheme.textPrimary,
        marginBottom: '10px',
        letterSpacing: '0.3px'
      }}>
        Select Deck
      </label>

      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        style={{
          width: '100%',
          padding: '14px 18px',
          fontSize: '15px',
          background: 'rgba(255, 255, 255, 0.5)',
          border: `1px solid ${currentTheme.cardBorder}`,
          borderRadius: '12px',
          color: currentTheme.textPrimary,
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          outline: 'none',
          marginBottom: '8px'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedDeck ? decks[selectedDeck]?.name : 'Choose a deck...'}
        </span>
        <LucideIcon
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={16}
          color={currentTheme.textPrimary}
          className="opacity-60"
        />
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
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          marginTop: '4px',
          maxHeight: '250px',
          overflowY: 'auto'
        }}>
          {decksList.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', color: currentTheme.textSecondary, fontSize: '14px' }}>
              No decks available. Create one first!
            </div>
          ) : (
            decksList.map(deck => (
              <div
                key={deck.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDeck(deck.id);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  background: selectedDeck === deck.id ? `${currentTheme.primary}15` : 'transparent',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  color: currentTheme.textPrimary,
                  fontSize: '14px',
                  fontWeight: selectedDeck === deck.id ? '600' : '500'
                }}
                onMouseEnter={(e) => {
                  if (selectedDeck !== deck.id) {
                    e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedDeck !== deck.id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {deck.name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default DeckSelector;
