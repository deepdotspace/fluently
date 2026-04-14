import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import LucideIcon from './LucideIcon';
import { sanitizeHTML } from '../../utils/fieldSystem';
import { PROMPTS } from '../../utils/prompts';
import { miyagiAPI } from '../../utils/miyagiCompat';

/**
 * SimpleHtmlField - Rich text editor with Quill.js
 *
 * Features:
 * - WYSIWYG editing with Quill.js (default)
 * - Toggle to raw HTML view for power users
 * - Media insertion (images/audio)
 * - Cloze deletion support ({{text}})
 * - AI generation via dedicated AI button
 */


function SimpleHtmlField({
  value = '',
  onChange,
  placeholder = 'Enter content...',
  theme,
  onMediaGenerated,
  media = { images: [], audio: [] },
  onMediaRemove,
  allowCloze = false,
  editorId = 'html-field',
  // AI features
  deck = null,
  isBackField = false,
  frontText = null
}) {
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [quillLoaded, setQuillLoaded] = useState(false);
  const quillRef = useRef(null);
  const toolbarRef = useRef(null);
  const quillInstanceRef = useRef(null);
  const textareaRef = useRef(null);
  const containerRef = useRef(null);


  // AI generation state
  const [toast, setToast] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState(null);
  const [showAIPromptModal, setShowAIPromptModal] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');

  // Media insertion state to prevent value sync conflicts
  const [isInsertingMedia, setIsInsertingMedia] = useState(false);

  // Ref for the AI prompt textarea (for auto-focus)
  const aiTextareaRef = useRef(null);

  // Stable toolbar id (Quill selectors break on spaces/special chars)
  const toolbarId = useMemo(() => `toolbar-${editorId}`.replace(/[^a-zA-Z0-9_-]/g, '-'), [editorId]);

  // Load Quill.js once
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.Quill) {
      setQuillLoaded(true);
      return;
    }

    const quillCSS = document.createElement('link');
    quillCSS.rel = 'stylesheet';
    quillCSS.href = 'https://cdn.quilljs.com/1.3.6/quill.snow.css';
    quillCSS.id = 'quill-css';
    document.head.appendChild(quillCSS);

    const quillScript = document.createElement('script');
    quillScript.src = 'https://cdn.quilljs.com/1.3.6/quill.js';
    quillScript.id = 'quill-js';
    quillScript.onload = () => {
      setQuillLoaded(true);
    };
    document.head.appendChild(quillScript);
  }, []);

  // Initialize Quill instance (only once)
  useEffect(() => {
    if (!quillLoaded || !quillRef.current || quillInstanceRef.current) return;

    const Quill = window.Quill;
    if (!Quill) return;

    try {
      // Clear any existing content in the container
      quillRef.current.innerHTML = '';

      const quill = new Quill(quillRef.current, {
        theme: 'snow',
        placeholder: placeholder,
        modules: {
          toolbar: {
            // Use ref directly; falls back to id selector for safety
            container: toolbarRef.current || `#${toolbarId}`
          }
        }
      });

      // Set initial content
      if (value) {
        quill.root.innerHTML = value;
      }

      // Handle content changes
      quill.on('text-change', () => {
        if (!isHtmlMode) {
          const html = quill.root.innerHTML;
          onChange(html);
        }
      });

      quillInstanceRef.current = quill;

      // Ensure editor is enabled by default (unless generating)
      if (!isGenerating) {
        quill.enable();
      } else {
        quill.enable(false);
      }
    } catch (error) {
      console.error('[SimpleHtmlField] Quill initialization error:', error);
    }

    return () => {
      if (quillInstanceRef.current) {
        quillInstanceRef.current.off('text-change');
        quillInstanceRef.current = null;
      }
    };
  }, [quillLoaded, placeholder, isGenerating]);

  // Disable/enable Quill editor based on generation state
  useEffect(() => {
    if (quillInstanceRef.current) {
      if (isGenerating) {
        quillInstanceRef.current.enable(false);
        console.log('🔒 [Editor] Disabled during generation');
      } else {
        quillInstanceRef.current.enable(true);
        console.log('🔓 [Editor] Enabled after generation');
      }
    }
  }, [isGenerating]);

  // Sync external value changes to Quill (but not during media insertion)
  useEffect(() => {
    if (!isHtmlMode && !isInsertingMedia && quillInstanceRef.current && value !== undefined) {
      const currentContent = quillInstanceRef.current.root.innerHTML;
      const normalizedCurrent = currentContent === '<p><br></p>' ? '' : currentContent;
      const normalizedValue = value || '';

      // Only update if content actually differs
      if (normalizedCurrent !== normalizedValue) {
        quillInstanceRef.current.root.innerHTML = normalizedValue;
      }
    }
  }, [value, isHtmlMode, isInsertingMedia]);

  // Handle textarea changes (HTML mode)
  const handleHtmlChange = useCallback((e) => {
    onChange(e.target.value);
  }, [onChange]);

  // Toggle between WYSIWYG and HTML mode
  const toggleHtmlMode = useCallback(() => {
    if (!isHtmlMode && quillInstanceRef.current) {
      // Switching TO HTML: get content from Quill
      const html = quillInstanceRef.current.root.innerHTML;
      // Normalize empty content
      const normalizedHtml = html === '<p><br></p>' ? '' : html;
      onChange(normalizedHtml);
      setIsHtmlMode(true);

      // Focus textarea after mode switch
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 50);
    } else if (isHtmlMode && quillInstanceRef.current) {
      // Switching FROM HTML: update Quill with textarea content
      const htmlContent = value || '';
      quillInstanceRef.current.root.innerHTML = htmlContent;
      setIsHtmlMode(false);

      // Focus Quill after mode switch
      setTimeout(() => {
        if (quillInstanceRef.current) {
          quillInstanceRef.current.focus();
        }
      }, 50);
    }
  }, [isHtmlMode, value, onChange]);

  // Insert image
  const handleInsertImage = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        setIsInsertingMedia(true);
        const imageUrl = event.target.result;
        const placeholderIndex = media?.images?.length || 0;
        onMediaGenerated?.({ type: 'image', url: imageUrl });

        const imgPlaceholder = `[IMAGE:${placeholderIndex}]`;

        if (isHtmlMode && textareaRef.current) {
          const start = textareaRef.current.selectionStart;
          const text = textareaRef.current.value;
          const newText = text.substring(0, start) + imgPlaceholder + text.substring(start);
          onChange(newText);
          // Restore focus to textarea after media upload
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              const newCursorPos = start + imgPlaceholder.length;
              textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
            setIsInsertingMedia(false);
          }, 200);
        } else if (quillInstanceRef.current) {
          const range = quillInstanceRef.current.getSelection();
          if (range) {
            quillInstanceRef.current.insertText(range.index, imgPlaceholder);
            // Restore focus to Quill editor after media upload and re-render
            setTimeout(() => {
              if (quillInstanceRef.current) {
                quillInstanceRef.current.focus();
                // Try to set cursor position after the inserted text
                try {
                  quillInstanceRef.current.setSelection(range.index + imgPlaceholder.length);
                } catch (e) {
                  // Fallback: just focus the editor
                  quillInstanceRef.current.focus();
                }
              }
              setIsInsertingMedia(false);
            }, 200);
          } else {
            quillInstanceRef.current.insertText(quillInstanceRef.current.getLength(), imgPlaceholder);
            // Restore focus to Quill editor after media upload
            setTimeout(() => {
              if (quillInstanceRef.current) {
                quillInstanceRef.current.focus();
              }
              setIsInsertingMedia(false);
            }, 200);
          }
        } else {
          setIsInsertingMedia(false);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [isHtmlMode, media, onMediaGenerated, onChange]);

  // Insert audio
  const handleInsertAudio = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        setIsInsertingMedia(true);
        const audioUrl = event.target.result;
        const placeholderIndex = media?.audio?.length || 0;
        onMediaGenerated?.({ type: 'audio', url: audioUrl });

        const audioTag = `[AUDIO:${placeholderIndex}]`;

        if (isHtmlMode && textareaRef.current) {
          const start = textareaRef.current.selectionStart;
          const text = textareaRef.current.value;
          const newText = text.substring(0, start) + audioTag + text.substring(start);
          onChange(newText);
          // Restore focus to textarea after media upload
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              const newCursorPos = start + audioTag.length;
              textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
            setIsInsertingMedia(false);
          }, 200);
        } else if (quillInstanceRef.current) {
          const range = quillInstanceRef.current.getSelection();
          if (range) {
            quillInstanceRef.current.insertText(range.index, audioTag);
            // Restore focus to Quill editor after media upload and re-render
            setTimeout(() => {
              if (quillInstanceRef.current) {
                quillInstanceRef.current.focus();
                // Try to set cursor position after the inserted text
                try {
                  quillInstanceRef.current.setSelection(range.index + audioTag.length);
                } catch (e) {
                  // Fallback: just focus the editor
                  quillInstanceRef.current.focus();
                }
              }
              setIsInsertingMedia(false);
            }, 200);
          } else {
            quillInstanceRef.current.insertText(quillInstanceRef.current.getLength(), audioTag);
            // Restore focus to Quill editor after media upload
            setTimeout(() => {
              if (quillInstanceRef.current) {
                quillInstanceRef.current.focus();
              }
              setIsInsertingMedia(false);
            }, 200);
          }
        } else {
          setIsInsertingMedia(false);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [isHtmlMode, media, onMediaGenerated, onChange]);

  // Insert cloze deletion
  const handleInsertCloze = useCallback(() => {
    if (isHtmlMode && textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const text = textareaRef.current.value;
      const selected = text.substring(start, end) || 'text';
      const replacement = `{{${selected}}}`;
      const newText = text.substring(0, start) + replacement + text.substring(end);
      onChange(newText);

      setTimeout(() => {
        if (textareaRef.current) {
          const newPos = start + replacement.length;
          textareaRef.current.setSelectionRange(newPos, newPos);
          textareaRef.current.focus();
        }
      }, 0);
    } else if (quillInstanceRef.current) {
      const range = quillInstanceRef.current.getSelection();
      if (range) {
        const selectedText = quillInstanceRef.current.getText(range.index, range.length) || 'text';
        const clozeText = `{{${selectedText}}}`;
        quillInstanceRef.current.deleteText(range.index, range.length);
        quillInstanceRef.current.insertText(range.index, clozeText);
      }
    }
  }, [isHtmlMode, onChange]);

  // Auto-focus AI prompt textarea when panel opens
  useEffect(() => {
    if (showAIPromptModal && aiTextareaRef.current) {
      setTimeout(() => aiTextareaRef.current?.focus(), 50);
    }
  }, [showAIPromptModal]);

  // Toast notification
  const showToast = useCallback((message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);



  // Insert placeholder helper - centralized logic for inserting media placeholders
  const insertPlaceholderIntoEditor = useCallback((placeholderText) => {
    console.log('📌 [insertPlaceholder] Called with:', placeholderText);
    console.log('📌 [insertPlaceholder] Mode:', isHtmlMode ? 'HTML' : 'Quill');
    console.log('📌 [insertPlaceholder] Current value:', value);

    if (isHtmlMode && textareaRef.current) {
      console.log('📌 [insertPlaceholder] Using HTML mode');
      const start = textareaRef.current.selectionStart;
      const text = textareaRef.current.value;
      const newText = text.substring(0, start) + placeholderText + text.substring(start);
      console.log('📌 [insertPlaceholder] New text:', newText);
      onChange(newText);
      // Restore focus and cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newCursorPos = start + placeholderText.length;
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 50);
    } else if (quillInstanceRef.current) {
      console.log('📌 [insertPlaceholder] Using Quill mode');
      const range = quillInstanceRef.current.getSelection();
      console.log('📌 [insertPlaceholder] Quill range:', range);

      if (range) {
        console.log('📌 [insertPlaceholder] Inserting at index:', range.index);
        quillInstanceRef.current.insertText(range.index, placeholderText);
        // CRITICAL FIX: Manually trigger onChange with updated content
        const html = quillInstanceRef.current.root.innerHTML;
        console.log('📌 [insertPlaceholder] Quill HTML after insert:', html);
        onChange(html);
        // Try to restore cursor position
        setTimeout(() => {
          if (quillInstanceRef.current) {
            try {
              quillInstanceRef.current.setSelection(range.index + placeholderText.length);
            } catch (e) {
              quillInstanceRef.current.focus();
            }
          }
        }, 50);
      } else {
        console.log('📌 [insertPlaceholder] No range, appending at end');
        const length = quillInstanceRef.current.getLength();
        console.log('📌 [insertPlaceholder] Quill length:', length);
        quillInstanceRef.current.insertText(length - 1, placeholderText);
        // CRITICAL FIX: Manually trigger onChange with updated content
        const html = quillInstanceRef.current.root.innerHTML;
        console.log('📌 [insertPlaceholder] Quill HTML after append:', html);
        onChange(html);
      }
    } else {
      console.log('📌 [insertPlaceholder] Fallback mode (no editor ref)');
      // Fallback: append to value
      const newValue = value ? value + ' ' + placeholderText : placeholderText;
      console.log('📌 [insertPlaceholder] Fallback new value:', newValue);
      onChange(newValue);
    }
  }, [isHtmlMode, value, onChange]);

  // Handle AI generation with custom prompt
  const handleGenerateWithPrompt = useCallback(async (prompt) => {
    console.log('🚀 [AI Generation] Starting with prompt:', prompt);
    console.log('🚀 [AI Generation] Current value:', value);
    console.log('🚀 [AI Generation] Current mode:', isHtmlMode ? 'HTML' : 'Quill');
    console.log('🚀 [AI Generation] Media state:', media);

    if (!deck || !prompt?.trim()) {
      showToast('Please enter a prompt', 'error');
      return;
    }

    setIsGenerating(true);
    setGeneratingIndex(-1); // Special index for modal generation

    try {
      const front = frontText || '';
      console.log('🎯 [AI Generation] Front text:', front);

      // First, classify the user's prompt to determine what type of content they want
      console.log('📋 [AI Generation] Sending classification request...');
      const classificationPrompt = PROMPTS.CLASSIFICATION(prompt, deck.targetLang, deck.nativeLang);
      console.log('📋 [AI Generation] Classification prompt:', classificationPrompt.substring(0, 200) + '...');

      const classifyResponse = await miyagiAPI.post('/generate-text', {
        prompt: classificationPrompt,
        provider: 'openai',
        model: 'gpt-4o-mini',  // Using gpt-4o-mini for better reliability
        max_tokens: 200,
        temperature: 0.3  // Lower temperature for more consistent classification
      });

      console.log('📋 [AI Generation] Classification response:', classifyResponse);

      if (!classifyResponse.success) {
        throw new Error(classifyResponse.error || 'Classification failed');
      }

      // Check if response text is empty
      if (!classifyResponse.data?.text || classifyResponse.data.text.trim() === '') {
        console.error('📋 [AI Generation] Classification returned empty text!');
        throw new Error('AI returned empty classification. Please try again.');
      }

      let classification;
      const rawResponse = classifyResponse.data.text.trim();

      try {
        // Try to extract JSON from the response (handle markdown code blocks)
        let jsonText = rawResponse;

        // Remove markdown code blocks if present
        const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1];
        }

        // Try to find JSON object in the text
        const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonText = jsonObjectMatch[0];
        }

        classification = JSON.parse(jsonText);

        // Log classification for debugging
        console.log('[SimpleHtmlField] Classification result:', classification);
      } catch (parseError) {
        console.warn('[SimpleHtmlField] Classification parsing failed:', parseError);
        console.warn('[SimpleHtmlField] Raw response:', rawResponse);

        // Try to infer type from raw response
        const lowerResponse = rawResponse.toLowerCase();
        if (lowerResponse.includes('"type": "audio"') || lowerResponse.includes("'type': 'audio'")) {
          classification = { type: 'audio', refinedPrompt: prompt };
        } else if (lowerResponse.includes('"type": "image"') || lowerResponse.includes("'type': 'image'")) {
          classification = { type: 'image', refinedPrompt: prompt };
        } else {
          // Default to text
          classification = { type: 'text', refinedPrompt: prompt };
        }
        console.warn('[SimpleHtmlField] Inferred classification:', classification);
      }

      // Handle unsafe content
      if (classification.error) {
        throw new Error(classification.error);
      }

      // Ensure we have required fields
      const type = classification.type || 'text';
      const refinedPrompt = classification.refinedPrompt || prompt;
      const extractedWord = classification.extractedWord || null;

      // Route to appropriate API based on classification
      if (type === 'text') {
        console.log('📝 [TEXT Generation] Starting text generation...');

        const textPrompt = isBackField
          ? PROMPTS.AI_CHAT_RESPONSE(front, '', refinedPrompt, deck.targetLang, deck.nativeLang)
          : PROMPTS.TEXT_GENERATION(refinedPrompt, deck.targetLang, deck.nativeLang);

        console.log('📝 [TEXT Generation] Prompt:', textPrompt.substring(0, 200) + '...');

        // Text generation (existing logic)
        const response = await miyagiAPI.post('/generate-text', {
          prompt: textPrompt,
          provider: 'openai',
          model: 'gpt-4o-mini',  // Using gpt-4o-mini for better reliability
          max_tokens: isBackField ? 500 : 300,
          temperature: 0.7
        });

        console.log('📝 [TEXT Generation] Response:', response);

        if (!response.success) {
          throw new Error(response.error || 'Text generation failed');
        }

        // Check if response text is empty
        if (!response.data?.text || response.data.text.trim() === '') {
          console.error('📝 [TEXT Generation] API returned empty text!');
          console.error('📝 [TEXT Generation] Full response:', JSON.stringify(response, null, 2));
          throw new Error('AI returned empty response. Please try again or check your API configuration.');
        }

        const generatedContent = response.data.text.trim();
        console.log('📝 [TEXT Generation] Generated content:', generatedContent);

        const newValue = value ? value + '\n\n' + generatedContent : generatedContent;
        console.log('📝 [TEXT Generation] New value to set:', newValue);

        // CRITICAL FIX: Update both the parent state AND the Quill editor content
        console.log('📝 [TEXT Generation] Calling onChange...');
        onChange(newValue);

        // Update Quill editor content if in Quill mode
        if (!isHtmlMode && quillInstanceRef.current) {
          console.log('📝 [TEXT Generation] Updating Quill editor...');
          quillInstanceRef.current.root.innerHTML = newValue;
          // Move cursor to end
          const length = quillInstanceRef.current.getLength();
          quillInstanceRef.current.setSelection(length);
          console.log('📝 [TEXT Generation] Quill updated, length:', length);
        } else if (isHtmlMode) {
          console.log('📝 [TEXT Generation] In HTML mode, onChange should update textarea');
        }

        console.log('✅ [TEXT Generation] Complete!');
        showToast('Text generated successfully!', 'success');

      } else if (type === 'image') {
        console.log('🖼️ [IMAGE Generation] Starting image generation...');

        const imagePrompt = PROMPTS.IMAGE_GENERATION(refinedPrompt, deck.targetLang);
        console.log('🖼️ [IMAGE Generation] Prompt:', imagePrompt.substring(0, 200) + '...');

        // Image generation
        const imageResponse = await miyagiAPI.post('/generate-image', {
          prompt: imagePrompt,
          provider: 'openai',
          model: 'dall-e-3',
          size: '1024x1024',
          quality: 'standard'
        });

        console.log('🖼️ [IMAGE Generation] Response:', imageResponse);
        if (!imageResponse.success) throw new Error(imageResponse.error || 'Image generation failed');

        // Add generated image to media
        // CRITICAL FIX: API returns imageUrls (array), not imageUrl (singular)
        const imageUrl = imageResponse.data.imageUrls?.[0] || imageResponse.data.imageUrl || imageResponse.data.url;
        console.log('🖼️ [IMAGE Generation] Image URL:', imageUrl);
        console.log('🖼️ [IMAGE Generation] Full response data:', imageResponse.data);

        if (imageUrl) {
          // Calculate placeholder index based on current media state BEFORE adding new media
          const placeholderIndex = media?.images?.length || 0;
          const imgPlaceholder = `[IMAGE:${placeholderIndex}]`;
          console.log('🖼️ [IMAGE Generation] Placeholder:', imgPlaceholder, 'Index:', placeholderIndex);
          console.log('🖼️ [IMAGE Generation] Current media images:', media?.images);

          // IMPORTANT: Update parent state AND insert placeholder together
          if (onMediaGenerated) {
            // CRITICAL FIX: Set flag to prevent external value sync conflicts
            setIsInsertingMedia(true);

            console.log('🖼️ [IMAGE Generation] Calling onMediaGenerated...');
            onMediaGenerated({ type: 'image', url: imageUrl });

            // Insert placeholder immediately after calling onMediaGenerated
            // The placeholder index matches what will be the media array index
            console.log('🖼️ [IMAGE Generation] Inserting placeholder into editor...');
            insertPlaceholderIntoEditor(imgPlaceholder);

            // Reset flag after a delay to allow state updates to complete
            setTimeout(() => {
              setIsInsertingMedia(false);
              console.log('🖼️ [IMAGE Generation] Media insertion flag reset');
            }, 200);

            console.log('✅ [IMAGE Generation] Complete!');
            showToast('Image generated successfully!', 'success');
          } else {
            console.warn('[SimpleHtmlField] onMediaGenerated callback not provided');
            throw new Error('Media generation callback not available');
          }
        } else {
          throw new Error('No image URL received');
        }

      } else if (type === 'audio') {
        // CRITICAL FIX: Use extractedWord from classification if available
        let audioContent;

        if (extractedWord) {
          // Use the word extracted by the classifier
          audioContent = extractedWord;
        } else {
          // Fallback: use AI to extract the word
          const audioTextPrompt = PROMPTS.AUDIO_GENERATION(refinedPrompt, deck.targetLang, deck.nativeLang);

          // Audio generation using text-to-speech
          const audioText = await miyagiAPI.post('/generate-text', {
            prompt: audioTextPrompt,
            provider: 'openai',
            model: 'gpt-4o-mini',
            max_tokens: 100,
            temperature: 0.3
          });

          if (!audioText.success) {
            throw new Error(audioText.error || 'Audio text generation failed');
          }

          // Check if response text is empty and handle fallback
          if (!audioText.data?.text || audioText.data.text.trim() === '') {
            console.error('🔊 [AUDIO Generation] API returned empty text for audio!');
            // Final fallback: use the refined prompt directly
            const fallbackText = refinedPrompt.replace(/^(pronounce:|audio for:?|generate audio for:?)\s*/i, '').trim();

            if (!fallbackText) {
              throw new Error('Could not extract text for audio. Please try again.');
            }

            audioContent = fallbackText;
          } else {
            audioContent = audioText.data.text.trim();
          }
        }

        // CRITICAL FIX: Repeat word twice for better pronunciation practice
        // Format: "word... word" with pause in between
        const repeatedText = `${audioContent}... ${audioContent}`;

        // Generate speech from text
        const audioResponse = await miyagiAPI.post('/text-to-speech', {
          text: repeatedText,
          voice: PROMPTS.getAudioVoiceForLanguage(deck.targetLang),
          provider: 'openai',
          speed: 0.6
        });

        if (!audioResponse.success) throw new Error(audioResponse.error || 'Audio generation failed');

        // Add generated audio to media
        // Support both audioUrl and url field names
        const audioUrl = audioResponse.data.audioUrl || audioResponse.data.url;

        if (audioUrl) {
          // Calculate placeholder index based on current media state BEFORE adding new media
          const placeholderIndex = media?.audio?.length || 0;
          const audioPlaceholder = `[AUDIO:${placeholderIndex}]`;

          // IMPORTANT: Update parent state AND insert placeholder together
          if (onMediaGenerated) {
            // CRITICAL FIX: Set flag to prevent external value sync conflicts
            setIsInsertingMedia(true);

            onMediaGenerated({ type: 'audio', url: audioUrl });

            // Insert placeholder immediately after calling onMediaGenerated
            // The placeholder index matches what will be the media array index
            insertPlaceholderIntoEditor(audioPlaceholder);

            // Reset flag after a delay to allow state updates to complete
            setTimeout(() => {
              setIsInsertingMedia(false);
            }, 200);

            showToast('Audio generated successfully!', 'success');
          } else {
            console.warn('[SimpleHtmlField] onMediaGenerated callback not provided');
            throw new Error('Media generation callback not available');
          }
        } else {
          throw new Error('No audio URL received');
        }

      } else {
        // Fallback to text generation for unknown types
        console.warn('[SimpleHtmlField] Unknown classification type, defaulting to text:', type);

        const fallbackPrompt = PROMPTS.TEXT_GENERATION(refinedPrompt, deck.targetLang, deck.nativeLang);
        console.log('📝 [FALLBACK] Using prompt:', fallbackPrompt.substring(0, 200) + '...');

        const response = await miyagiAPI.post('/generate-text', {
          prompt: fallbackPrompt,
          provider: 'openai',
          model: 'gpt-4o-mini',
          max_tokens: 300,
          temperature: 0.7
        });

        if (!response.success) {
          throw new Error(response.error || 'Generation failed');
        }

        if (!response.data?.text || response.data.text.trim() === '') {
          console.error('📝 [FALLBACK] API returned empty text!');
          throw new Error('AI returned empty response. Please try again.');
        }

        const generatedContent = response.data.text.trim();
        const newValue = value ? value + '\n\n' + generatedContent : generatedContent;

        // CRITICAL FIX: Update both the parent state AND the Quill editor content
        onChange(newValue);

        // Update Quill editor content if in Quill mode
        if (!isHtmlMode && quillInstanceRef.current) {
          quillInstanceRef.current.root.innerHTML = newValue;
          // Move cursor to end
          const length = quillInstanceRef.current.getLength();
          quillInstanceRef.current.setSelection(length);
        }

        showToast('Content generated successfully!', 'success');
      }

    } catch (error) {
      console.error('[SimpleHtmlField] Generation error:', error);
      showToast(error.message || 'Generation failed', 'error');
      setShowAIPromptModal(true); // Re-open modal on error
    } finally {
      setIsGenerating(false);
      setGeneratingIndex(null);
      setAIPrompt('');
    }
  }, [deck, frontText, value, onChange, showToast, isBackField, media, onMediaGenerated, insertPlaceholderIntoEditor]);


  // Render media previews
  const mediaPreviews = useMemo(() => {
    const previews = [];

    if (media?.images?.length > 0) {
      media.images.forEach((url, index) => {
        previews.push(
          <div
            key={`img-${index}`}
            style={{
              position: 'relative',
              display: 'inline-block',
              margin: '4px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: `2px solid ${theme?.cardBorder || '#e5e7eb'}`
            }}
          >
            <img
              src={url}
              alt={`Preview ${index + 1}`}
              style={{
                width: '60px',
                height: '60px',
                objectFit: 'cover',
                display: 'block'
              }}
            />
            {onMediaRemove && (
              <button
                onClick={() => onMediaRemove('image', index)}
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.9)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
              >
                <LucideIcon name="x" size={12} color="white" />
              </button>
            )}
          </div>
        );
      });
    }

    if (media?.audio?.length > 0) {
      media.audio.forEach((url, index) => {
        previews.push(
          <div
            key={`aud-${index}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              margin: '4px',
              borderRadius: '8px',
              background: `${theme?.primary || '#3b82f6'}15`,
              border: `1px solid ${theme?.cardBorder || '#e5e7eb'}`
            }}
          >
            <LucideIcon name="volume-2" size={14} color={theme?.textPrimary || '#1f2937'} />
            <audio controls style={{ height: '24px', width: '120px' }} src={url}>
              Your browser does not support audio.
            </audio>
            {onMediaRemove && (
              <button
                onClick={() => onMediaRemove('audio', index)}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.9)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <LucideIcon name="x" size={12} color="white" />
              </button>
            )}
          </div>
        );
      });
    }

    return previews;
  }, [media, theme, onMediaRemove]);

  if (!quillLoaded) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: theme?.textSecondary || '#6b7280' }}>
        Loading editor...
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {/* Integrated Toolbar */}
      <div
        ref={toolbarRef}
        id={toolbarId}
        style={{
          display: isHtmlMode ? 'none' : 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          background: 'rgba(255, 255, 255, 0.5)',
          borderRadius: '16px 16px 0 0',
          border: `2px solid ${theme?.cardBorder || '#e2e8f0'}`,
          borderBottom: 'none',
          flexWrap: 'wrap',
          minHeight: '48px'
        }}
      >
        {/* Formatting buttons */}
        <button className="ql-bold" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
        <button className="ql-italic" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
        <button className="ql-underline" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
        <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 4px' }} />
        <button className="ql-list" value="ordered" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
        <button className="ql-list" value="bullet" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
        <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 4px' }} />

        {/* Media and AI Group */}
        <ToolbarButton
          onClick={handleInsertAudio}
          title="Insert Audio"
          icon={<LucideIcon name="volume-2" size={18} color={theme.primary} />}
          theme={theme}
        />
        <ToolbarButton
          onClick={handleInsertImage}
          title="Insert Image"
          icon={<LucideIcon name="image" size={18} color={theme.primary} />}
          theme={theme}
        />

        {allowCloze && (
          <ToolbarButton
            onClick={handleInsertCloze}
            title="Cloze Deletion"
            icon={<LucideIcon name="brackets" size={18} color={theme.primary} />}
            theme={theme}
          />
        )}

        {deck && (
          <ToolbarButton
            onClick={() => setShowAIPromptModal(true)}
            title="AI Content Generation"
            icon={<LucideIcon name="sparkles" size={18} color="white" />}
            theme={theme}
            disabled={isGenerating}
            isAI={true}
          />
        )}

        <div style={{ marginLeft: 'auto' }} />

        <ToolbarButton
          onClick={toggleHtmlMode}
          title={isHtmlMode ? 'Switch to Visual' : 'Switch to HTML'}
          icon={<LucideIcon name="code" size={18} color={theme.textSecondary} />}
          theme={theme}
          active={isHtmlMode}
        />
      </div>

      {/* HTML Mode Toolbar (Simplified) */}
      {isHtmlMode && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            background: '#1e293b',
            borderRadius: '16px 16px 0 0',
            border: '2px solid #334155',
            borderBottom: 'none'
          }}
        >
          <LucideIcon name="code" size={14} color="#94a3b8" />
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', letterSpacing: '1px' }}>HTML SOURCE</span>
          <div style={{ marginLeft: 'auto' }} />
          <ToolbarButton
            onClick={toggleHtmlMode}
            title="Switch to Visual"
            icon={<LucideIcon name="eye" size={16} color="white" />}
            theme={{ ...theme, primary: '#3b82f6', textPrimary: '#fff', cardBorder: '#334155' }}
            active={true}
          />
        </div>
      )}

      {/* Inline AI Prompt Panel — shown between toolbar and editor */}
      {showAIPromptModal && (
        <div style={{
          padding: '16px',
          background: `linear-gradient(135deg, ${theme?.primary || '#3b82f6'}08 0%, ${theme?.primary || '#3b82f6'}15 100%)`,
          border: `2px solid ${theme?.primary || '#3b82f6'}40`,
          borderTop: 'none',
          borderBottom: 'none'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '10px'
          }}>
            <LucideIcon name="sparkles" size={16} color={theme?.primary || '#3b82f6'} />
            <span style={{
              fontSize: '13px',
              fontWeight: '700',
              color: theme?.primary || '#3b82f6',
              letterSpacing: '0.3px'
            }}>
              AI Generate
            </span>
          </div>

          <textarea
            ref={aiTextareaRef}
            placeholder={isBackField ? "e.g., Explain this concept in simple terms" : "Describe what to generate..."}
            value={aiPrompt}
            onChange={(e) => setAIPrompt(e.target.value)}
            disabled={isGenerating}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && aiPrompt?.trim() && !isGenerating) {
                setShowAIPromptModal(false);
                handleGenerateWithPrompt(aiPrompt);
              }
              if (e.key === 'Escape') {
                setShowAIPromptModal(false);
                setAIPrompt('');
              }
            }}
            style={{
              width: '100%',
              minHeight: '60px',
              padding: '10px 12px',
              border: `1px solid ${theme?.cardBorder || '#e5e7eb'}`,
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              resize: 'vertical',
              background: 'white',
              color: theme?.textPrimary || '#1e293b',
              boxSizing: 'border-box',
              fontFamily: 'inherit'
            }}
          />

          <div style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            marginTop: '10px',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '11px', color: theme?.textSecondary || '#94a3b8', marginRight: 'auto' }}>
              {'\u2318'}+Enter to generate
            </span>
            <button
              onClick={() => { setShowAIPromptModal(false); setAIPrompt(''); }}
              style={{
                padding: '6px 14px',
                background: 'white',
                color: theme?.textSecondary || '#64748b',
                border: `1px solid ${theme?.cardBorder || '#e5e7eb'}`,
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowAIPromptModal(false);
                handleGenerateWithPrompt(aiPrompt || (isBackField ? 'Generate appropriate content' : ''));
              }}
              disabled={isGenerating || !aiPrompt?.trim()}
              style={{
                padding: '6px 16px',
                background: !isGenerating && aiPrompt?.trim()
                  ? `linear-gradient(135deg, ${theme?.primary || '#3b82f6'} 0%, ${theme?.textSecondary || '#64748b'} 100%)`
                  : 'rgba(156, 163, 175, 0.5)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: (!isGenerating && aiPrompt?.trim()) ? 'pointer' : 'not-allowed',
                opacity: (!isGenerating && aiPrompt?.trim()) ? 1 : 0.5
              }}
            >
              Generate
            </button>
          </div>
        </div>
      )}

      {/* Quill Editor (WYSIWYG mode) */}
      <div
        ref={quillRef}
        style={{
          display: isHtmlMode ? 'none' : 'block',
          minHeight: '140px',
          border: `2px solid ${theme?.cardBorder || '#e2e8f0'}`,
          borderRadius: showAIPromptModal ? '0' : '0 0 16px 16px',
          background: 'rgba(255, 255, 255, 0.5)',
          overflow: 'hidden'
        }}
      />

      {/* HTML Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleHtmlChange}
        placeholder={placeholder}
        spellCheck={false}
        disabled={isGenerating}
        style={{
          display: isHtmlMode ? 'block' : 'none',
          width: '100%',
          minHeight: '140px',
          padding: '20px',
          fontSize: '14px',
          fontFamily: '"JetBrains Mono", "Fira Code", "Monaco", monospace',
          border: `2px solid #334155`,
          borderRadius: '0 0 16px 16px',
          outline: 'none',
          resize: 'vertical',
          background: '#0f172a',
          color: '#f8fafc',
          lineHeight: '1.6',
          boxSizing: 'border-box',
          opacity: isGenerating ? 0.6 : 1,
          cursor: isGenerating ? 'not-allowed' : 'text'
        }}
      />

      {/* AI Generating Indicator */}
      {isGenerating && (
        <div style={{
          marginTop: '12px',
          padding: '12px 16px',
          background: 'rgba(59, 130, 246, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{
            display: 'inline-block',
            width: '16px',
            height: '16px',
            border: '2px solid rgba(59, 130, 246, 0.3)',
            borderTopColor: theme?.primary || '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <span style={{
            fontSize: '14px',
            fontWeight: '600',
            color: theme?.primary || '#3b82f6'
          }}>
            AI is generating content...
          </span>
        </div>
      )}

      {/* AI prompt is now rendered inline above the editor — no modal needed */}


      {/* Media Previews */}
      {mediaPreviews.length > 0 && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: 'rgba(0, 0, 0, 0.02)',
          borderRadius: '8px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px'
        }}>
          {mediaPreviews}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '40px',
            right: '40px',
            padding: '16px 24px',
            background: toast.type === 'error' ? '#ef4444' : toast.type === 'info' ? '#3b82f6' : '#10b981',
            color: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            zIndex: 10000,
            fontSize: '14px',
            fontWeight: '600'
          }}
        >
          {toast.message}
        </div>
      )}

      <style>{`
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.ql-toolbar {
  background: #ffffff !important;
  border: 2px solid ${theme?.cardBorder || '#e2e8f0'} !important;
  border-bottom: none !important;
  border-radius: 16px 16px 0 0;
  padding: 10px 16px !important;
  display: flex;
  align-items: center;
  gap: 4px;
}

.ql-toolbar button {
  width: 32px !important;
  height: 32px !important;
  padding: 6px !important;
  border-radius: 8px;
  transition: all 0.2s;
  margin: 0 !important;
  color: ${theme?.textPrimary || '#1e293b'} !important;
}

.ql-toolbar button:hover {
  background: ${theme?.primary}10 !important;
  color: ${theme?.primary} !important;
}

.ql-toolbar button.ql-active {
  background: ${theme?.primary}15 !important;
  color: ${theme?.primary} !important;
}

.ql-stroke {
  stroke: ${theme?.textPrimary || '#1e293b'} !important;
  stroke-width: 2px !important;
}

.ql-toolbar button:hover .ql-stroke,
.ql-toolbar button.ql-active .ql-stroke {
  stroke: ${theme?.primary} !important;
}

.ql-container {
  font-size: 15px;
  font-family: inherit;
  border: 2px solid ${theme?.cardBorder || '#e2e8f0'} !important;
  border-radius: 0 0 16px 16px;
  background: #ffffff !important;
  color: ${theme?.textPrimary || '#1e293b'} !important;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.01);
}

.ql-editor {
  min-height: 140px;
  padding: 16px 20px;
  line-height: 1.6;
}

.ql-editor.ql-blank::before {
  color: ${theme?.textSecondary || '#64748b'}80 !important;
  font-style: italic;
  left: 20px !important;
}
`}</style>
    </div>
  );
}

function ToolbarButton({ onClick, title, icon, theme, active = false, disabled = false, isAI = false }) {
  const iconElement = typeof icon === 'string' ? icon : React.cloneElement(icon, { color: active ? 'white' : (theme?.textPrimary || '#1f2937') });

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        padding: isAI ? '4px 12px' : '4px 8px',
        fontSize: isAI ? '14px' : (typeof icon === 'string' && icon.length > 2 ? '14px' : '13px'),
        fontWeight: isAI ? '800' : '600',
        background: active ? (theme?.primary || '#3b82f6') : 'transparent',
        color: active ? 'white' : (theme?.textPrimary || '#1f2937'),
        border: `1px solid ${active ? (theme?.primary || '#3b82f6') : (theme?.cardBorder || '#e5e7eb')}`,
        borderRadius: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: isAI ? '44px' : '28px',
        height: '28px',
        opacity: disabled ? 0.5 : 1
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled) {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active && !disabled) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      {iconElement}
    </button>
  );
}

export default SimpleHtmlField;
