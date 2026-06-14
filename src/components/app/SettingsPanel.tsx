import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import InputField from './InputField';
import GlassCard from './GlassCard';
import ConfirmModal from './ConfirmModal';
import LucideIcon from './LucideIcon';
import { useTheme } from '../../utils/ThemeContext';
import useIsMobile from '../../hooks/useIsMobile';
import type { ChangeEvent } from 'react';
import type { Settings, GlobalSettings, SoftTheme, DeckMap, RecordMutations, Deck } from '../../types';

// Descriptions for each SRS setting - shown when guide mode is active
const SETTING_DESCRIPTIONS = {
  newCardsPerDay: 'Maximum new (unseen) cards introduced each day. Set to 20 to learn 20 new words daily, or 0 to pause new cards while you catch up on reviews.',
  maxReviewsPerDay: 'Maximum review cards shown per day. Reviews are cards you\'ve already started learning that are due again. Example: 200 means up to 200 reviews daily.',
  learningSteps: 'Time intervals between reviews while learning a new card. You must pass each step to "graduate" a card. Example: "1m, 10m" means review after 1 minute, then again after 10 minutes.',
  graduatingInterval: 'Days until a new card\'s first review after it passes all learning steps. Example: 1 means you\'ll see it again tomorrow after graduating.',
  easyInterval: 'Days until next review when you press "Easy" during learning: this skips remaining learning steps. Example: 4 means the card won\'t appear for 4 days.',
  relearningSteps: 'Time intervals for relearning a card you forgot (pressed "Again" during a review). Example: "10m" means you\'ll review it again in 10 minutes.',
  minimumInterval: 'Shortest possible interval (in days) for a card after you forget it. Example: 1 ensures forgotten cards always appear at least the next day.',
  leechThreshold: 'How many times you can forget a card before it\'s flagged as a "leech": a persistently difficult card. Example: 5 means flagged after 5 lapses.',
  startingEase: 'Initial ease multiplier for new cards. Higher values create longer gaps between reviews. Standard is 2.5. Typical range: 1.3 to 3.0.',
  easyBonus: 'Extra multiplier applied when you rate "Easy." Makes the next interval longer than a "Good" rating. Example: 1.3 means the interval is 30% longer.',
  hardInterval: 'Multiplier when you rate "Hard." Slows interval growth compared to "Good." Example: 1.2 means the interval only grows by 20%.',
  intervalModifier: 'Global multiplier applied to all review intervals. Example: 0.8 makes all intervals 20% shorter (more reviews). 1.2 makes them 20% longer (fewer reviews).',
  maximumInterval: 'Longest possible gap (in days) between reviews for any card. Example: 36500 (~100 years) means effectively no upper limit.'
};

interface HelpTextProps {
  text: string;
  show: boolean;
  theme: SoftTheme;
}

// Animated help text component for settings descriptions
const HelpText = React.memo(({ text, show, theme }: HelpTextProps) => (
  <div style={{
    maxHeight: show ? '100px' : '0',
    opacity: show ? 1 : 0,
    overflow: 'hidden',
    transition: 'max-height 0.35s ease, opacity 0.25s ease, margin 0.35s ease',
    marginTop: show ? '8px' : '0'
  }}>
    <p style={{
      fontSize: '12px',
      color: theme.textSecondary,
      opacity: 0.75,
      lineHeight: '1.6',
      margin: 0,
      fontWeight: '400',
      padding: '8px 12px',
      background: `${theme.primary}08`,
      borderRadius: '8px',
      borderLeft: `2px solid ${theme.primary}30`
    }}>
      {text}
    </p>
  </div>
));
HelpText.displayName = 'HelpText';

interface SettingsPanelProps {
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  decks: DeckMap;
  deckMutations: RecordMutations<Deck>;
}

function SettingsPanel({ settings, updateSettings, decks, deckMutations }: SettingsPanelProps) {
  const currentTheme = useTheme();
  const isMobile = useIsMobile();

  const [scope, setScope] = useState<'global' | 'deck'>('global');
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [localSettings, setLocalSettings] = useState<GlobalSettings | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [isDeckDropdownOpen, setIsDeckDropdownOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const deckDropdownRef = useRef<HTMLDivElement>(null);

  const decksList = useMemo(() => Object.values(decks || {}), [decks]);

  // Close deck dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (deckDropdownRef.current && !deckDropdownRef.current.contains(event.target as Node)) {
        setIsDeckDropdownOpen(false);
      }
    };
    if (isDeckDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDeckDropdownOpen]);

  const currentSettings = useMemo<GlobalSettings>(() =>
    scope === 'global'
      ? settings?.global
      // reason: a deck's settingsOverride is persisted as Partial<Settings> but
      // this panel only ever stores/reads a full GlobalSettings object in it.
      : (selectedDeckId && (decks[selectedDeckId]?.settingsOverride as GlobalSettings | undefined)) || settings?.global,
    [scope, selectedDeckId, decks, settings]
  );

  const workingSettings = useMemo(() =>
    localSettings || currentSettings,
    [localSettings, currentSettings]
  );

  const handleSave = useCallback(() => {
    if (scope === 'global') {
      updateSettings({ ...settings, global: localSettings || currentSettings });
      setSuccessMessage('Global settings saved!');
    } else if (selectedDeckId) {
      const deck = decks[selectedDeckId];
      if (deck?.recordId) {
        const { recordId, ...deckData } = deck;
        deckMutations.put(recordId, {
          ...deckData,
          // reason: settingsOverride is persisted here as a full GlobalSettings
          // object even though Deck types it as the broader Partial<Settings>.
          settingsOverride: (localSettings || currentSettings) as Deck['settingsOverride']
        });
      }
      setSuccessMessage('Deck settings saved!');
    }
    setLocalSettings(null);
    setTimeout(() => setSuccessMessage(''), 2000);
  }, [scope, localSettings, currentSettings, selectedDeckId, updateSettings, settings, decks, deckMutations]);

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleResetDeckSettings = useCallback(() => {
    if (!selectedDeckId) return;
    setShowResetConfirm(true);
  }, [selectedDeckId]);

  const confirmResetDeckSettings = useCallback(() => {
    if (!selectedDeckId) return;
    const deck = decks[selectedDeckId];
    if (deck?.recordId) {
      const { recordId, ...deckData } = deck;
      deckMutations.put(recordId, { ...deckData, settingsOverride: null });
    }
    setLocalSettings(null);
    setSuccessMessage('Deck settings reset to global!');
    setTimeout(() => setSuccessMessage(''), 2000);
    setShowResetConfirm(false);
  }, [selectedDeckId, decks, deckMutations]);

  const updateSetting = useCallback((key: keyof GlobalSettings, value: number | string[]) => {
    setLocalSettings(prev => {
      const base = prev || currentSettings;
      return {
        ...base,
        [key]: value
      };
    });
  }, [currentSettings]);

  const parseSteps = useCallback((str: string) => {
    return str.split(',').map(s => s.trim()).filter(Boolean);
  }, []);

  const stepsToString = useCallback((arr: string[]) => {
    return Array.isArray(arr) ? arr.join(', ') : '';
  }, []);

  if (!currentSettings) {
    return <div>Loading settings...</div>;
  }

  return (
    <div style={{
      background: `linear-gradient(135deg, ${currentTheme.primary}0c 0%, ${currentTheme.primary}06 50%, ${currentTheme.highlight}18 100%)`,
      borderRadius: isMobile ? '16px' : '28px',
      padding: isMobile ? '16px' : '36px',
      minHeight: isMobile ? 'auto' : 'calc(100vh - 240px)'
    }}>
      {/* Notification Messages - Fixed at top */}
      {successMessage && (
          <div
            className="anim-notification"
            style={{
              position: 'fixed',
              top: '16px',
              left: '50%',
              zIndex: 10000,
              padding: '8px 16px',
              background: `${currentTheme.primary}`,
              backdropFilter: 'blur(10px)',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'white',
              fontWeight: '500',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              maxWidth: '90%'
            }}
          >
            <LucideIcon name="check" size={16} color="white" /> {successMessage}
          </div>
        )}

      {/* Header with title and guide toggle */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'center',
        marginBottom: isMobile ? '20px' : '32px',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '12px' : '0'
      }}>
        <h2 style={{
          fontSize: isMobile ? '22px' : '28px',
          fontWeight: '600',
          color: currentTheme.textPrimary,
          margin: 0,
          letterSpacing: '-0.5px'
        }}>
          Scheduler Settings
        </h2>
        <button
          onClick={() => setShowHelp(!showHelp)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '9px 18px',
            background: showHelp ? `${currentTheme.primary}18` : 'rgba(255, 255, 255, 0.55)',
            border: `1px solid ${showHelp ? currentTheme.primary + '45' : currentTheme.cardBorder}`,
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: '500',
            color: showHelp ? currentTheme.primary : currentTheme.textSecondary,
            cursor: 'pointer',
            transition: 'all 0.3s',
            boxShadow: showHelp ? `0 2px 12px ${currentTheme.primary}20` : 'none'
          }}
          onMouseEnter={(e) => {
            if (!showHelp) {
              e.currentTarget.style.background = `${currentTheme.primary}10`;
              e.currentTarget.style.borderColor = `${currentTheme.primary}30`;
              e.currentTarget.style.color = currentTheme.primary;
            }
          }}
          onMouseLeave={(e) => {
            if (!showHelp) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.55)';
              e.currentTarget.style.borderColor = currentTheme.cardBorder;
              e.currentTarget.style.color = currentTheme.textSecondary;
            }
          }}
        >
          <LucideIcon name={showHelp ? 'book-open' : 'help-circle'} size={15} />
          {showHelp ? 'Hide Guide' : 'Show Guide'}
        </button>
      </div>

      {/* Guide intro banner - shown when help is active */}
      <div style={{
        maxHeight: showHelp ? '80px' : '0',
        opacity: showHelp ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.4s ease, opacity 0.3s ease, margin 0.4s ease',
        marginBottom: showHelp ? '24px' : '0'
      }}>
        <div style={{
          padding: '14px 20px',
          background: `${currentTheme.primary}12`,
          border: `1px solid ${currentTheme.primary}25`,
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <LucideIcon name="lightbulb" size={18} color={currentTheme.primary} />
          <p style={{
            fontSize: '13px',
            color: currentTheme.textPrimary,
            margin: 0,
            lineHeight: '1.5',
            opacity: 0.85
          }}>
            These settings control the spaced repetition algorithm. Descriptions below each field explain what they do and suggest good starting values.
          </p>
        </div>
      </div>

      {/* Scope Selector */}
      <GlassCard style={{ marginBottom: '28px' }} theme={currentTheme}>
        <label style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: '600',
          color: currentTheme.textPrimary,
          marginBottom: '14px',
          letterSpacing: '0.3px'
        }}>
          Settings Scope
        </label>
        <div style={{ display: 'flex', gap: isMobile ? '8px' : '12px', marginBottom: isMobile ? '16px' : '20px' }}>
          <button
            onClick={() => {
              setScope('global');
              setLocalSettings(null);
              setIsDeckDropdownOpen(false);
            }}
            style={{
              padding: isMobile ? '10px 20px' : '12px 28px',
              background: scope === 'global' ? currentTheme.primary : 'rgba(255, 255, 255, 0.5)',
              color: scope === 'global' ? 'white' : currentTheme.textPrimary,
              border: scope === 'global' ? 'none' : `1px solid ${currentTheme.cardBorder}`,
              borderRadius: '12px',
              fontSize: isMobile ? '13px' : '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s',
              boxShadow: scope === 'global' ? `0 4px 16px ${currentTheme.primary}40` : 'none',
              flex: isMobile ? 1 : undefined
            }}
          >
            Global
          </button>
          <button
            onClick={() => {
              setScope('deck');
              setLocalSettings(null);
              setIsDeckDropdownOpen(false);
            }}
            style={{
              padding: isMobile ? '10px 20px' : '12px 28px',
              background: scope === 'deck' ? currentTheme.primary : 'rgba(255, 255, 255, 0.5)',
              color: scope === 'deck' ? 'white' : currentTheme.textPrimary,
              border: scope === 'deck' ? 'none' : `1px solid ${currentTheme.cardBorder}`,
              borderRadius: '12px',
              fontSize: isMobile ? '13px' : '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s',
              boxShadow: scope === 'deck' ? `0 4px 16px ${currentTheme.primary}40` : 'none',
              flex: isMobile ? 1 : undefined
            }}
          >
            Per Deck
          </button>
        </div>

        {scope === 'deck' && (
          <div ref={deckDropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsDeckDropdownOpen(!isDeckDropdownOpen);
              }}
              style={{
                width: '100%',
                padding: '14px 18px',
                fontSize: '15px',
                background: 'rgba(255, 255, 255, 0.5)',
                border: `1px solid ${isDeckDropdownOpen ? currentTheme.primary : currentTheme.cardBorder}`,
                borderRadius: '12px',
                color: currentTheme.textPrimary,
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.2s',
                boxShadow: isDeckDropdownOpen ? `0 0 0 3px ${currentTheme.primary}20` : 'none'
              }}
              onMouseEnter={(e) => {
                if (!isDeckDropdownOpen) {
                  (e.target as HTMLButtonElement).style.borderColor = currentTheme.primary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isDeckDropdownOpen) {
                  (e.target as HTMLButtonElement).style.borderColor = currentTheme.cardBorder;
                }
              }}
            >
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: selectedDeckId ? currentTheme.textPrimary : currentTheme.textSecondary,
                fontWeight: selectedDeckId ? '500' : '400'
              }}>
                {selectedDeckId ? decks[selectedDeckId]?.name : 'Select a deck...'}
              </span>
              <LucideIcon
                name="chevron-down"
                size={16}
                className={`transition-transform duration-200 ${isDeckDropdownOpen ? 'rotate-180' : ''}`}
                color={currentTheme.textSecondary}
              />
            </button>

            {isDeckDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'white',
                border: `1px solid ${currentTheme.cardBorder}`,
                borderRadius: '12px',
                padding: '8px',
                boxShadow: `0 8px 32px ${currentTheme.primary}15, 0 4px 16px rgba(0, 0, 0, 0.1)`,
                zIndex: 1000,
                marginTop: '8px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {decksList.length === 0 ? (
                  <div style={{
                    padding: '12px',
                    textAlign: 'center',
                    color: currentTheme.textSecondary,
                    fontSize: '14px'
                  }}>
                    No decks available
                  </div>
                ) : (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDeckId('');
                        setLocalSettings(null);
                        setIsDeckDropdownOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: selectedDeckId === '' ? `${currentTheme.primary}15` : 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        color: selectedDeckId === '' ? currentTheme.primary : currentTheme.textPrimary,
                        fontSize: '14px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontWeight: selectedDeckId === '' ? '600' : '400',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedDeckId !== '') {
                          (e.target as HTMLButtonElement).style.background = `${currentTheme.primary}10`;
                          (e.target as HTMLButtonElement).style.color = currentTheme.primary;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedDeckId !== '') {
                          (e.target as HTMLButtonElement).style.background = 'transparent';
                          (e.target as HTMLButtonElement).style.color = currentTheme.textPrimary;
                        }
                      }}
                    >
                      Select a deck...
                    </button>
                    {decksList.map(deck => (
                      <button
                        key={deck.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDeckId(deck.id);
                          setLocalSettings(null);
                          setIsDeckDropdownOpen(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: selectedDeckId === deck.id ? `${currentTheme.primary}15` : 'transparent',
                          border: 'none',
                          borderRadius: '8px',
                          color: selectedDeckId === deck.id ? currentTheme.primary : currentTheme.textPrimary,
                          fontSize: '14px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontWeight: selectedDeckId === deck.id ? '600' : '400',
                          transition: 'all 0.15s',
                          marginTop: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedDeckId !== deck.id) {
                            (e.target as HTMLButtonElement).style.background = `${currentTheme.primary}10`;
                            (e.target as HTMLButtonElement).style.color = currentTheme.primary;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedDeckId !== deck.id) {
                            (e.target as HTMLButtonElement).style.background = 'transparent';
                            (e.target as HTMLButtonElement).style.color = currentTheme.textPrimary;
                          }
                        }}
                      >
                        <span>{deck.name}</span>
                        {deck.settingsOverride && (
                          <span style={{
                            fontSize: '11px',
                            color: currentTheme.primary,
                            opacity: 0.7,
                            fontWeight: '500'
                          }}>
                            Custom
                          </span>
                        )}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Settings Form */}
      {(scope === 'global' || selectedDeckId) && (
        <GlassCard theme={currentTheme}>
          {/* Daily Limits Section */}
          <div style={{ marginBottom: isMobile ? '24px' : '36px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: isMobile ? '16px' : '24px',
              padding: isMobile ? '10px 14px' : '12px 18px',
              background: `${currentTheme.primary}08`,
              borderRadius: '12px',
              borderLeft: `3px solid ${currentTheme.primary}`
            }}>
              <LucideIcon name="gauge" size={isMobile ? 16 : 18} color={currentTheme.primary} />
              <h3 style={{
                fontSize: isMobile ? '15px' : '17px',
                fontWeight: '700',
                color: currentTheme.textPrimary,
                margin: 0,
                letterSpacing: '-0.2px'
              }}>
                Daily Limits
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '16px' : '20px' }}>
              <div>
                <InputField
                  label="New Cards Per Day"
                  type="number"
                  min={0}
                  value={workingSettings.newCardsPerDay ?? 0}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const inputValue = e.target.value;
                    if (inputValue === '') {
                      updateSetting('newCardsPerDay', 0);
                      return;
                    }
                    const value = parseInt(inputValue, 10);
                    const clampedValue = isNaN(value) || value < 0 ? 0 : value;
                    updateSetting('newCardsPerDay', clampedValue);
                  }}
                  theme={currentTheme}
                />
                <HelpText show={showHelp} text={SETTING_DESCRIPTIONS.newCardsPerDay} theme={currentTheme} />
              </div>
              <div>
                <InputField
                  label="Max Reviews Per Day"
                  type="number"
                  min={0}
                  value={workingSettings.maxReviewsPerDay ?? 0}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const inputValue = e.target.value;
                    if (inputValue === '') {
                      updateSetting('maxReviewsPerDay', 0);
                      return;
                    }
                    const value = parseInt(inputValue, 10);
                    const clampedValue = isNaN(value) || value < 0 ? 0 : value;
                    updateSetting('maxReviewsPerDay', clampedValue);
                  }}
                  theme={currentTheme}
                />
                <HelpText show={showHelp} text={SETTING_DESCRIPTIONS.maxReviewsPerDay} theme={currentTheme} />
              </div>
            </div>
          </div>

          {/* New Cards Section */}
          <div style={{ marginBottom: isMobile ? '24px' : '36px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: isMobile ? '16px' : '24px',
              padding: isMobile ? '10px 14px' : '12px 18px',
              background: `${currentTheme.primary}08`,
              borderRadius: '12px',
              borderLeft: `3px solid ${currentTheme.primary}`
            }}>
              <LucideIcon name="sparkles" size={isMobile ? 16 : 18} color={currentTheme.primary} />
              <h3 style={{
                fontSize: isMobile ? '15px' : '17px',
                fontWeight: '700',
                color: currentTheme.textPrimary,
                margin: 0,
                letterSpacing: '-0.2px'
              }}>
                New Cards
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px' }}>
              <div>
                <InputField
                  label="Learning Steps (e.g., 1m, 10m)"
                  type="text"
                  value={stepsToString(workingSettings.learningSteps)}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateSetting('learningSteps', parseSteps(e.target.value))}
                  placeholder="1m, 10m"
                  theme={currentTheme}
                />
                <HelpText show={showHelp} text={SETTING_DESCRIPTIONS.learningSteps} theme={currentTheme} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '16px' : '20px' }}>
                <div>
                  <InputField
                    label="Graduating Interval (days)"
                    value={workingSettings.graduatingInterval}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateSetting('graduatingInterval', parseInt(e.target.value) || 0)}
                    theme={currentTheme}
                  />
                  <HelpText show={showHelp} text={SETTING_DESCRIPTIONS.graduatingInterval} theme={currentTheme} />
                </div>
                <div>
                  <InputField
                    label="Easy Interval (days)"
                    value={workingSettings.easyInterval}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateSetting('easyInterval', parseInt(e.target.value) || 0)}
                    theme={currentTheme}
                  />
                  <HelpText show={showHelp} text={SETTING_DESCRIPTIONS.easyInterval} theme={currentTheme} />
                </div>
              </div>
            </div>
          </div>

          {/* Lapses Section */}
          <div style={{ marginBottom: isMobile ? '24px' : '36px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: isMobile ? '16px' : '24px',
              padding: isMobile ? '10px 14px' : '12px 18px',
              background: `${currentTheme.primary}08`,
              borderRadius: '12px',
              borderLeft: `3px solid ${currentTheme.primary}`
            }}>
              <LucideIcon name="rotate-ccw" size={isMobile ? 16 : 18} color={currentTheme.primary} />
              <h3 style={{
                fontSize: isMobile ? '15px' : '17px',
                fontWeight: '700',
                color: currentTheme.textPrimary,
                margin: 0,
                letterSpacing: '-0.2px'
              }}>
                Lapses
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px' }}>
              <div>
                <InputField
                  label="Relearning Steps (e.g., 10m)"
                  type="text"
                  value={stepsToString(workingSettings.relearningSteps)}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateSetting('relearningSteps', parseSteps(e.target.value))}
                  placeholder="10m"
                  theme={currentTheme}
                />
                <HelpText show={showHelp} text={SETTING_DESCRIPTIONS.relearningSteps} theme={currentTheme} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '16px' : '20px' }}>
                <div>
                  <InputField
                    label="Minimum Interval (days)"
                    value={workingSettings.minimumInterval}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateSetting('minimumInterval', parseInt(e.target.value) || 0)}
                    theme={currentTheme}
                  />
                  <HelpText show={showHelp} text={SETTING_DESCRIPTIONS.minimumInterval} theme={currentTheme} />
                </div>
                <div>
                  <InputField
                    label="Leech Threshold"
                    value={workingSettings.leechThreshold}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateSetting('leechThreshold', parseInt(e.target.value) || 0)}
                    theme={currentTheme}
                  />
                  <HelpText show={showHelp} text={SETTING_DESCRIPTIONS.leechThreshold} theme={currentTheme} />
                </div>
              </div>
            </div>
          </div>

          {/* Review Modifiers Section */}
          <div style={{ marginBottom: isMobile ? '24px' : '36px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: isMobile ? '16px' : '24px',
              padding: isMobile ? '10px 14px' : '12px 18px',
              background: `${currentTheme.primary}08`,
              borderRadius: '12px',
              borderLeft: `3px solid ${currentTheme.primary}`
            }}>
              <LucideIcon name="sliders-horizontal" size={isMobile ? 16 : 18} color={currentTheme.primary} />
              <h3 style={{
                fontSize: isMobile ? '15px' : '17px',
                fontWeight: '700',
                color: currentTheme.textPrimary,
                margin: 0,
                letterSpacing: '-0.2px'
              }}>
                Review Modifiers
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '16px' : '20px' }}>
              <div>
                <InputField
                  label="Starting Ease"
                  step="0.1"
                  value={workingSettings.startingEase}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateSetting('startingEase', parseFloat(e.target.value) || 0)}
                  theme={currentTheme}
                />
                <HelpText show={showHelp} text={SETTING_DESCRIPTIONS.startingEase} theme={currentTheme} />
              </div>
              <div>
                <InputField
                  label="Easy Bonus"
                  step="0.1"
                  value={workingSettings.easyBonus}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateSetting('easyBonus', parseFloat(e.target.value) || 0)}
                  theme={currentTheme}
                />
                <HelpText show={showHelp} text={SETTING_DESCRIPTIONS.easyBonus} theme={currentTheme} />
              </div>
              <div>
                <InputField
                  label="Hard Interval"
                  step="0.1"
                  value={workingSettings.hardInterval}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateSetting('hardInterval', parseFloat(e.target.value) || 0)}
                  theme={currentTheme}
                />
                <HelpText show={showHelp} text={SETTING_DESCRIPTIONS.hardInterval} theme={currentTheme} />
              </div>
              <div>
                <InputField
                  label="Interval Modifier"
                  step="0.1"
                  value={workingSettings.intervalModifier}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateSetting('intervalModifier', parseFloat(e.target.value) || 0)}
                  theme={currentTheme}
                />
                <HelpText show={showHelp} text={SETTING_DESCRIPTIONS.intervalModifier} theme={currentTheme} />
              </div>
              <div>
                <InputField
                  label="Maximum Interval (days)"
                  value={workingSettings.maximumInterval}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateSetting('maximumInterval', parseInt(e.target.value) || 0)}
                  theme={currentTheme}
                />
                <HelpText show={showHelp} text={SETTING_DESCRIPTIONS.maximumInterval} theme={currentTheme} />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row' }}>
            <button
              onClick={handleSave}
              disabled={!localSettings}
              style={{
                padding: isMobile ? '14px 24px' : '16px 32px',
                background: !localSettings ? 'rgba(156, 163, 175, 0.5)' : currentTheme.primary,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: isMobile ? '14px' : '15px',
                fontWeight: '600',
                cursor: !localSettings ? 'not-allowed' : 'pointer',
                boxShadow: !localSettings ? 'none' : `0 4px 20px ${currentTheme.primary}40`,
                transition: 'all 0.3s',
                width: isMobile ? '100%' : 'auto'
              }}
              onMouseEnter={(e) => {
                if (localSettings) {
                  (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
                  (e.target as HTMLButtonElement).style.boxShadow = `0 8px 28px ${currentTheme.primary}60`;
                }
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
                (e.target as HTMLButtonElement).style.boxShadow = localSettings ? `0 4px 20px ${currentTheme.primary}40` : 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <LucideIcon name="check" size={18} color="white" />
                Save Settings
              </div>
            </button>
            {scope === 'deck' && selectedDeckId && decks[selectedDeckId]?.settingsOverride && (
              <button
                onClick={handleResetDeckSettings}
                style={{
                  padding: isMobile ? '14px 24px' : '16px 32px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#EF4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '12px',
                  fontSize: isMobile ? '14px' : '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  width: isMobile ? '100%' : 'auto'
                }}
              >
                Reset to Global
              </button>
            )}
          </div>

        </GlassCard>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showResetConfirm}
        message="Reset this deck to use global settings?"
        onConfirm={confirmResetDeckSettings}
        onCancel={() => setShowResetConfirm(false)}
        confirmText="Reset"
        cancelText="Cancel"
        theme={currentTheme}
      />
    </div>
  );
}

export default SettingsPanel;
