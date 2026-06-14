import React, { useState, useEffect, useRef, useMemo } from 'react';
import { stripHTML } from '../../utils/helpers';
import { saveCard } from '../../utils/cardStorage';
import { getCardType, getDefaultCardTypes } from '../../utils/fieldSystem';
import { PROMPTS } from '../../utils/prompts';
import { miyagiAPI } from '../../utils/miyagiCompat';
import LucideIcon from './LucideIcon';
import type {
  Card,
  CardContent,
  CardMap,
  CardTypeMap,
  Deck,
  MediaRecord,
  RecordEnvelope,
  SoftTheme,
} from '../../types';

/** Combined per-field media: ordered arrays of URLs / `media:` references. */
interface Media {
  images: string[];
  audio: string[];
}

/**
 * Loose runtime view of a card's `content`. New-format cards carry `fields` /
 * `fieldMedia`; legacy cards carry `front`/`back` plus per-side media. Both
 * formats are read/written here, so the strict `CardContent` (string map) is
 * widened to this view for dynamic access.
 */
interface LegacyCardContent {
  fields?: CardContent;
  fieldMedia?: Record<string, Media>;
  front?: string;
  back?: string;
  frontMedia?: Media;
  [key: string]: unknown;
}

/** Loose view of a card exposing the legacy `type` discriminator + content. */
type LegacyCard = Omit<Card, 'content'> & { type?: string; content: LegacyCardContent };

/** Mutations surface from `useMutations('cards')`. */
interface CardMutations {
  create: (data: Record<string, unknown>) => void;
  put: (recordId: string, data: Record<string, unknown>) => void;
  remove: (recordId: string) => void;
}

/** A single message rendered in the chat transcript. */
interface ChatMessage {
  type: 'user' | 'assistant' | 'system';
  content: string;
  error?: boolean;
  audio?: string;
  audioText?: string;
}

/** Narrowed `data` payload for a successful `/generate-text` call. */
interface GenerateTextResult {
  text: string;
}

/** Narrowed `data` payload for a successful `/text-to-speech` call. */
interface TextToSpeechResult {
  audioUrl?: string;
}

interface AIActionsProps {
  card: Card | null;
  cards: CardMap;
  setCards?: (cards: CardMap) => void;
  cardMutations?: CardMutations;
  onClose: () => void;
  theme: SoftTheme;
  mediaRecords?: RecordEnvelope<MediaRecord>[] | null;
  cardTypes?: CardTypeMap;
  deck?: Deck | null;
}

function AIActions({ card, cards, setCards, cardMutations, onClose, theme, mediaRecords, cardTypes = {}, deck = null }: AIActionsProps) {
  // Loose view for legacy `type` / mixed-format `content` dynamic access.
  const legacyCard = card as LegacyCard | null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get card text content (supports both legacy and new format)
  const cardText = useMemo(() => {
    if (!legacyCard) return { front: '', back: '' };

    // New format: card type based
    if (legacyCard.cardTypeId && legacyCard.content?.fields) {
      const allCardTypes = { ...getDefaultCardTypes(), ...cardTypes };
      const cardType = getCardType(allCardTypes, legacyCard.cardTypeId);

      if (cardType) {
        const fields = legacyCard.content.fields || {};
        return {
          front: stripHTML(Object.values(fields)[0] || ''),
          back: stripHTML(Object.values(fields)[1] || Object.values(fields)[0] || '')
        };
      }
    }

    // Legacy format
    return {
      front: stripHTML(legacyCard.content?.front || ''),
      back: stripHTML(legacyCard.content?.back || '')
    };
  }, [legacyCard, cardTypes]);

  // Generate initial suggestions when modal opens
  useEffect(() => {
    if (messages.length === 0) {
      generateInitialSuggestions();
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when modal opens
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const generateInitialSuggestions = async () => {
    try {
      const front = cardText.front;
      const back = cardText.back;

      const response = await miyagiAPI.post('/generate-text', {
        prompt: PROMPTS.AI_CHAT_INITIAL_SUGGESTIONS(front, back, deck?.targetLang, deck?.nativeLang),
        provider: 'openai',
        model: 'gpt-4o-mini', // Changed from gpt-5-nano for better reliability
        max_tokens: 150
      });

      if (response.success) {
        const questions = (response.data as GenerateTextResult).text
          .split('\n')
          .map(q => q.trim())
          .filter(q => q.length > 0)
          .slice(0, 3);
        setSuggestions(questions);
      }
    } catch (error) {
      // Fallback suggestions
      setSuggestions([
        'Explain this concept',
        'Give me an example',
        'Why is this important?'
      ]);
    }
  };

  const generateFollowUpSuggestions = async (lastResponse: string) => {
    try {
      const response = await miyagiAPI.post('/generate-text', {
        prompt: PROMPTS.AI_CHAT_FOLLOW_UP_SUGGESTIONS(lastResponse, deck?.targetLang, deck?.nativeLang),
        provider: 'openai',
        model: 'gpt-4o-mini', // Changed from gpt-5-nano for better reliability
        max_tokens: 100
      });

      if (response.success) {
        const questions = (response.data as GenerateTextResult).text
          .split('\n')
          .map(q => q.trim())
          .filter(q => q.length > 0)
          .slice(0, 2);
        setFollowUpSuggestions(questions);
      }
    } catch (error) {
      setFollowUpSuggestions([]);
    }
  };

  const handleSendMessage = async (text: string | null = null) => {
    const messageText = text || chatInput.trim();
    if (!messageText) return;

    // Add user message
    const userMessage: ChatMessage = { type: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setLoading(true);
    setSuggestions([]);
    setFollowUpSuggestions([]);

    try {
      const front = cardText.front;
      const back = cardText.back;

      const response = await miyagiAPI.post('/generate-text', {
        prompt: PROMPTS.AI_CHAT_RESPONSE(front, back, messageText, deck?.targetLang, deck?.nativeLang),
        provider: 'openai',
        model: 'gpt-4o-mini', // Changed from gpt-5-mini for better reliability
        max_tokens: 500
      });

      if (response.success) {
        const aiMessage: ChatMessage = { type: 'assistant', content: (response.data as GenerateTextResult).text };
        setMessages(prev => [...prev, aiMessage]);
        generateFollowUpSuggestions((response.data as GenerateTextResult).text);
      } else {
        throw new Error('Failed to get response');
      }
    } catch (error) {
      const errorMessage: ChatMessage = { type: 'assistant', content: 'Sorry, I encountered an error. Please try again.', error: true };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (action: string) => {
    setLoading(true);
    setSuggestions([]);
    setFollowUpSuggestions([]);

    try {
      const front = cardText.front;
      const back = cardText.back;
      let prompt = '';
      let messagePrefix = '';

      switch (action) {
        case 'simplify':
          prompt = PROMPTS.AI_CHAT_SIMPLIFY(front);
          messagePrefix = 'Here\'s a simplified version:';
          break;
        case 'example':
          prompt = PROMPTS.AI_CHAT_EXAMPLE(front, back);
          messagePrefix = 'Here\'s an example:';
          break;
        case 'audio':
          // Handle audio separately
          await handleAudioAction();
          return;
        default:
          return;
      }

      const response = await miyagiAPI.post('/generate-text', {
        prompt,
        provider: 'openai',
        model: 'gpt-4o-mini', // Changed from gpt-5-mini for better reliability
        max_tokens: 500
      });

      if (response.success) {
        const text = (response.data as GenerateTextResult).text;
        const content = messagePrefix ? `${messagePrefix}\n\n${text}` : text;
        const userMessage: ChatMessage = { type: 'user', content: action === 'simplify' ? 'Simplify this' : 'Give me an example' };
        const aiMessage: ChatMessage = { type: 'assistant', content };
        setMessages(prev => [...prev, userMessage, aiMessage]);
        generateFollowUpSuggestions(text);
      }
    } catch (error) {
      const errorMessage: ChatMessage = { type: 'assistant', content: 'Sorry, I encountered an error. Please try again.', error: true };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleAudioAction = async () => {
    try {
      // Generate appropriate text for speech using AI
      const refinedPrompt = `Pronounce: ${cardText.front}`;
      const audioTextPrompt = PROMPTS.AUDIO_GENERATION(refinedPrompt, deck?.targetLang, deck?.nativeLang);

      const textResponse = await miyagiAPI.post('/generate-text', {
        prompt: audioTextPrompt,
        provider: 'openai',
        model: 'gpt-4o-mini', // Changed from gpt-5-nano for better reliability
        max_tokens: 100
      });

      if (!textResponse.success) throw new Error(textResponse.error || 'Failed to generate speech text');

      const textToSpeak = (textResponse.data as GenerateTextResult).text.trim().replace(/[\[\]"']/g, '');
      const appropriateVoice = PROMPTS.getAudioVoiceForLanguage(deck?.targetLang as string);
      const response = await miyagiAPI.post('/text-to-speech', {
        text: `${textToSpeak}. ... ${textToSpeak}.`,
        model: 'tts-1',
        voice: appropriateVoice,
        speed: 0.6
      });

      if (response.success && (response.data as TextToSpeechResult).audioUrl) {
        const userMessage: ChatMessage = { type: 'user', content: 'Pronounce this' };
        const audioMessage: ChatMessage = {
          type: 'assistant',
          content: 'Here\'s the pronunciation:',
          audio: (response.data as TextToSpeechResult).audioUrl,
          audioText: textToSpeak
        };
        setMessages(prev => [...prev, userMessage, audioMessage]);
      } else {
        throw new Error('Failed to generate audio');
      }
    } catch (error) {
      const errorMessage: ChatMessage = { type: 'assistant', content: 'Sorry, I couldn\'t generate the audio. Please try again.', error: true };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleSaveToCard = async (message: ChatMessage) => {
    if (!cardMutations || !legacyCard) return;

    try {
      const updatedCard: LegacyCard = { ...legacyCard };

      // Handle text content
      if (message.content && !message.audio) {
        // Determine which field to update
        if (legacyCard.cardTypeId && legacyCard.content?.fields) {
          // New format: append to Back field or first available field
          const fields = { ...legacyCard.content.fields };
          const fieldNames = Object.keys(fields);
          const targetField = fieldNames.length > 1 ? fieldNames[1] : fieldNames[0];

          fields[targetField] = (fields[targetField] || '') + '\n\n<p><em>AI Addition:</em></p>\n' + `<p>${message.content}</p>`;

          updatedCard.content = {
            ...legacyCard.content,
            fields
          };
        } else {
          // Legacy format: append to back
          updatedCard.content = {
            ...legacyCard.content,
            back: (legacyCard.content.back || '') + '\n\n<p><em>AI Addition:</em></p>\n' + `<p>${message.content}</p>`
          };
        }
      }

      // Handle audio
      if (message.audio) {
        if (legacyCard.cardTypeId && legacyCard.content?.fields) {
          // New format: add to fieldMedia
          const fieldMedia = { ...(legacyCard.content.fieldMedia || {}) };
          const fields = { ...(legacyCard.content.fields || {}) };
          const fieldNames = Object.keys(fields);

          // Determine target field - prefer fields that might contain the text being pronounced
          let targetField = fieldNames[0] || 'Front';
          if (fields.Word) targetField = 'Word'; // Pronunciation cards
          else if (fields.Front) targetField = 'Front'; // Basic cards

          if (!fieldMedia[targetField]) {
            fieldMedia[targetField] = { images: [], audio: [] };
          }

          if (!fieldMedia[targetField].audio) {
            fieldMedia[targetField].audio = [];
          }

          // Add audio URL if not already present
          let audioIndex = fieldMedia[targetField].audio.length;
          if (!fieldMedia[targetField].audio.includes(message.audio)) {
            fieldMedia[targetField].audio.push(message.audio);
          } else {
            // Find existing index if already present
            audioIndex = fieldMedia[targetField].audio.indexOf(message.audio);
          }

          // Insert audio placeholder in the field content if it doesn't already exist
          const placeholder = `[AUDIO:${audioIndex}]`;
          if (fields[targetField] && !fields[targetField].includes(placeholder)) {
            // For pronunciation cards, append to Word field; for others, replace or append
            if (targetField === 'Word') {
              fields[targetField] = (fields[targetField] || '') + ' ' + placeholder;
            } else {
              // For other fields, append at the end if not already present
              fields[targetField] = (fields[targetField] || '') + (fields[targetField] ? '\n\n' : '') + placeholder;
            }
          }

          updatedCard.content = {
            ...legacyCard.content,
            fields,
            fieldMedia
          };
        } else {
          // Legacy format: add to frontMedia
          const frontMedia = legacyCard.content?.frontMedia || { images: [], audio: [] };
          if (!frontMedia.audio) {
            frontMedia.audio = [];
          }

          let audioIndex = frontMedia.audio.length;
          if (!frontMedia.audio.includes(message.audio)) {
            frontMedia.audio.push(message.audio);
          } else {
            // Find existing index if already present
            audioIndex = frontMedia.audio.indexOf(message.audio);
          }

          // Insert audio placeholder in front content
          const placeholder = `[AUDIO:${audioIndex}]`;
          const front = legacyCard.content?.front || '';
          if (!front.includes(placeholder)) {
            updatedCard.content = {
              ...legacyCard.content,
              front: front + (front ? '\n\n' : '') + placeholder,
              frontMedia
            };
          } else {
            updatedCard.content = {
              ...legacyCard.content,
              frontMedia
            };
          }
        }
      }

      saveCard(cardMutations, updatedCard as unknown as Card);

      // Show success feedback
      const successMessage: ChatMessage = {
        type: 'system',
        content: message.audio ? 'Audio added to card!' : 'Content added to card!'
      };
      setMessages(prev => [...prev, successMessage]);

      // Update local cards state if setCards is available
      if (setCards) {
        setCards({
          ...cards,
          [legacyCard.id]: updatedCard as unknown as CardMap[string]
        });
      }
    } catch (error) {
      console.error('Failed to save to card:', error);
      const errorMessage: ChatMessage = {
        type: 'system',
        content: 'Failed to save to card. Please try again.',
        error: true
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '600px',
          background: 'white',
          borderRadius: '20px',
          padding: '0',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.2)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px 24px 20px 24px',
          borderBottom: `1px solid ${theme.cardBorder}`
        }}>
          <h3 style={{
            fontSize: '24px',
            fontWeight: '300',
            color: theme.textPrimary,
            margin: 0,
            letterSpacing: '-0.5px'
          }}>
            Sparky AI Assistant
          </h3>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '16px',
              border: 'none',
              background: theme.highlight,
              color: theme.textSecondary,
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.primary;
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.highlight;
              e.currentTarget.style.color = theme.textSecondary;
            }}
          >
            <LucideIcon name="x" size={18} color="currentColor" />
          </button>
        </div>

        {/* Chat Area - 60-70% of modal */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          minHeight: 0
        }}>
          {messages.length === 0 && (
            <div style={{
              textAlign: 'center',
              color: theme.textSecondary,
              fontSize: '14px',
              padding: '40px 20px'
            }}>
              Ask me anything about this card!
            </div>
          )}

          {messages.map((message, index) => (
            <MessageBubble
              key={index}
              message={message}
              theme={theme}
              onSaveToCard={handleSaveToCard}
            />
          ))}

          {loading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              background: theme.highlight,
              borderRadius: '16px',
              alignSelf: 'flex-start',
              maxWidth: '80%'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: `2px solid ${theme.cardBorder}`,
                borderTopColor: theme.primary,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ fontSize: '14px', color: theme.textSecondary }}>Thinking...</span>
            </div>
          )}

          {/* Follow-up suggestions */}
          {!loading && messages.length > 0 && followUpSuggestions.length > 0 && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginTop: '8px'
            }}>
              {followUpSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: `1px solid ${theme.cardBorder}`,
                    background: 'rgba(255, 255, 255, 0.6)',
                    color: theme.textPrimary,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = theme.primary + '15';
                    e.currentTarget.style.borderColor = theme.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)';
                    e.currentTarget.style.borderColor = theme.cardBorder;
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Area - 30-40% of modal */}
        <div style={{
          padding: '20px 24px 24px 24px',
          borderTop: `1px solid ${theme.cardBorder}`,
          background: 'rgba(255, 255, 255, 0.5)'
        }}>
          {/* Initial suggestions */}
          {messages.length === 0 && suggestions.length > 0 && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '16px'
            }}>
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '20px',
                    border: `1px solid ${theme.primary}`,
                    background: theme.primary + '15',
                    color: theme.primary,
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = theme.primary;
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = theme.primary + '15';
                    e.currentTarget.style.color = theme.primary;
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Quick Action Chips */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '12px'
          }}>
            <QuickActionChip
              icon="lightbulb"
              label="Simplify"
              onClick={() => handleQuickAction('simplify')}
              theme={theme}
              disabled={loading}
            />
            <QuickActionChip
              icon="file-text"
              label="Example"
              onClick={() => handleQuickAction('example')}
              theme={theme}
              disabled={loading}
            />
            <QuickActionChip
              icon="volume-2"
              label="Audio"
              onClick={() => handleQuickAction('audio')}
              theme={theme}
              disabled={loading}
            />
          </div>

          {/* Chat Input */}
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-end'
          }}>
            <input
              ref={inputRef}
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !loading && handleSendMessage()}
              placeholder="Ask a question about this card..."
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px 20px',
                borderRadius: '12px',
                border: `1px solid ${theme.cardBorder}`,
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s ease',
                background: 'rgba(255, 255, 255, 0.8)',
                color: theme.textPrimary,
                opacity: loading ? 0.6 : 1
              }}
              onFocus={(e) => {
                e.target.style.borderColor = theme.primary;
                e.target.style.boxShadow = `0 0 0 3px ${theme.primary}20`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = theme.cardBorder;
                e.target.style.boxShadow = 'none';
              }}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!chatInput.trim() || loading}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                background: chatInput.trim() && !loading ? theme.primary : theme.highlight,
                color: chatInput.trim() && !loading ? 'white' : theme.textSecondary,
                fontSize: '14px',
                fontWeight: '600',
                cursor: chatInput.trim() && !loading ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
                minWidth: '80px'
              }}
            >
              Send
            </button>
          </div>
        </div>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  theme: SoftTheme;
  onSaveToCard: (message: ChatMessage) => void;
}

function MessageBubble({ message, theme, onSaveToCard }: MessageBubbleProps) {
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current;

      const updateProgress = () => {
        setAudioProgress((audio.currentTime / audio.duration) * 100 || 0);
      };

      const updateDuration = () => {
        setAudioDuration(audio.duration || 0);
      };

      const handleEnded = () => {
        setAudioPlaying(false);
        setAudioProgress(0);
      };

      audio.addEventListener('timeupdate', updateProgress);
      audio.addEventListener('loadedmetadata', updateDuration);
      audio.addEventListener('ended', handleEnded);

      return () => {
        audio.removeEventListener('timeupdate', updateProgress);
        audio.removeEventListener('loadedmetadata', updateDuration);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [message.audio]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (audioPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setAudioPlaying(!audioPlaying);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      gap: '4px'
    }}>
      <div style={{
        maxWidth: '80%',
        padding: '12px 16px',
        borderRadius: '16px',
        background: isUser
          ? theme.primary
          : isSystem
            ? (message.error ? '#FEE2E2' : theme.highlight)
            : theme.highlight,
        color: isUser ? 'white' : theme.textPrimary,
        fontSize: '14px',
        lineHeight: '1.6',
        border: isSystem && !message.error ? `1px solid ${theme.cardBorder}` : 'none',
        whiteSpace: 'pre-wrap'
      }}>
        {message.content}

        {/* Audio Player */}
        {message.audio && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <audio ref={audioRef} src={message.audio} />
            <button
              onClick={handlePlayPause}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '18px',
                border: 'none',
                background: theme.primary,
                color: 'white',
                fontSize: '18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <LucideIcon name={audioPlaying ? 'pause' : 'play'} size={18} color="white" />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                height: '4px',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '2px',
                overflow: 'hidden',
                marginBottom: '4px'
              }}>
                <div style={{
                  height: '100%',
                  width: `${audioProgress}%`,
                  background: 'white',
                  transition: 'width 0.1s linear'
                }} />
              </div>
              <div style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.8)',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
                <span>{formatTime(audioDuration)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save to Card Button */}
      {!isUser && !isSystem && (message.content || message.audio) && (
        <button
          onClick={() => onSaveToCard(message)}
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            border: `1px solid ${theme.cardBorder}`,
            background: 'rgba(255, 255, 255, 0.6)',
            color: theme.primary,
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            alignSelf: 'flex-start',
            marginTop: '4px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = theme.primary;
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)';
            e.currentTarget.style.color = theme.primary;
          }}
        >
          {message.audio ? 'Add audio to card' : 'Add to card'}
        </button>
      )}
    </div>
  );
}

interface QuickActionChipProps {
  icon: string;
  label: string;
  onClick: () => void;
  theme: SoftTheme;
  disabled?: boolean;
}

function QuickActionChip({ icon, label, onClick, theme, disabled }: QuickActionChipProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 14px',
        borderRadius: '20px',
        border: `1px solid ${theme.cardBorder}`,
        background: disabled ? theme.highlight : 'rgba(255, 255, 255, 0.6)',
        color: disabled ? theme.textSecondary : theme.textPrimary,
        fontSize: '13px',
        fontWeight: '500',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        opacity: disabled ? 0.6 : 1
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = theme.primary + '15';
          e.currentTarget.style.borderColor = theme.primary;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)';
          e.currentTarget.style.borderColor = theme.cardBorder;
        }
      }}
    >
      <LucideIcon name={icon} size={14} color={disabled ? theme.textSecondary : theme.primary} />
      <span>{label}</span>
    </button>
  );
}

export default AIActions;
