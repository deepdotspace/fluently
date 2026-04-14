import React, { useState, useRef, useEffect, useMemo } from 'react';
import LucideIcon from './LucideIcon';
import RichTextRenderer from './RichTextRenderer';
import { PROMPTS } from '../../utils/prompts';
import { miyagiAPI } from '../../utils/miyagiCompat';

/**
 * PronunciationReview - Audio recording and AI-based pronunciation evaluation
 * 
 * Features:
 * - Record user pronunciation
 * - Transcribe using speech-to-text API
 * - Evaluate pronunciation accuracy with AI
 * - Auto-rate based on AI score (1-4 buttons)
 */
function PronunciationReview({ card, theme, onRating, deck = null }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [suggestedRating, setSuggestedRating] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Helper function to strip HTML tags
  const stripHTML = (html) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  // Get raw field values
  const rawTargetWord = card?.content?.fields?.Word || '';
  const rawTranslation = card?.content?.fields?.Translation || '';
  const rawPronunciationGuide = card?.content?.fields?.Pronunciation || '';
  const rawHint = card?.content?.fields?.Hint || '';

  // Memoize stripped values to avoid excessive re-renders
  const targetWord = useMemo(() => stripHTML(rawTargetWord), [rawTargetWord]);
  const translation = useMemo(() => stripHTML(rawTranslation), [rawTranslation]);
  const strippedPronunciation = useMemo(() => stripHTML(rawPronunciationGuide), [rawPronunciationGuide]);
  const hint = useMemo(() => stripHTML(rawHint), [rawHint]);

  // Debug card fields once per card (after all values are stripped)
  useEffect(() => {
    if (card?.id) {
      console.log('[PronunciationReview] All fields stripped:', {
        'Word (stripped)': targetWord,
        'Translation (stripped)': translation,
        'Pronunciation (stripped)': strippedPronunciation,
        'Hint (stripped)': hint
      });
    }
  }, [card?.id, targetWord, translation, strippedPronunciation, hint]);

  // Get language information from deck
  const targetLang = deck?.targetLang || 'Spanish';
  const nativeLang = deck?.nativeLang || 'English';

  // Map language names to language codes for speech-to-text API
  const getLanguageCode = (langName) => {
    const langMap = {
      'spanish': 'es',
      'french': 'fr',
      'german': 'de',
      'italian': 'it',
      'portuguese': 'pt',
      'chinese': 'zh',
      'japanese': 'ja',
      'korean': 'ko',
      'russian': 'ru',
      'arabic': 'ar',
      'hindi': 'hi',
      'english': 'en'
    };
    return langMap[(langName || '').toLowerCase()] || 'en';
  };

  const languageCode = getLanguageCode(targetLang);

  // Request microphone permission on mount
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .catch(err => {
          console.error('Microphone permission denied:', err);
          setError('Microphone access is required for pronunciation practice.');
        });
    } else {
      setError('Your browser does not support audio recording.');
    }
  }, []);

  const startRecording = async () => {
    try {
      setError('');
      setTranscription('');
      setEvaluation(null);
      setSuggestedRating(null);
      setAudioBlob(null);
      setAudioUrl(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Use supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Auto-process after recording
        await processAudio(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (blob) => {
    setIsProcessing(true);
    setError('');

    try {
      // Step 1: Convert audio blob to base64
      const base64Audio = await blobToBase64(blob);

      // Step 2: Transcribe audio using speech-to-text API
      const transcribeResponse = await miyagiAPI.post('speech-to-text', {
        audio: base64Audio,
        language: languageCode // Use the target language code instead of hardcoded 'en'
      });

      if (!transcribeResponse.success) {
        throw new Error(transcribeResponse.error || 'Failed to transcribe audio');
      }

      const transcribedText = transcribeResponse.data?.text || '';
      setTranscription(transcribedText);

      // Step 3: Evaluate pronunciation with AI
      const evaluationPrompt = PROMPTS.PRONUNCIATION_EVALUATION(targetWord, strippedPronunciation, transcribedText, targetLang, nativeLang);

      const evalResponse = await miyagiAPI.post('generate-text', {
        prompt: evaluationPrompt,
        provider: 'openai',
        model: 'gpt-4o-mini', // Changed from gpt-5-mini for better reliability
        temperature: 0.3,
        max_tokens: 500
      });

      if (!evalResponse.success) {
        throw new Error(evalResponse.error || 'Failed to evaluate pronunciation');
      }

      // Parse AI response (handle both JSON and text)
      let evalData;
      try {
        const jsonMatch = evalResponse.data.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          evalData = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback parsing
          evalData = {
            score: 70,
            feedback: evalResponse.data.text,
            issues: []
          };
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        evalData = {
          score: 70,
          feedback: evalResponse.data.text,
          issues: []
        };
      }

      setEvaluation(evalData);

      // Step 4: Map score to rating (1-4)
      const rating = scoreToRating(evalData.score);
      setSuggestedRating(rating);

    } catch (err) {
      console.error('Error processing audio:', err);
      setError(err.message || 'Failed to process audio. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Convert blob to base64
  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Map AI score (1-100) to spaced repetition rating (1-4)
  const scoreToRating = (score) => {
    if (score >= 90) return 4; // Easy - perfect pronunciation
    if (score >= 75) return 3; // Good - minor issues
    if (score >= 50) return 2; // Hard - noticeable issues
    return 1; // Again - needs more practice
  };

  const getRatingLabel = (rating) => {
    const labels = ['Again', 'Hard', 'Good', 'Easy'];
    return labels[rating - 1];
  };

  const getRatingColor = (rating) => {
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6'];
    return colors[rating - 1];
  };

  const handleAcceptRating = () => {
    if (suggestedRating && onRating) {
      onRating(suggestedRating);
    }
  };

  const handleCustomRating = (rating) => {
    if (onRating) {
      onRating(rating);
    }
  };

  const [showBack, setShowBack] = useState(false);

  // Reset state when card changes
  useEffect(() => {
    setIsRecording(false);
    setAudioBlob(null);
    setAudioUrl(null);
    setTranscription('');
    setEvaluation(null);
    setIsProcessing(false);
    setError('');
    setSuggestedRating(null);
    setShowBack(false);
  }, [card?.id]);

  // Show back when evaluation is ready
  useEffect(() => {
    if (evaluation) {
      setShowBack(true);
    }
  }, [evaluation]);

  // Calculate dynamic font sizes based on content length
  const getWordFontSize = () => {
    const length = targetWord.length;
    if (length <= 8) return '48px';
    if (length <= 12) return '40px';
    if (length <= 16) return '32px';
    return '28px';
  };

  const getTranslationFontSize = () => {
    if (!translation) return '20px';
    const length = translation.length;
    if (length <= 20) return '20px';
    if (length <= 40) return '18px';
    if (length <= 60) return '16px';
    return '14px';
  };

  const getPronunciationFontSize = () => {
    if (!strippedPronunciation) return '18px';
    const textLength = strippedPronunciation.length;
    if (textLength <= 30) return '18px';
    if (textLength <= 50) return '16px';
    if (textLength <= 80) return '14px';
    return '13px';
  };


  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      alignItems: 'center',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Card Container with 3D Flip */}
      <div style={{
        width: '100%',
        maxWidth: '480px',
        height: '400px',
        perspective: '1000px'
      }}>
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)',
          transform: showBack ? 'rotateY(180deg)' : 'rotateY(0deg)'
        }}>
          {/* Front Side - Word & Pronunciation */}
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            background: theme.cardBg,
            backdropFilter: `blur(${theme.backdropBlur})`,
            WebkitBackdropFilter: `blur(${theme.backdropBlur})`,
            borderRadius: '20px',
            border: `1px solid ${theme.cardBorder}`,
            boxShadow: '0 12px 48px rgba(0, 0, 0, 0.08)',
            padding: '32px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            boxSizing: 'border-box',
            overflowY: 'auto'
          }}>
            {/* Label */}
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
              Pronunciation
            </div>

            {/* Word Display */}
            <div style={{
              fontSize: getWordFontSize(),
              fontWeight: '700',
              color: theme.textPrimary,
              textAlign: 'center',
              marginBottom: '4px',
              wordBreak: 'break-word',
              maxWidth: '90%'
            }}>
              {targetWord}
            </div>

            {translation && (
              <div style={{
                fontSize: getTranslationFontSize(),
                color: theme.textSecondary,
                textAlign: 'center',
                marginBottom: '4px',
                wordBreak: 'break-word',
                maxWidth: '90%'
              }}>
                {translation}
              </div>
            )}

            {strippedPronunciation && (
              <div style={{
                fontSize: getPronunciationFontSize(),
                color: theme.textPrimary,
                textAlign: 'center',
                background: `${theme.primary}10`,
                padding: '12px 20px',
                borderRadius: '12px',
                maxWidth: '90%',
                lineHeight: '1.5',
                wordBreak: 'break-word'
              }}>
                {strippedPronunciation}
              </div>
            )}

            {hint && (
              <div style={{
                fontSize: '13px',
                color: theme.textSecondary,
                fontStyle: 'italic',
                textAlign: 'center',
                marginTop: '8px',
                maxWidth: '90%',
                lineHeight: '1.4'
              }}>
                {hint}
              </div>
            )}
          </div>

          {/* Back Side - AI Review Results */}
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: theme.cardBg,
            backdropFilter: `blur(${theme.backdropBlur})`,
            WebkitBackdropFilter: `blur(${theme.backdropBlur})`,
            borderRadius: '20px',
            border: `1px solid ${theme.cardBorder}`,
            boxShadow: '0 12px 48px rgba(0, 0, 0, 0.08)',
            padding: '32px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxSizing: 'border-box',
            overflowY: 'auto',
            gap: '16px'
          }}>
            {/* Label */}
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
              Results
            </div>

            {evaluation && (
              <>
                {/* Score Display */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '20px'
                }}>
                  <div style={{
                    fontSize: '56px',
                    fontWeight: '700',
                    color: getRatingColor(suggestedRating),
                    textAlign: 'center',
                    lineHeight: '1'
                  }}>
                    {evaluation.score}%
                  </div>
                  <div style={{
                    fontSize: '16px',
                    color: theme.textSecondary,
                    textAlign: 'center'
                  }}>
                    Suggested: <span style={{
                      fontWeight: '600',
                      color: getRatingColor(suggestedRating)
                    }}>{getRatingLabel(suggestedRating)}</span>
                  </div>
                </div>

                {/* Transcription */}
                <div style={{ width: '100%' }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: theme.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '6px'
                  }}>
                    You said:
                  </div>
                  <div style={{
                    fontSize: '15px',
                    color: theme.textPrimary,
                    fontStyle: 'italic',
                    padding: '10px 12px',
                    background: 'rgba(0,0,0,0.02)',
                    borderRadius: '8px'
                  }}>
                    "{transcription}"
                  </div>
                </div>

                {/* Feedback */}
                <div style={{ width: '100%' }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: theme.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '6px'
                  }}>
                    Feedback:
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: theme.textPrimary,
                    lineHeight: '1.5'
                  }}>
                    {evaluation.feedback}
                  </div>
                </div>

                {/* Issues */}
                {evaluation.issues && evaluation.issues.length > 0 && (
                  <div style={{ width: '100%' }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: theme.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px'
                    }}>
                      Areas to improve:
                    </div>
                    <ul style={{
                      fontSize: '13px',
                      color: theme.textPrimary,
                      lineHeight: '1.5',
                      paddingLeft: '20px',
                      margin: 0
                    }}>
                      {evaluation.issues.map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recording Controls - Below Card */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        alignItems: 'center',
        width: '100%',
        maxWidth: '480px'
      }}>
        {!audioBlob && !evaluation && (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            style={{
              padding: '16px 40px',
              fontSize: '16px',
              fontWeight: '600',
              background: isRecording
                ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                : `linear-gradient(135deg, ${theme.primary}, ${theme.textSecondary})`,
              color: 'white',
              border: 'none',
              borderRadius: '50px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              boxShadow: `0 6px 20px ${isRecording ? '#EF4444' : theme.primary}40`,
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
            onMouseEnter={(e) => {
              if (!isProcessing) {
                e.target.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
            }}
          >
            <LucideIcon name={isRecording ? "square" : "mic"} size={24} color="white" />
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
        )}

        {audioUrl && !isProcessing && !evaluation && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            width: '100%',
            alignItems: 'center'
          }}>
            <audio
              src={audioUrl}
              controls
              style={{
                width: '100%',
                maxWidth: '300px',
                borderRadius: '8px'
              }}
            />
            <button
              onClick={() => {
                setAudioBlob(null);
                setAudioUrl(null);
                setTranscription('');
                setEvaluation(null);
                setSuggestedRating(null);
                setShowBack(false);
              }}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                background: 'rgba(0,0,0,0.05)',
                color: theme.textSecondary,
                border: `1px solid ${theme.cardBorder}`,
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Record Again
            </button>
          </div>
        )}

        {isProcessing && (
          <div style={{
            fontSize: '16px',
            color: theme.textSecondary,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: `4px solid ${theme.cardBorder}`,
              borderTopColor: theme.primary,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            Analyzing pronunciation...
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '16px',
            background: '#FEE2E2',
            color: '#DC2626',
            borderRadius: '12px',
            fontSize: '14px',
            textAlign: 'center',
            maxWidth: '400px'
          }}>
            {error}
          </div>
        )}

        {/* Rating Buttons - Show after evaluation */}
        {evaluation && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            width: '100%',
            marginTop: '8px'
          }}>
            <button
              onClick={handleAcceptRating}
              style={{
                padding: '16px',
                fontSize: '16px',
                fontWeight: '600',
                background: `linear-gradient(135deg, ${getRatingColor(suggestedRating)}, ${getRatingColor(suggestedRating)}dd)`,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: `0 4px 16px ${getRatingColor(suggestedRating)}40`,
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = `0 6px 20px ${getRatingColor(suggestedRating)}50`;
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = `0 4px 16px ${getRatingColor(suggestedRating)}40`;
              }}
            >
              Accept "{getRatingLabel(suggestedRating)}" Rating
            </button>

            {/* Alternative ratings */}
            <div style={{
              display: 'flex',
              gap: '8px',
              justifyContent: 'center'
            }}>
              {[1, 2, 3, 4].filter(r => r !== suggestedRating).map(rating => (
                <button
                  key={rating}
                  onClick={() => handleCustomRating(rating)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: '500',
                    background: 'rgba(0,0,0,0.03)',
                    color: theme.textSecondary,
                    border: `1px solid ${theme.cardBorder}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = `${getRatingColor(rating)}15`;
                    e.target.style.borderColor = getRatingColor(rating);
                    e.target.style.color = getRatingColor(rating);
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(0,0,0,0.03)';
                    e.target.style.borderColor = theme.cardBorder;
                    e.target.style.color = theme.textSecondary;
                  }}
                >
                  {getRatingLabel(rating)}
                </button>
              ))}
            </div>

            {/* Record Again Button */}
            <button
              onClick={() => {
                setAudioBlob(null);
                setAudioUrl(null);
                setTranscription('');
                setEvaluation(null);
                setSuggestedRating(null);
                setShowBack(false);
              }}
              style={{
                padding: '12px 20px',
                fontSize: '14px',
                background: 'rgba(0,0,0,0.05)',
                color: theme.textSecondary,
                border: `1px solid ${theme.cardBorder}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(0,0,0,0.08)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(0,0,0,0.05)';
              }}
            >
              Record Again
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default PronunciationReview;

