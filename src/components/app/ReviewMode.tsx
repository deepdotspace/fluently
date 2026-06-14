import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { calculateNextReview } from '../../utils/spacedRepetition';
import { getDueCards, getDailyProgress, recordNewCardSeen } from '../../utils/cardStorage';
import { saveCard } from '../../utils/cardStorage';
import { stripHTML } from '../../utils/helpers';
import { renderCardTemplate, getCardType, getDefaultCardTypes } from '../../utils/fieldSystem';
import { getDesignContainerStyles } from '../../utils/cardDesigns';
import { useTheme } from '../../utils/ThemeContext';
import AIActions from './AIActions';
import RobotViewer from './RobotViewer';
import type { RobotViewerHandle } from './RobotViewer';
import RichTextRenderer from './RichTextRenderer';
import PronunciationReview from './PronunciationReview';
import CardEditDialog from './CardEditDialog';
import LucideIcon from './LucideIcon';
import type {
  Card,
  CardContent,
  CardMap,
  CardTypeMap,
  DailyProgress,
  Deck,
  DeckMap,
  MediaRecord,
  RecordEnvelope,
  ReviewRating,
  ReviewSessionStats,
  Settings,
  SoftTheme,
  StoredCard,
} from '../../types';

/** Combined per-field media: ordered arrays of URLs / `media:` references. */
interface Media {
  images: string[];
  audio: string[];
}

/**
 * Loose runtime view of a card's `content`. New-format cards carry `fields` /
 * `fieldMedia`; Cloze cards carry `text`/`clozes`; legacy cards carry
 * `front`/`back` plus per-side media. All formats are read here, so the strict
 * `CardContent` (string map) is widened to this view for dynamic access.
 */
interface LegacyCardContent {
  fields?: CardContent;
  fieldMedia?: Record<string, Media>;
  text?: string;
  clozes?: string[];
  front?: string;
  back?: string;
  frontMedia?: Media;
  backMedia?: Media;
  [key: string]: unknown;
}

/** Loose view of a card exposing the legacy `type` discriminator + content. */
type LegacyCard = Omit<StoredCard, 'content'> & { type?: string; content: LegacyCardContent };

/** Mutations surface from `useMutations('cards')`. */
interface CardMutations {
  create: (data: Record<string, unknown>) => void;
  put: (recordId: string, data: Record<string, unknown>) => void;
  remove: (recordId: string) => void;
}

/** Mutations surface from `useMutations('decks')`. */
interface DeckMutations {
  create: (data: Record<string, unknown>) => void;
  put: (recordId: string, data: Record<string, unknown>) => void;
  remove: (recordId: string) => void;
}

/** Mutations surface from `useMutations('media')`. */
interface MediaMutations {
  create: (data: MediaRecord) => void;
  put: (recordId: string, data: MediaRecord) => void;
  remove: (recordId: string) => void;
}

/** Deck-level due/new/learning/review counters rendered in the header strip. */
interface CardStats {
  total: number;
  new: number;
  learning: number;
  review: number;
  due: number;
}

/** Running per-session tally accumulated as the user rates cards. */
interface SessionStats {
  reviewed: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
}

interface ReviewModeProps {
  dueCards?: StoredCard[];
  cards: CardMap;
  setCards: React.Dispatch<React.SetStateAction<CardMap>>;
  cardMutations: CardMutations;
  decks: DeckMap;
  deckMutations: DeckMutations;
  settings: Settings | null;
  selectedDeckId: string | null;
  showSparky?: boolean;
  cardTypes?: CardTypeMap;
  updateCardTypes?: (types: CardTypeMap) => void;
  dailyProgress: DailyProgress | null;
  updateDailyProgress: (progress: DailyProgress) => void;
  onSessionStatsChange?: (stats: ReviewSessionStats) => void;
  onBack?: () => void;
  stats?: CardStats;
  mediaRecords?: RecordEnvelope<MediaRecord>[] | null;
  mediaMutations?: MediaMutations;
  isMobile?: boolean;
}

function ReviewMode({ dueCards: _dueCards, cards, setCards, cardMutations, decks, deckMutations, settings, selectedDeckId, showSparky, cardTypes = {}, updateCardTypes, dailyProgress, updateDailyProgress, onSessionStatsChange, onBack, stats, mediaRecords, mediaMutations, isMobile = false }: ReviewModeProps) {
  // Get theme from context
  const theme = useTheme();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  // Removed showBackContent to prevent flickering - letting 3D transform handle visibility
  const [showAI, setShowAI] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [show3DRobot, setShow3DRobot] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats>({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });
  const [animating, setAnimating] = useState(false);
  const [hasSpaceForRobot, setHasSpaceForRobot] = useState(window.innerWidth >= 700);
  const robotRef = useRef<RobotViewerHandle | null>(null);
  const lastEasyWasJumpRef = useRef(false);
  const previousCardIdRef = useRef<string | null>(null);

  const [slideDirection, setSlideDirection] = useState(1);
  const [cardKey, setCardKey] = useState(0);
  const [skipFlipTransition, setSkipFlipTransition] = useState(false);

  // Cloze card specific state
  const [clozeAnswers, setClozeAnswers] = useState<string[]>([]);
  const [showClozeResult, setShowClozeResult] = useState(false);

  // Snapshot due cards at session start - don't recalculate during review
  // This prevents the system from adding more cards beyond the daily limit
  // when reviewed cards change state (e.g., new -> learning)
  const newCardsPerDay = settings?.global?.newCardsPerDay;
  const maxReviewsPerDay = settings?.global?.maxReviewsPerDay;
  const [sessionDueCards, setSessionDueCards] = useState<StoredCard[]>([]);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [initialCardCount, setInitialCardCount] = useState(0); // Track initial count for progress

  // Initialize session cards when component mounts or deck/settings change
  useEffect(() => {
    if (selectedDeckId && cards && Object.keys(cards).length >= 0) {
      // Get or initialize daily progress for this deck
      const progress = getDailyProgress(dailyProgress, selectedDeckId);
      const deckProgress = progress.decks[selectedDeckId];

      // Get due cards, excluding already-seen new cards
      const initialDueCards = getDueCards(cards, selectedDeckId, settings, deckProgress);
      setSessionDueCards(initialDueCards);
      setInitialCardCount(initialDueCards.length);
      setSessionInitialized(true);
      setCurrentIndex(0);

      if (onSessionStatsChange) {
        onSessionStatsChange({
          total: initialDueCards.length,
          remaining: initialDueCards.length
        });
      }

      // Persist daily progress if it was freshly initialized
      if (!dailyProgress || dailyProgress.date !== progress.date) {
        updateDailyProgress(progress);
      }
    }
  }, [selectedDeckId, newCardsPerDay, maxReviewsPerDay]);

  // Use session snapshot instead of recalculating
  const dueCards = sessionDueCards;

  // Handle index when dueCards array changes (e.g., after reviewing a card)
  useEffect(() => {
    // If current index is out of bounds, reset to 0
    if (currentIndex >= dueCards.length && dueCards.length > 0) {
      setCurrentIndex(0);
      previousCardIdRef.current = null;
      return;
    }

    // If we have a card at the current index, update the reference
    if (dueCards[currentIndex]) {
      previousCardIdRef.current = dueCards[currentIndex].id;
    } else {
      previousCardIdRef.current = null;
    }
  }, [dueCards, currentIndex]);

  const currentCard = dueCards[currentIndex] as LegacyCard | undefined;
  // Calculate progress: cards reviewed / initial total
  const cardsReviewed = initialCardCount - dueCards.length;
  const progress = initialCardCount > 0 ? (cardsReviewed / initialCardCount) * 100 : 100;

  // Get card content (supports both new card type format and legacy format)
  const cardContent = useMemo(() => {
    if (!currentCard) return { front: '', back: '', frontMedia: { images: [], audio: [] }, backMedia: { images: [], audio: [] } };

    // New format: card type based
    if (currentCard.cardTypeId && currentCard.content?.fields) {
      const allCardTypes = { ...getDefaultCardTypes(), ...cardTypes };
      const cardType = getCardType(allCardTypes, currentCard.cardTypeId);

      if (cardType) {
        const fields = currentCard.content.fields || {};
        const fieldMedia = currentCard.content.fieldMedia || {};

        // Combine all field media into a single flat array, remapping placeholder
        // indices so each field's [IMAGE:0] maps to the correct global index.
        const allMedia: Media = { images: [], audio: [] };
        const adjustedFields: CardContent = { ...fields };
        let imageOffset = 0;
        let audioOffset = 0;

        // Use card type field order for deterministic iteration
        const fieldNames = (cardType.fields || []).map(f => typeof f === 'string' ? f : f.name);
        // Also include any extra fields in fieldMedia not in the card type definition
        Object.keys(fieldMedia).forEach(fn => {
          if (!fieldNames.includes(fn)) fieldNames.push(fn);
        });

        for (const fieldName of fieldNames) {
          const fm = fieldMedia[fieldName] || { images: [], audio: [] };
          const fieldImages = fm.images || [];
          const fieldAudio = fm.audio || [];

          // Remap IMAGE placeholders in this field's value to global indices
          if (fieldImages.length > 0 && imageOffset > 0 && adjustedFields[fieldName]) {
            adjustedFields[fieldName] = adjustedFields[fieldName].replace(
              /\[IMAGE:(\d+)\]/g,
              (match, num) => `[IMAGE:${parseInt(num) + imageOffset}]`
            );
          }

          // Remap AUDIO placeholders to global indices
          if (fieldAudio.length > 0 && audioOffset > 0 && adjustedFields[fieldName]) {
            adjustedFields[fieldName] = adjustedFields[fieldName].replace(
              /\[AUDIO:(\d+)\]/g,
              (match, num) => `[AUDIO:${parseInt(num) + audioOffset}]`
            );
          }

          allMedia.images.push(...fieldImages);
          allMedia.audio.push(...fieldAudio);
          imageOffset += fieldImages.length;
          audioOffset += fieldAudio.length;
        }

        // Render front and back using templates with adjusted field values
        const frontRendered = renderCardTemplate(cardType.frontTemplate, adjustedFields, null);
        const backRendered = renderCardTemplate(cardType.backTemplate, adjustedFields, cardType.frontTemplate);

        return {
          front: frontRendered,
          back: backRendered,
          frontMedia: allMedia,
          backMedia: allMedia
        };
      }
    }

    // Legacy format: direct front/back
    return {
      front: currentCard.content?.front || '',
      back: currentCard.content?.back || '',
      frontMedia: currentCard.content?.frontMedia || { images: [], audio: [] },
      backMedia: currentCard.content?.backMedia || { images: [], audio: [] }
    };
  }, [currentCard, cardTypes]);

  // Reset flip state when card changes
  useEffect(() => {
    setFlipped(false);
    setShowAI(false);
    setShowClozeResult(false);
    // Initialize cloze answers if it's a cloze card
    if (currentCard && currentCard.type === 'Cloze' && currentCard.content.clozes) {
      setClozeAnswers(new Array(currentCard.content.clozes.length).fill(''));
    }
  }, [currentIndex, currentCard]);

  // Handle responsive layout - check if we have space for robot
  useEffect(() => {
    const handleResize = () => {
      setHasSpaceForRobot(window.innerWidth >= 700);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input field
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      // Skip keyboard shortcuts for pronunciation cards (they handle their own)
      if (currentCard?.type === 'Pronunciation') return;

      const isCloze = currentCard?.type === 'Cloze';
      const canRate = isCloze ? showClozeResult : flipped;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!canRate) {
          if (isCloze) {
            handleFlip();
          } else {
            setFlipped(true);
          }
        }
      } else if (canRate && ['1', '2', '3', '4'].includes(e.key)) {
        handleRating(parseInt(e.key) as ReviewRating);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [flipped, showClozeResult, currentCard]);

  const handleFlip = () => {
    if (!animating) {
      if (currentCard && currentCard.type === 'Cloze') {
        // For cloze cards, reveal the result comparison
        setShowClozeResult(true);
        setFlipped(true);
      } else {
        setFlipped(!flipped);
      }
    }
  };

  const triggerRobotAnimationForRating = (rating: ReviewRating) => {
    const robot = robotRef.current;
    if (!robot || typeof robot.playAnimation !== 'function') return;

    // 1: Again -> no special animation for now
    if (rating === 2) {
      // Hard -> "Yes"
      robot.playAnimation('Yes');
    } else if (rating === 3) {
      // Good -> thumbs up
      robot.playAnimation('ThumbsUp');
    } else if (rating === 4) {
      // Easy -> first time Jump, then Death on subsequent easies (toggle)
      if (!lastEasyWasJumpRef.current) {
        robot.playAnimation('Jump');
        lastEasyWasJumpRef.current = true;
      } else {
        robot.playAnimation('Death');
        lastEasyWasJumpRef.current = false;
      }
    }
  };

  const handleRating = (rating: ReviewRating) => {
    if (!currentCard || animating) return;

    // Disable the CSS flip transition so the card resets to front instantly,
    // preventing the next card's back from flashing during the 0.6s animation.
    setSkipFlipTransition(true);
    setFlipped(false);

    // Trigger robot animation tied to rating
    triggerRobotAnimationForRating(rating);

    // Set slide direction based on rating (bad = left, good = right)
    setSlideDirection(rating >= 3 ? 1 : -1);
    setCardKey(prev => prev + 1); // Trigger card exit animation

    setAnimating(true);

    // Update scheduling
    const newScheduling = calculateNextReview(currentCard as unknown as Card, rating, settings as Settings);

    const updatedCard = {
      ...currentCard,
      scheduling: newScheduling,
      revLog: [
        ...(currentCard.revLog || []),
        {
          timestamp: new Date().toISOString(),
          rating,
          interval: newScheduling.interval,
          ease: newScheduling.ease
        }
      ]
    };

    // Save updated card to collection storage
    saveCard(cardMutations, updatedCard as unknown as StoredCard);

    // Update local cards state immediately so stats update
    setCards(prev => ({
      ...prev,
      [currentCard.id]: updatedCard as unknown as CardMap[string]
    }));

    // Update deck's lastStudiedAt timestamp
    if (currentCard.deckId && decks[currentCard.deckId]) {
      const updatedDeck = {
        ...decks[currentCard.deckId],
        lastStudiedAt: new Date().toISOString()
      };
      // Update deck record
      const { recordId: deckRid, ...deckData } = updatedDeck;
      if (deckRid) {
        deckMutations.put(deckRid, deckData);
      }
    }

    // If this was a NEW card being reviewed for the first time, record it in daily progress
    if (currentCard.scheduling.state === 'new') {
      const updatedProgress = recordNewCardSeen(dailyProgress, selectedDeckId as string, currentCard.id);
      updateDailyProgress(updatedProgress);
    }

    // Update session stats
    const ratingLabels = ['again', 'hard', 'good', 'easy'] as const;
    setSessionStats(prev => ({
      ...prev,
      reviewed: prev.reviewed + 1,
      [ratingLabels[rating - 1]]: prev[ratingLabels[rating - 1]] + 1
    }));

    // Remove the reviewed card from the session snapshot
    // This ensures we don't see it again and the count decreases properly
    setSessionDueCards(prev => {
      const remainingCards = [...prev];
      remainingCards.splice(currentIndex, 1);

      // Notify parent of updated session stats
      if (onSessionStatsChange) {
        onSessionStatsChange({
          total: initialCardCount,
          remaining: remainingCards.length
        });
      }

      return remainingCards;
    });

    // Re-enable flip transition after the browser paints the unflipped state
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSkipFlipTransition(false);
      });
    });

    // Move to next card (stay at same index since we removed current card)
    setTimeout(() => {
      setAnimating(false);
    }, 300);
  };

  // Guard: Check if settings are available
  if (!settings || !settings.global) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        padding: '40px 24px',
        gap: '24px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{
          marginBottom: '16px'
        }}>
          <LucideIcon name="settings" size={56} color={theme.textSecondary} />
        </div>
        <div style={{
          fontSize: '28px',
          fontWeight: '300',
          color: theme.textPrimary,
          marginBottom: '16px',
          letterSpacing: '-0.5px'
        }}>
          Loading settings...
        </div>
        <div style={{
          fontSize: '16px',
          color: theme.textSecondary,
          textAlign: 'center',
          maxWidth: '400px',
          lineHeight: '1.6'
        }}>
          Please wait while the review system initializes.
        </div>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        padding: '40px 24px',
        gap: '24px',
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative'
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              position: 'absolute',
              top: '0',
              left: '0',
              width: '48px',
              height: '48px',
              borderRadius: '24px',
              border: `1px solid ${theme.cardBorder}`,
              background: 'white',
              backdropFilter: `blur(${theme.backdropBlur})`,
              WebkitBackdropFilter: `blur(${theme.backdropBlur})`,
              color: theme.textPrimary,
              cursor: 'pointer',
              boxShadow: `0 4px 12px ${theme.primary}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10
            }}
          >
            <LucideIcon name="arrow-left" size={24} color={theme.textPrimary} />
          </button>
        )}
        <div style={{
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <LucideIcon name="party-popper" size={64} color={theme.primary} />
        </div>
        <div style={{
          fontSize: '28px',
          fontWeight: '300',
          color: theme.textPrimary,
          marginBottom: '16px',
          letterSpacing: '-0.5px'
        }}>
          All caught up!
        </div>
        <div style={{
          fontSize: '16px',
          color: theme.textSecondary,
          marginBottom: '32px',
          textAlign: 'center',
          maxWidth: '400px',
          lineHeight: '1.6'
        }}>
          {sessionStats.reviewed > 0
            ? `Great job! You reviewed ${sessionStats.reviewed} card${sessionStats.reviewed > 1 ? 's' : ''} today.`
            : 'No cards due for review right now. Check back later!'}
        </div>
        {sessionStats.reviewed > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 20px',
            background: 'rgba(255, 255, 255, 0.45)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '40px',
            border: `1px solid ${theme.cardBorder}`,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
            maxWidth: '100%'
          }}>
            <StatBadge label="Again" value={sessionStats.again} color="#EF4444" theme={theme} />
            <div style={{ width: '1px', height: '14px', background: theme.cardBorder, opacity: 0.6, margin: '0 4px' }} />
            <StatBadge label="Hard" value={sessionStats.hard} color="#F59E0B" theme={theme} />
            <div style={{ width: '1px', height: '14px', background: theme.cardBorder, opacity: 0.6, margin: '0 4px' }} />
            <StatBadge label="Good" value={sessionStats.good} color="#10B981" theme={theme} />
            <div style={{ width: '1px', height: '14px', background: theme.cardBorder, opacity: 0.6, margin: '0 4px' }} />
            <StatBadge label="Easy" value={sessionStats.easy} color="#3B82F6" theme={theme} />
          </div>
        )}
      </div>
    );
  }

  const deck = decks[currentCard.deckId];

  const cardHeight = isMobile ? 380 : 400;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      boxSizing: 'border-box',
      gap: isMobile ? '12px' : '16px',
      padding: isMobile ? '8px 0' : '16px 16px',
      minHeight: isMobile ? '300px' : '400px',
      position: 'relative'
    }}>
      {(onBack || stats) && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: '900px',
          margin: '0 auto',
          boxSizing: 'border-box',
          gap: '8px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '8px' : '12px',
            width: isMobile ? '100%' : 'fit-content',
            justifyContent: isMobile ? 'center' : undefined
          }}>
            {onBack && (
              <button
                onClick={onBack}
                style={{
                  width: isMobile ? '36px' : '40px',
                  height: isMobile ? '36px' : '40px',
                  borderRadius: '20px',
                  border: `1px solid ${theme.cardBorder}`,
                  background: 'white',
                  backdropFilter: `blur(${theme.backdropBlur})`,
                  WebkitBackdropFilter: `blur(${theme.backdropBlur})`,
                  color: theme.textPrimary,
                  cursor: 'pointer',
                  boxShadow: `0 2px 8px ${theme.primary}10`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <LucideIcon name="arrow-left" size={isMobile ? 18 : 20} color={theme.textPrimary} />
              </button>
            )}

            {/* Stats Display */}
            {stats && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '2px' : '4px',
                padding: isMobile ? '4px 8px' : '4px 12px',
                background: 'rgba(255, 255, 255, 0.45)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '40px',
                border: `1px solid ${theme.cardBorder}`,
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
                boxSizing: 'border-box',
                flexWrap: 'nowrap',
                overflow: 'hidden'
              }}>
                <StatBadge label="Due" value={stats.due || 0} color={theme.primary} theme={theme} compact={isMobile} />
                <div style={{ width: '1px', height: '12px', background: theme.cardBorder, opacity: 0.6, margin: isMobile ? '0 1px' : '0 2px' }} />
                <StatBadge label="New" value={stats.new || 0} color="#3B82F6" theme={theme} compact={isMobile} />
                <div style={{ width: '1px', height: '12px', background: theme.cardBorder, opacity: 0.6, margin: isMobile ? '0 1px' : '0 2px' }} />
                <StatBadge label="Learn" value={stats.learning || 0} color="#F59E0B" theme={theme} compact={isMobile} />
                <div style={{ width: '1px', height: '12px', background: theme.cardBorder, opacity: 0.6, margin: isMobile ? '0 1px' : '0 2px' }} />
                <StatBadge label="Rev" value={stats.review || 0} color="#10B981" theme={theme} compact={isMobile} />

                {/* Sparky Button: hidden on mobile */}
                {!isMobile && (
                  <>
                    <div style={{ width: '1px', height: '12px', background: theme.cardBorder, opacity: 0.6, margin: '0 6px' }} />
                    <button
                      onClick={() => setShow3DRobot(!show3DRobot)}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: show3DRobot ? 'white' : theme.primary,
                        background: show3DRobot ? theme.primary : 'transparent',
                        border: `1px solid ${show3DRobot ? theme.primary : 'transparent'}`,
                        borderRadius: '20px',
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: show3DRobot ? `0 4px 12px ${theme.primary}30` : 'none',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => {
                        if (!show3DRobot) {
                          e.currentTarget.style.background = `${theme.primary}10`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!show3DRobot) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      Sparky
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div style={{
        width: '100%',
        maxWidth: isMobile ? '100%' : '700px',
        margin: '0 auto',
        alignSelf: 'stretch',
        marginTop: isMobile ? '2px' : '5px'
      }}>
        <div style={{
          height: '4px',
          background: theme.cardBorder,
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            background: theme.primary,
            width: `${progress}%`,
            transition: 'width 0.3s ease'
          }} />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: '6px',
          fontSize: '12px',
          color: theme.textSecondary,
          fontWeight: '500'
        }}>
          <span>{cardsReviewed} / {initialCardCount}</span>
        </div>
      </div>

      {/* Main Content Row */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        gap: isMobile ? '12px' : '24px',
        width: '100%',
        maxWidth: isMobile ? '100%' : '700px',
        margin: '0 auto',
        boxSizing: 'border-box',
        alignItems: 'flex-start',
        justifyContent: 'center'
      }}>
        {/* Flashcards Column */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flex: '0 0 auto',
          width: '100%',
          maxWidth: isMobile ? '100%' : '600px',
          gap: isMobile ? '12px' : '16px'
        }}>

          {/* Flashcard with 3D Flip, Cloze Card, or Pronunciation Card */}
          <div style={{ position: 'relative', width: '100%', maxWidth: isMobile ? '100%' : '480px', height: `${cardHeight}px` }}>
            {/* Stack Visuals - Background Cards */}
            {dueCards.length > 2 && (
              <div style={{
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                background: theme.cardBg,
                borderRadius: '20px',
                border: `1px solid ${theme.cardBorder}`,
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                transform: 'translateY(10px) translateX(6px) scale(0.92) rotate(2deg)',
                zIndex: 0,
                opacity: 0.4
              }} />
            )}
            {dueCards.length > 1 && (
              <div style={{
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                background: theme.cardBg,
                borderRadius: '20px',
                border: `1px solid ${theme.cardBorder}`,
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                transform: 'translateY(5px) translateX(-3px) scale(0.96) rotate(-1deg)',
                zIndex: 0,
                opacity: 0.6
              }} />
            )}

            {currentCard.type === 'Pronunciation' ? (
              <PronunciationReview
                card={currentCard as unknown as Card}
                theme={theme}
                onRating={handleRating}
                deck={deck}
              />
            ) : currentCard.type === 'Cloze' ? (
              <ClozeCard
                card={currentCard}
                theme={theme}
                clozeAnswers={clozeAnswers}
                setClozeAnswers={setClozeAnswers}
                showResult={showClozeResult}
                onReveal={handleFlip}
              />
            ) : (
              <div
                onClick={handleFlip}
                style={{
                  width: '100%',
                  maxWidth: isMobile ? '100%' : '480px',
                  height: `${cardHeight}px`,
                  perspective: '1000px',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: `${cardHeight}px`,
                  transformStyle: 'preserve-3d',
                  transition: skipFlipTransition ? 'none' : 'transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)',
                  transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                }}>
                  {/* Edit Button - Top Right Corner */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEditDialog(true);
                    }}
                    title="Edit Card"
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      zIndex: 100,
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      border: `1px solid ${theme.cardBorder}`,
                      background: 'rgba(255, 255, 255, 0.7)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      color: theme.textSecondary,
                      fontSize: '16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden'
                    }}
                  >
                    <LucideIcon name="edit" size={18} color={theme.textSecondary} />
                  </button>

                  {/* Icon Button - Show when Sparky is hidden OR when there's no space for robot */}
                  {(!showSparky || !hasSpaceForRobot) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAI(true);
                      }}
                      title="AI Actions"
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '56px',
                        zIndex: 100,
                        width: '36px',
                        height: '36px',
                        borderRadius: '18px',
                        background: 'rgba(255, 255, 255, 0.7)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        border: `1px solid ${theme.cardBorder}`,
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        transition: 'all 0.2s ease',
                        color: theme.primary,
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = `0 4px 12px ${theme.primary}30`;
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
                      }}
                    >
                      <LucideIcon name="bot" size={18} color={theme.primary} />
                    </button>
                  )}

                  {/* Front Side */}
                  <FlashcardSide
                    content={cardContent.front}
                    label="Front"
                    flipped={false}
                    theme={theme}
                    currentCard={currentCard}
                    showHint={!flipped}
                    media={cardContent.frontMedia}
                    mediaRecords={mediaRecords}
                    deckDesignId={deck?.designId}
                  />

                  {/* Back Side */}
                  <FlashcardSide
                    content={cardContent.back}
                    label="Back"
                    flipped={true}
                    theme={theme}
                    currentCard={currentCard}
                    showScheduling={true}
                    media={cardContent.backMedia}
                    mediaRecords={mediaRecords}
                    deckDesignId={deck?.designId}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Rating Buttons (shown after flip or cloze result, but not for pronunciation cards) */}
          {currentCard.type !== 'Pronunciation' && ((currentCard.type === 'Cloze' && showClozeResult) || (currentCard.type !== 'Cloze' && flipped)) && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: isMobile ? '6px' : '8px',
                width: '100%',
                maxWidth: isMobile ? '100%' : '480px',
                marginTop: isMobile ? '4px' : '8px',
                opacity: animating ? 0.5 : 1,
                transition: 'opacity 0.3s ease'
              }}>
                <RatingButton
                  label="Again"
                  sublabel="< 1d"
                  color="#EF4444"
                  onClick={() => handleRating(1)}
                  shortcut="1"
                  theme={theme}
                  compact={isMobile}
                />
                <RatingButton
                  label="Hard"
                  sublabel="2d"
                  color="#F59E0B"
                  onClick={() => handleRating(2)}
                  shortcut="2"
                  theme={theme}
                  compact={isMobile}
                />
                <RatingButton
                  label="Good"
                  sublabel="4d"
                  color="#10B981"
                  onClick={() => handleRating(3)}
                  shortcut="3"
                  theme={theme}
                  compact={isMobile}
                />
                <RatingButton
                  label="Easy"
                  sublabel="7d"
                  color="#3B82F6"
                  onClick={() => handleRating(4)}
                  shortcut="4"
                  theme={theme}
                  compact={isMobile}
                />
              </div>
            )
          }
        </div>

      </div>

      {/* Centered Robot - Show when Sparky button is clicked or when there's space and showSparky is enabled. Hidden on mobile. */}
      {!isMobile && (show3DRobot || (showSparky && hasSpaceForRobot)) && (
        <div style={{
          position: 'absolute',
          left: 'calc(50% + 240px + 15px)',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '200px',
          height: '320px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
          zIndex: 10
        }}>
          <div style={{
            width: '180px',
            height: '240px',
            borderRadius: '16px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <RobotViewer
              ref={robotRef}
              onClick={() => setShowAI(true)}
            />
          </div>
        </div>
      )}

      {/* AI Actions Modal */}
      {showAI && (
        <AIActions
          card={currentCard as unknown as Card}
          cards={cards}
          setCards={setCards}
          cardMutations={cardMutations}
          onClose={() => setShowAI(false)}
          theme={theme}
          mediaRecords={mediaRecords}
          cardTypes={cardTypes}
          deck={decks[currentCard.deckId]}
        />
      )}

      {/* Card Edit Dialog */}
      {showEditDialog && currentCard && (
        <CardEditDialog
          card={currentCard as unknown as Card}
          cardMutations={cardMutations}
          mediaRecords={mediaRecords}
          mediaMutations={mediaMutations}
          decks={decks}
          cardTypes={cardTypes}
          updateCardTypes={updateCardTypes}
          theme={theme}
          onClose={() => setShowEditDialog(false)}
          onSave={() => {
            // Card is already saved in the dialog, just close
            setShowEditDialog(false);
          }}
        />
      )}
    </div>
  );
}

interface FlashcardSideProps {
  content: string;
  label: string;
  flipped: boolean;
  theme: SoftTheme;
  currentCard: LegacyCard;
  showHint?: boolean;
  showScheduling?: boolean;
  media?: Media;
  mediaRecords?: RecordEnvelope<MediaRecord>[] | null;
  deckDesignId?: string;
}

function FlashcardSide({ content, label, flipped, theme, currentCard, showHint, showScheduling, media: providedMedia, mediaRecords, deckDesignId }: FlashcardSideProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(32);
  const [shouldCenterContent, setShouldCenterContent] = useState(false);

  // Use provided media if available, otherwise fall back to legacy format
  const media = useMemo(() => {
    if (providedMedia) return providedMedia;
    if (!currentCard?.content) return { images: [], audio: [] };
    // Legacy: If label is "Front", use frontMedia; otherwise use backMedia
    return label === 'Front'
      ? (currentCard.content.frontMedia || { images: [], audio: [] })
      : (currentCard.content.backMedia || { images: [], audio: [] });
  }, [providedMedia, currentCard, label]);

  // Get design styles from deck
  const designStyles = useMemo(() => {
    return getDesignContainerStyles(deckDesignId);
  }, [deckDesignId]);

  useEffect(() => {
    if (contentRef.current) {
      // For font sizing, we just need a rough estimate of the text length
      const text = stripHTML(content || '');
      const length = text.length;

      // Dynamic font sizing based on content length
      if (length < 50) {
        setFontSize(42);
      } else if (length < 100) {
        setFontSize(36);
      } else if (length < 200) {
        setFontSize(28);
      } else if (length < 400) {
        setFontSize(24);
      } else {
        setFontSize(20);
      }
    }
  }, [content]);

  // Handle vocabulary card font sizing to prevent wrapping
  useEffect(() => {
    if (!contentRef.current || !currentCard?.cardTypeId || currentCard.cardTypeId !== 'vocabulary') {
      return;
    }

    // Wait for content to render
    const timeoutId = setTimeout(() => {
      const container = contentRef.current;
      if (!container) return;

      // Find all divs and look for the one with large font size (vocabulary word/translation)
      const allDivs = container.querySelectorAll('div');
      let mainDiv: HTMLDivElement | null = null;
      let maxFontSize = 0;

      // Find the div with the largest font size (should be the word/translation)
      allDivs.forEach(div => {
        const style = window.getComputedStyle(div);
        const fontSize = parseFloat(style.fontSize);
        if (fontSize > maxFontSize && fontSize >= 40) {
          maxFontSize = fontSize;
          mainDiv = div;
        }
      });

      if (!mainDiv) return;
      const targetDiv: HTMLDivElement = mainDiv;

      // Get the computed style
      const computedStyle = window.getComputedStyle(targetDiv);
      const currentFontSize = parseFloat(computedStyle.fontSize);

      // Get the actual text content (excluding nested elements)
      const textContent = targetDiv.textContent!.trim();
      if (!textContent) return;

      // Find the parent container to get available width
      let parentContainer = targetDiv.parentElement;
      while (parentContainer && parentContainer !== container) {
        const parentStyle = window.getComputedStyle(parentContainer);
        if (parentStyle.display === 'flex' || parentContainer === container) {
          break;
        }
        parentContainer = parentContainer.parentElement;
      }

      const availableWidth = parentContainer ? parentContainer.offsetWidth - 80 : container.offsetWidth - 80; // Account for padding

      // Create a temporary element to measure text width
      const tempDiv = document.createElement('div');
      tempDiv.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: nowrap;
        font-size: ${currentFontSize}px;
        font-weight: ${computedStyle.fontWeight};
        font-family: ${computedStyle.fontFamily};
        letter-spacing: ${computedStyle.letterSpacing};
        box-sizing: border-box;
      `;
      tempDiv.textContent = textContent;
      document.body.appendChild(tempDiv);

      const textWidth = tempDiv.offsetWidth;
      document.body.removeChild(tempDiv);

      // If text would overflow, reduce font size
      if (textWidth > availableWidth && currentFontSize > 20) {
        // Calculate new font size to fit
        const ratio = availableWidth / textWidth;
        let newFontSize = Math.max(20, currentFontSize * ratio * 0.95); // 0.95 for safety margin

        // Apply the new font size
        targetDiv.style.fontSize = `${newFontSize}px`;
        targetDiv.style.whiteSpace = 'nowrap'; // Prevent wrapping
      }
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [content, currentCard, flipped]);

  // Measure content height and determine if it should be centered
  useEffect(() => {
    if (!contentRef.current || !containerRef.current) return;

    // Wait for content to fully render (including images/media)
    const timeoutId = setTimeout(() => {
      const contentElement = contentRef.current;
      const containerElement = containerRef.current;

      if (!contentElement || !containerElement) return;

      // Get the natural height of the content
      // scrollHeight gives us the full content height regardless of flex constraints
      const contentHeight = contentElement.scrollHeight;

      // Get the available height in the container
      // The container has padding: 32px 24px 40px 24px (top and bottom)
      const containerPadding = 32 + 40; // top + bottom padding
      // Account for the label at top (approximately 24px + label height)
      const labelSpace = 24 + 20; // top padding + label height
      const availableHeight = containerElement.clientHeight - containerPadding - labelSpace;

      // If content fits without scrolling (with a small buffer), center it
      const fitsWithoutScrolling = contentHeight <= availableHeight;
      setShouldCenterContent(fitsWithoutScrolling);
    }, 300); // Delay to ensure images/media are loaded and rendered

    return () => clearTimeout(timeoutId);
  }, [content, fontSize, media, flipped]);

  // Merge design styles with default styles
  const containerStyles = useMemo(() => {
    const baseStyles: React.CSSProperties = {
      position: 'absolute',
      width: '100%',
      height: '100%',
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden',
      transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      background: theme.cardBg,
      backdropFilter: `blur(${theme.backdropBlur})`,
      WebkitBackdropFilter: `blur(${theme.backdropBlur})`,
      borderRadius: '20px',
      border: `1px solid ${theme.cardBorder}`,
      boxShadow: '0 12px 48px rgba(0, 0, 0, 0.08)',
      padding: '32px 24px 40px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      overflowY: 'auto',
      boxSizing: 'border-box'
    };

    // Apply deck design styles (override defaults)
    if (designStyles && Object.keys(designStyles).length > 0) {
      Object.assign(baseStyles, designStyles);
      // Ensure these layout properties are maintained even with design
      baseStyles.position = 'absolute';
      baseStyles.width = '100%';
      baseStyles.height = '100%';
      baseStyles.backfaceVisibility = 'hidden';
      baseStyles.WebkitBackfaceVisibility = 'hidden';
      baseStyles.transform = flipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
      baseStyles.display = 'flex';
      baseStyles.flexDirection = 'column';
      baseStyles.alignItems = 'center';
      baseStyles.justifyContent = 'flex-start';
      baseStyles.overflowY = 'auto';
      baseStyles.boxSizing = 'border-box';
    }

    return baseStyles;
  }, [designStyles, theme, flipped]);

  return (
    <div ref={containerRef} className="hide-scrollbar" style={containerStyles}>
      {/* Side indicator */}
      <div style={{
        position: 'absolute',
        top: '24px',
        left: '24px',
        fontSize: '12px',
        fontWeight: '600',
        color: theme.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        opacity: 0.7
      }}>
        {label}
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: '1.4',
          color: theme.textPrimary,
          textAlign: 'center',
          fontWeight: '300',
          maxWidth: '100%',
          wordBreak: 'break-word',
          width: '100%',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: shouldCenterContent ? 'center' : 'flex-start',
          paddingTop: shouldCenterContent ? '0' : '20px'
        }}
      >
        <RichTextRenderer html={content} media={media} theme={theme} mediaRecords={mediaRecords} />
      </div>

    </div>
  );
}

interface RatingButtonProps {
  label: string;
  sublabel: string;
  color: string;
  onClick: () => void;
  shortcut: string;
  theme: SoftTheme;
  compact?: boolean;
}

function RatingButton({ label, sublabel, color, onClick, shortcut, theme, compact = false }: RatingButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: compact ? '10px 4px 8px 4px' : '28px 6px 8px 6px',
        borderRadius: compact ? '12px' : '16px',
        minWidth: compact ? '0' : '85px',
        border: `1px solid ${isHovered ? color : theme.cardBorder}`,
        background: isHovered ? color : theme.cardBg,
        backdropFilter: `blur(${theme.backdropBlur})`,
        WebkitBackdropFilter: `blur(${theme.backdropBlur})`,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        position: 'relative',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: isHovered ? `0 8px 24px ${color}40` : 'none',
        overflow: 'hidden'
      }}
    >
      <div style={{
        fontSize: compact ? '13px' : '16px',
        fontWeight: '600',
        color: isHovered ? 'white' : theme.textPrimary,
        transition: 'color 0.2s ease'
      }}>
        {label}
      </div>
      <div style={{
        fontSize: compact ? '11px' : '13px',
        color: isHovered ? 'white' : theme.textSecondary,
        transition: 'color 0.2s ease'
      }}>
        {sublabel}
      </div>
      {!compact && (
        <div style={{
          position: 'absolute',
          top: '6px',
          right: '6px',
          fontSize: '11px',
          fontWeight: '600',
          color: isHovered ? 'rgba(255,255,255,0.8)' : theme.textSecondary,
          padding: '2px 6px',
          background: isHovered ? 'rgba(255,255,255,0.2)' : theme.highlight,
          borderRadius: '4px',
          opacity: 0.8,
          transition: 'all 0.2s ease'
        }}>
          {shortcut}
        </div>
      )}
    </button>
  );
}

interface StatBadgeProps {
  label: string;
  value: number;
  color: string;
  theme?: SoftTheme;
  compact?: boolean;
}

function StatBadge({ label, value, color, theme, compact = false }: StatBadgeProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: compact ? '3px' : '6px',
      padding: compact ? '2px 4px' : '2px 8px',
    }}>
      <div style={{
        fontSize: compact ? '14px' : '18px',
        fontWeight: '700',
        color,
        lineHeight: '1'
      }}>
        {value}
      </div>
      <div style={{
        fontSize: compact ? '9px' : '10px',
        color: theme?.textSecondary || '#6B7280',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        opacity: 0.8
      }}>
        {label}
      </div>
    </div>
  );
}

/** A parsed cloze segment: plain text or a fill-in blank. */
type ClozePart =
  | { type: 'text'; content: string }
  | { type: 'cloze'; index: number; answer: string };

/** Per-character diff result when a user's cloze answer is imperfect. */
interface ClozeCharComparison {
  char: string;
  status: 'correct' | 'wrong' | 'missing';
}

/** Result of comparing a user's cloze answer to the correct answer. */
type ClozeComparison =
  | { type: 'exact'; user: string; correct: string }
  | { type: 'partial'; comparison: ClozeCharComparison[]; correct: string };

interface ClozeCardProps {
  card: LegacyCard;
  theme: SoftTheme;
  clozeAnswers: string[];
  setClozeAnswers: React.Dispatch<React.SetStateAction<string[]>>;
  showResult: boolean;
  onReveal: () => void;
  compact?: boolean;
}

function ClozeCard({ card, theme, clozeAnswers, setClozeAnswers, showResult, onReveal, compact = false }: ClozeCardProps) {
  // Parse the text and extract cloze positions
  const parseClozeText = (): ClozePart[] => {
    let text = card.content.text || '';
    // Strip HTML tags from the text
    text = stripHTML(text);

    const pattern = /\{\{([^}]+)\}\}/g;
    const parts: ClozePart[] = [];
    let lastIndex = 0;
    let match;
    let clozeIndex = 0;

    while ((match = pattern.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, match.index)
        });
      }

      // Add the cloze blank
      parts.push({
        type: 'cloze',
        index: clozeIndex,
        answer: match[1]
      });

      lastIndex = pattern.lastIndex;
      clozeIndex++;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex)
      });
    }

    return parts;
  };

  const parts = parseClozeText();

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...clozeAnswers];
    newAnswers[index] = value;
    setClozeAnswers(newAnswers);
  };

  // Compare user answer with correct answer character by character
  const compareAnswers = (userAnswer: string, correctAnswer: string): ClozeComparison => {
    const user = userAnswer.trim().toLowerCase();
    const correct = correctAnswer.trim().toLowerCase();

    if (user === correct) {
      return { type: 'exact', user, correct };
    }

    // Character-by-character comparison
    const maxLen = Math.max(user.length, correct.length);
    const comparison: ClozeCharComparison[] = [];

    for (let i = 0; i < maxLen; i++) {
      const userChar = user[i] || '';
      const correctChar = correct[i] || '';

      if (userChar === correctChar && userChar !== '') {
        comparison.push({ char: userChar, status: 'correct' });
      } else if (userChar !== '') {
        comparison.push({ char: userChar, status: 'wrong' });
      }
    }

    // Add missing characters
    if (user.length < correct.length) {
      for (let i = user.length; i < correct.length; i++) {
        comparison.push({ char: correct[i], status: 'missing' });
      }
    }

    return { type: 'partial', comparison, correct };
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      width: '100%',
      maxWidth: '600px',
      alignItems: 'center'
    }}>
      {/* Card */}
      <div className="hide-scrollbar" style={{
        width: '100%',
        height: '400px',
        background: theme.cardBg,
        backdropFilter: `blur(${theme.backdropBlur})`,
        WebkitBackdropFilter: `blur(${theme.backdropBlur})`,
        borderRadius: '20px',
        border: `1px solid ${theme.cardBorder}`,
        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.08)',
        padding: '32px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        boxSizing: 'border-box',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        {/* Label */}
        <div style={{
          fontSize: '12px',
          fontWeight: '600',
          color: theme.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          opacity: 0.7
        }}>
          Cloze Card
        </div>

        {/* Text with blanks/inputs */}
        <div style={{
          fontSize: '24px',
          lineHeight: '1.6',
          color: theme.textPrimary,
          fontWeight: '300',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px',
          flex: 1
        }}>
          {parts.map((part, idx) => {
            if (part.type === 'text') {
              return <span key={idx}>{part.content}</span>;
            } else {
              const userAnswer = clozeAnswers[part.index] || '';
              const result = showResult ? compareAnswers(userAnswer, part.answer) : null;

              if (showResult) {
                // Show result
                if (result!.type === 'exact') {
                  return (
                    <span key={idx} style={{
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span style={{
                        padding: '6px 16px',
                        background: '#10B981',
                        color: 'white',
                        borderRadius: '8px',
                        fontSize: '22px',
                        fontWeight: '500'
                      }}>
                        {part.answer}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: '#10B981',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <LucideIcon name="check" size={14} color="#10B981" /> Correct
                      </span>
                    </span>
                  );
                } else {
                  return (
                    <span key={idx} style={{
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      {/* User's answer with character highlighting */}
                      <div style={{
                        display: 'flex',
                        padding: '6px 12px',
                        background: '#FEF2F2',
                        borderRadius: '8px',
                        border: '2px solid #EF4444',
                        fontSize: '20px',
                        fontWeight: '500'
                      }}>
                        {(result as Extract<ClozeComparison, { type: 'partial' }>).comparison.map((item, i) => (
                          <span key={i} style={{
                            color: item.status === 'correct' ? '#10B981' : item.status === 'wrong' ? '#EF4444' : '#9CA3AF',
                            textDecoration: item.status === 'missing' ? 'underline' : 'none',
                            fontWeight: item.status === 'missing' ? '600' : '500'
                          }}>
                            {item.char}
                          </span>
                        ))}
                      </div>
                      {/* Correct answer */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px'
                      }}>
                        <span style={{
                          fontSize: '11px',
                          color: theme.textSecondary,
                          opacity: 0.7
                        }}>
                          Correct answer:
                        </span>
                        <span style={{
                          padding: '4px 12px',
                          background: '#10B981',
                          color: 'white',
                          borderRadius: '6px',
                          fontSize: '18px',
                          fontWeight: '500'
                        }}>
                          {part.answer}
                        </span>
                      </div>
                    </span>
                  );
                }
              } else {
                // Show input field
                return (
                  <input
                    key={idx}
                    type="text"
                    value={userAnswer}
                    onChange={(e) => handleAnswerChange(part.index, e.target.value)}
                    placeholder="________"
                    style={{
                      minWidth: '80px',
                      maxWidth: '300px',
                      width: `${Math.max(80, (userAnswer.length || part.answer.length) * 14 + 30)}px`,
                      padding: '4px 12px 8px 12px',
                      fontSize: '24px',
                      fontWeight: '400',
                      border: 'none',
                      borderBottom: `3px solid ${theme.primary}`,
                      borderRadius: '0',
                      outline: 'none',
                      background: 'transparent',
                      color: theme.textPrimary,
                      textAlign: 'center',
                      transition: 'all 0.25s ease',
                      boxShadow: 'none'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderBottomWidth = '3px';
                      e.target.style.borderBottomColor = theme.primary;
                      e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderBottomWidth = '3px';
                      e.target.style.borderBottomColor = theme.primary;
                      e.target.style.background = 'transparent';
                    }}
                  />
                );
              }
            }
          })}
        </div>
      </div>

      {/* Reveal button - Below the card */}
      {!showResult && (
        <button
          onClick={onReveal}
          style={{
            padding: '14px 32px',
            background: theme.primary,
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: `0 4px 20px ${theme.primary}40`,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(-2px)';
            (e.target as HTMLElement).style.boxShadow = `0 8px 28px ${theme.primary}50`;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(0)';
            (e.target as HTMLElement).style.boxShadow = `0 4px 20px ${theme.primary}40`;
          }}
        >
          Show Answer
        </button>
      )}
    </div>
  );
}

export default ReviewMode;
