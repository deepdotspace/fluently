import { useQuery, useMutations } from 'deepspace'

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Navbar from '../components/app/Navbar';
import DecksList from '../components/app/DecksList';
import CardCreation from '../components/app/CardCreation';
import SettingsPanel from '../components/app/SettingsPanel';
import ReviewMode from '../components/app/ReviewMode';
import BrowseMode from '../components/app/BrowseMode';
import ImportDecks from '../components/app/ImportDecks';
import { getDefaultSettings, getDefaultCardTypes } from '../utils/storage';
import { softThemes, applyTheme } from '../utils/themes';
import { buildCardMap, getAllCards, getDueCards, getCardStats, getDailyProgress } from '../utils/cardStorage';
import { ThemeProvider } from '../utils/ThemeContext';
import useIsMobile from '../hooks/useIsMobile';

export default function FlashcardManager() {
  const isMobile = useIsMobile();
  const [lucideLoaded, setLucideLoaded] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  const [viewingDeckId, setViewingDeckId] = useState(null);
  const [reviewSessionStats, setReviewSessionStats] = useState(null);

  // Local UI state (ephemeral, per-tab)
  const [activeTab, setActiveTab] = useState('import-decks');
  const [selectedDeck, setSelectedDeck] = useState(null);

  // Persisted user preferences (theme sync)
  const { records: prefRecords, status: prefStatus } = useQuery('user-preferences');
  const prefMutations = useMutations('user-preferences');
  const prefRecord = prefRecords[0] || null;
  const currentTheme = prefRecord?.data?.currentTheme || 'sky-serenity';

  const setCurrentTheme = useCallback((theme) => {
    const current = prefRecord?.data || { currentTheme: 'sky-serenity' };
    const updated = { ...current, currentTheme: theme };
    if (prefRecord) {
      prefMutations.put(prefRecord.recordId, updated);
    } else {
      prefMutations.create(updated);
    }
  }, [prefRecord, prefMutations]);

  // Decks (shared, one record per deck)
  const { records: deckRecords, status: decksStatus } = useQuery('decks');
  const deckMutations = useMutations('decks');

  const decks = useMemo(() => {
    const map = {};
    deckRecords.forEach(r => {
      const id = r.data.id;
      if (id) map[id] = { ...r.data, recordId: r.recordId };
    });
    return map;
  }, [deckRecords]);

  // Flashcard settings (singleton record holding config object)
  const { records: settingsRecords, status: settingsStatus } = useQuery('flashcard-settings');
  const settingsMutations = useMutations('flashcard-settings');
  const settingsRecord = settingsRecords[0] || null;
  const settings = settingsRecord?.data?.config || getDefaultSettings();

  const updateSettings = useCallback((newSettings) => {
    if (settingsRecord) {
      settingsMutations.put(settingsRecord.recordId, { config: newSettings });
    } else {
      settingsMutations.create({ config: newSettings });
    }
  }, [settingsRecord, settingsMutations]);

  // Card types (singleton record)
  const { records: cardTypeRecords, status: cardTypesStatus } = useQuery('card-types');
  const cardTypeMutations = useMutations('card-types');
  const cardTypeRecord = cardTypeRecords[0] || null;
  const cardTypes = cardTypeRecord?.data?.types || getDefaultCardTypes();

  const updateCardTypes = useCallback((newTypes) => {
    if (cardTypeRecord) {
      cardTypeMutations.put(cardTypeRecord.recordId, { types: newTypes });
    } else {
      cardTypeMutations.create({ types: newTypes });
    }
  }, [cardTypeRecord, cardTypeMutations]);

  // Custom themes (singleton record)
  const { records: themeRecords } = useQuery('custom-themes');
  const themeMutations = useMutations('custom-themes');
  const themeRecord = themeRecords[0] || null;
  const customThemes = themeRecord?.data?.themes || {};

  const updateCustomThemes = useCallback((newThemes) => {
    if (themeRecord) {
      themeMutations.put(themeRecord.recordId, { themes: newThemes });
    } else {
      themeMutations.create({ themes: newThemes });
    }
  }, [themeRecord, themeMutations]);

  // Daily progress (per-user)
  const { records: dailyProgressRecords } = useQuery('daily-progress');
  const dailyProgressMutations = useMutations('daily-progress');
  const dailyProgressRecord = dailyProgressRecords[0] || null;
  const dailyProgress = dailyProgressRecord?.data?.progress || null;

  const updateDailyProgress = useCallback((newProgress) => {
    if (dailyProgressRecord) {
      dailyProgressMutations.put(dailyProgressRecord.recordId, {
        date: newProgress.date,
        progress: newProgress
      });
    } else {
      dailyProgressMutations.create({
        date: newProgress.date,
        progress: newProgress
      });
    }
  }, [dailyProgressRecord, dailyProgressMutations]);

  // Cards (one record per card)
  const { records: cardRecords, status: cardsStatus } = useQuery('cards');
  const cardMutations = useMutations('cards');

  // Media records
  const { records: mediaRecords } = useQuery('media');
  const mediaMutations = useMutations('media');

  // Derived state
  const allCards = useMemo(() => buildCardMap(cardRecords), [cardRecords]);

  // Local cards state for immediate UI updates during review
  const [cards, setCards] = useState({});
  useEffect(() => { setCards(allCards); }, [allCards]);

  // Combine predefined + custom themes
  const allThemes = useMemo(() => ({ ...softThemes, ...customThemes }), [customThemes]);
  const theme = allThemes[currentTheme] || softThemes[currentTheme] || softThemes['sky-serenity'];

  // Initialize settings if missing
  useEffect(() => {
    if (settingsStatus === 'ready' && !settingsRecord) {
      settingsMutations.create({ config: getDefaultSettings() });
    }
  }, [settingsStatus, settingsRecord, settingsMutations]);

  // Initialize card types if missing
  useEffect(() => {
    if (cardTypesStatus === 'ready' && !cardTypeRecord) {
      cardTypeMutations.create({ types: getDefaultCardTypes() });
    }
  }, [cardTypesStatus, cardTypeRecord, cardTypeMutations]);

  // Load Lucide Icons from CDN (components use window.lucide)
  useEffect(() => {
    if (!document.getElementById('lucide-script')) {
      const lucideScript = document.createElement('script');
      lucideScript.id = 'lucide-script';
      lucideScript.src = 'https://unpkg.com/lucide@latest/dist/umd/lucide.js';
      lucideScript.onload = () => {
        window.dispatchEvent(new Event('lucide-loaded'));
        setLucideLoaded(true);
        setTimeout(() => setFadeIn(true), 50);
      };
      lucideScript.onerror = () => { console.error('Failed to load Lucide icons from CDN'); };
      document.head.appendChild(lucideScript);
    } else if (window.lucide) {
      setLucideLoaded(true);
      setTimeout(() => setFadeIn(true), 50);
    } else {
      // Script tag exists but not loaded yet
      const handleLoaded = () => {
        setLucideLoaded(true);
        setTimeout(() => setFadeIn(true), 50);
      };
      window.addEventListener('lucide-loaded', handleLoaded);
      return () => window.removeEventListener('lucide-loaded', handleLoaded);
    }
  }, []);

  // Theme application
  useEffect(() => {
    if (theme) {
      applyTheme(theme);
      document.body.style.background = theme.gradient;
      document.documentElement.style.background = theme.gradient;
      document.documentElement.style.minHeight = '100%';
    }
    return () => {
      document.body.style.background = '';
      document.documentElement.style.background = '';
      document.documentElement.style.minHeight = '';
    };
  }, [theme]);

  // Auto-select first deck
  useEffect(() => {
    if (!selectedDeckId && Object.keys(decks).length > 0) {
      setSelectedDeckId(Object.keys(decks)[0]);
    }
  }, [selectedDeckId, decks]);

  // Due cards / stats
  const newCardsPerDay = settings?.global?.newCardsPerDay;
  const maxReviewsPerDay = settings?.global?.maxReviewsPerDay;

  const dueCards = useMemo(() => {
    const progress = getDailyProgress(dailyProgress, selectedDeckId);
    const deckProgress = progress?.decks?.[selectedDeckId];
    return getDueCards(allCards, selectedDeckId, settings, deckProgress);
  }, [allCards, selectedDeckId, newCardsPerDay, maxReviewsPerDay, dailyProgress]);

  const stats = useMemo(() => {
    const cardsToUse = viewingDeckId && Object.keys(cards).length > 0 ? cards : null;

    if (cardsToUse) {
      const allCardsForDeck = selectedDeckId
        ? Object.values(cardsToUse).filter(c => c.deckId === selectedDeckId)
        : Object.values(cardsToUse);
      const now = new Date();

      const allNew = allCardsForDeck.filter(c => c.scheduling?.state === 'new');
      const allLearning = allCardsForDeck.filter(c => c.scheduling?.state === 'learning');
      const allReview = allCardsForDeck.filter(c => c.scheduling?.state === 'review');

      const dueNew = allNew.filter(c => new Date(c.scheduling?.dueDate) <= now);
      const dueLearning = allLearning.filter(c => new Date(c.scheduling?.dueDate) <= now);
      const dueReview = allReview.filter(c => new Date(c.scheduling?.dueDate) <= now);

      let displayDueCount = 0;
      if (settings?.global) {
        const newCardLimit = settings.global.newCardsPerDay;
        const limitedNewCards = (typeof newCardLimit === 'number' && newCardLimit > 0)
          ? Math.min(dueNew.length, newCardLimit) : dueNew.length;
        const reviewLimit = settings.global.maxReviewsPerDay;
        const limitedReviewCards = (typeof reviewLimit === 'number' && reviewLimit > 0)
          ? Math.min(dueLearning.length + dueReview.length, reviewLimit)
          : (dueLearning.length + dueReview.length);
        displayDueCount = limitedReviewCards + limitedNewCards;
      } else {
        displayDueCount = dueNew.length + dueLearning.length + dueReview.length;
      }

      return {
        total: allCardsForDeck.length,
        new: allNew.length,
        learning: allLearning.length,
        review: allReview.length,
        due: viewingDeckId && reviewSessionStats ? reviewSessionStats.remaining : displayDueCount
      };
    }

    const baseStats = getCardStats(allCards, selectedDeckId, settings);
    if (viewingDeckId && reviewSessionStats) {
      return { ...baseStats, due: reviewSessionStats.remaining };
    }
    return baseStats;
  }, [allCards, cards, selectedDeckId, newCardsPerDay, maxReviewsPerDay, reviewSessionStats, viewingDeckId, settings]);

  // Navigation
  const handleDeckSelect = useCallback((deckId) => {
    setSelectedDeck(deckId);
    setSelectedDeckId(deckId);
    setViewingDeckId(deckId);
    setActiveTab('decks');
  }, []);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setViewingDeckId(null);
  }, []);

  const navTabs = useMemo(() => [
    { id: 'decks', label: 'Home', icon: 'home' },
    { id: 'import-decks', label: 'Import Decks', icon: 'download' },
    { id: 'cards', label: 'Create', icon: 'plus-circle' },
    { id: 'browse', label: 'Browse', icon: 'book-open' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ], []);

  // Loading state
  const isReady = lucideLoaded && settings && cardsStatus === 'ready' && decksStatus === 'ready';

  if (!isReady) {
    return (
      <div style={{
        padding: '60px',
        textAlign: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
        color: '#9CA3AF',
        fontSize: '16px'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <div style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
        minHeight: '100vh',
        background: theme.gradient,
        opacity: fadeIn ? 1 : 0,
        transition: 'opacity 0.6s ease-in'
      }}>
        <Navbar
          navTabs={navTabs}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          viewingDeckId={viewingDeckId}
          setViewingDeckId={setViewingDeckId}
          theme={theme}
          allThemes={allThemes}
          currentTheme={currentTheme}
          setCurrentTheme={setCurrentTheme}
        />

        <div style={{ padding: isMobile ? '16px 12px 20px 12px' : '32px 40px 40px 40px' }}>
          {viewingDeckId ? (
            <div style={{ width: '100%', padding: isMobile ? '0' : '0 24px', boxSizing: 'border-box' }}>
              <ReviewMode
                dueCards={dueCards}
                cards={cards}
                setCards={setCards}
                cardMutations={cardMutations}
                decks={decks}
                deckMutations={deckMutations}
                settings={settings}
                selectedDeckId={viewingDeckId}
                showSparky={false}
                cardTypes={cardTypes}
                updateCardTypes={updateCardTypes}
                dailyProgress={dailyProgress}
                updateDailyProgress={updateDailyProgress}
                onSessionStatsChange={setReviewSessionStats}
                onBack={() => setViewingDeckId(null)}
                stats={stats}
                mediaRecords={mediaRecords}
                mediaMutations={mediaMutations}
                isMobile={isMobile}
              />
            </div>
          ) : (
            <>
              {activeTab === 'import-decks' && (
                <ImportDecks
                  decks={decks}
                  deckMutations={deckMutations}
                  cardMutations={cardMutations}
                  cards={allCards}
                  onDeckSelect={handleDeckSelect}
                  cardTypes={cardTypes}
                  updateCardTypes={updateCardTypes}
                  settings={settings}
                  mediaRecords={mediaRecords}
                  mediaMutations={mediaMutations}
                />
              )}
              {activeTab === 'decks' && (
                <DecksList
                  decks={decks}
                  deckMutations={deckMutations}
                  cards={allCards}
                  cardMutations={cardMutations}
                  mediaRecords={mediaRecords}
                  mediaMutations={mediaMutations}
                  themes={customThemes}
                  onDeckSelect={handleDeckSelect}
                  settings={settings}
                />
              )}
              {activeTab === 'cards' && (
                <CardCreation
                  decks={decks}
                  cards={allCards}
                  cardMutations={cardMutations}
                  deckMutations={deckMutations}
                  selectedDeck={selectedDeck}
                  setSelectedDeck={setSelectedDeck}
                  themes={customThemes}
                  cardTypes={cardTypes}
                  updateCardTypes={updateCardTypes}
                  mediaRecords={mediaRecords}
                  mediaMutations={mediaMutations}
                />
              )}
              {activeTab === 'browse' && (
                <div style={{
                  height: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 200px)',
                  maxHeight: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 200px)',
                  overflow: 'hidden'
                }}>
                  <BrowseMode
                    cards={allCards}
                    cardMutations={cardMutations}
                    decks={decks}
                    selectedDeckId={selectedDeckId}
                    cardTypes={cardTypes}
                    updateCardTypes={updateCardTypes}
                    mediaRecords={mediaRecords}
                    mediaMutations={mediaMutations}
                    isMobile={isMobile}
                  />
                </div>
              )}
              {activeTab === 'settings' && (
                <SettingsPanel
                  settings={settings}
                  updateSettings={updateSettings}
                  decks={decks}
                  deckMutations={deckMutations}
                />
              )}
            </>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}
