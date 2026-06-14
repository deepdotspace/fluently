import React, { useMemo, useState, useRef, useEffect, type ReactNode } from 'react';
import { isMediaReference, extractMediaId, extractMediaType, getMediaUrl } from '../../utils/mediaStorage';
import LucideIcon from './LucideIcon';
import type { MediaRecord, RecordEnvelope, SoftTheme } from '../../types';

/** Media records as returned by the SDK (`useQuery('media')`): the array `getMediaUrl` consumes. */
type MediaRecords = RecordEnvelope<MediaRecord>[] | null;

/** Combined per-side media: ordered arrays of data/HTTP URLs or `media:` references. */
interface Media {
  images?: string[];
  audio?: string[];
}

/**
 * Normalizes media URLs (handle media references, data URLs, and HTTP URLs)
 */
const normalizeMediaUrl = (url: string | null | undefined, type: string = 'image', mediaRecords: MediaRecords = null): string | null | undefined => {
  if (!url || typeof url !== 'string') return url;

  // Handle media references (e.g., 'media:image:img-abc123')
  if (isMediaReference(url)) {
    if (mediaRecords && Array.isArray(mediaRecords) && mediaRecords.length > 0) {
      const mediaId = extractMediaId(url);
      const resolvedUrl = getMediaUrl(mediaRecords, mediaId ?? '');
      if (resolvedUrl) return resolvedUrl;
      // Record not found - return null so component can show placeholder
      console.warn(`[RichTextRenderer] Media record not found for id: ${mediaId}`);
      return null;
    }
    // mediaRecords not loaded yet - return a sentinel so we can show "loading"
    return null;
  }

  // Return data URLs and HTTP(S) URLs as-is
  return url;
};

interface FlashcardImageProps {
  url: string;
  alt?: string;
  theme?: SoftTheme;
  mediaRecords?: MediaRecords;
}

/**
 * Component for rendering flashcard images with proper styling and error handling.
 * Shows a placeholder if the image can't be resolved from media records.
 */
const FlashcardImage = ({ url, alt, theme, mediaRecords }: FlashcardImageProps) => {
  const [loadError, setLoadError] = useState(false);
  const prevUrlRef = useRef(url);

  // Compute normalizedUrl directly every render (no useMemo) so we never
  // serve a stale null when mediaRecords has been mutated in-place.
  const normalizedUrl = normalizeMediaUrl(url, 'image', mediaRecords);

  // Reset error state when the resolved URL changes
  if (prevUrlRef.current !== url) {
    prevUrlRef.current = url;
    if (loadError) setLoadError(false);
  }

  // Show a compact placeholder when image can't be resolved
  if (!normalizedUrl || loadError) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 14px',
        margin: '8px 0',
        background: 'rgba(0,0,0,0.04)',
        borderRadius: '8px',
        border: `1px dashed ${theme?.cardBorder || 'rgba(0,0,0,0.12)'}`,
        color: theme?.textSecondary || '#9ca3af',
        fontSize: '13px',
        fontStyle: 'italic'
      }}>
        <LucideIcon name="image-off" size={16} color={theme?.textSecondary || '#9ca3af'} />
        {loadError ? 'Image failed to load' : 'Loading image...'}
      </div>
    );
  }

  return (
    <img
      src={normalizedUrl}
      alt={alt}
      style={{
        maxWidth: '100%',
        maxHeight: '200px',
        width: 'auto',
        height: 'auto',
        objectFit: 'contain',
        borderRadius: '12px',
        margin: '12px 0',
        display: 'block',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        border: `1px solid ${theme?.cardBorder || 'rgba(0,0,0,0.05)'}`
      }}
      onError={() => setLoadError(true)}
    />
  );
};


interface FlashcardAudioProps {
  url: string;
  theme?: SoftTheme;
  mediaRecords?: MediaRecords;
}

/**
 * Component for rendering flashcard audio with proper styling
 * Handles very short audio files (<200ms) that may not play with standard controls
 */
const FlashcardAudio = ({ url, theme, mediaRecords }: FlashcardAudioProps) => {
  // Compute directly every render (no useMemo) to avoid stale null
  // when mediaRecords array is mutated in-place by the SDK.
  const normalizedUrl = normalizeMediaUrl(url, 'audio', mediaRecords);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVeryShort, setIsVeryShort] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);

  // Update audio src when normalized URL changes
  useEffect(() => {
    if (!normalizedUrl || isMediaReference(normalizedUrl)) {
      if (mediaRecords) {
        setError('Audio file not found');
        setIsLoading(false);
      }
      return;
    }

    // Only update if src actually changed
    if (normalizedUrl !== audioSrc) {
      setAudioSrc(normalizedUrl);
      setIsReady(false);
      setError(null);
      setIsLoading(true);
      setIsVeryShort(false);
    }
  }, [normalizedUrl, mediaRecords]);

  // Handle audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    const handleCanPlay = () => {
      setIsReady(true);
      setError(null);
      setIsLoading(false);
    };

    const handleError = (e: Event) => {
      const audioError = audio.error;
      let errorMsg = 'Failed to load audio';
      if (audioError) {
        switch (audioError.code) {
          case 1: errorMsg = 'Audio loading aborted'; break;
          case 2: errorMsg = 'Network error loading audio'; break;
          case 3: errorMsg = 'Audio decoding error'; break;
          case 4: errorMsg = 'Audio format not supported'; break;
          default: errorMsg = `Audio error: ${audioError.message || 'Unknown'}`;
        }
      }
      console.error('Audio playback error:', errorMsg, 'Code:', audioError?.code);
      setError(errorMsg);
      setIsReady(false);
      setIsLoading(false);
    };

    const handleLoadedMetadata = () => {
      setIsReady(true);
      setIsLoading(false);
      if (audio.duration && audio.duration < 0.2) {
        setIsVeryShort(true);
      }
    };

    const handleLoadedData = () => {
      setIsReady(true);
      setIsLoading(false);
      if (audio.duration && audio.duration < 0.2) {
        setIsVeryShort(true);
        audio.currentTime = 0;
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioSrc]);

  // Enhanced play handler for very short files
  const playAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      setError(null);
      audio.currentTime = 0; // Always start from beginning

      // For very short files, use programmatic playback with retry
      if (isVeryShort) {
        setIsPlaying(true);
        await audio.play();

        // Ensure it actually plays by checking after a short delay
        setTimeout(() => {
          if (audio.paused && !audio.ended) {
            // If still paused, try again
            audio.play().catch(err => {
              console.warn('Retry play failed:', err);
              setIsPlaying(false);
            });
          }
        }, 50);
      } else {
        await audio.play();
      }
    } catch (err) {
      console.error('Audio play failed:', err);
      setError('Failed to play audio');
      setIsPlaying(false);
    }
  };

  return (
    <div style={{ margin: '12px 0', width: '100%' }}>
      {isLoading && !error && (
        <div style={{
          fontSize: '12px',
          color: theme?.textSecondary || '#6b7280',
          fontStyle: 'italic',
          marginBottom: '4px'
        }}>
          Loading audio...
        </div>
      )}

      {/* Hidden audio element that always exists for the ref */}
      <audio
        ref={audioRef}
        preload="metadata"
        style={{ display: isVeryShort ? 'none' : 'block', width: '100%', height: '40px' }}
        src={audioSrc || undefined}
        controls={!isVeryShort}
      >
        Your browser does not support the audio element.
      </audio>

      {isVeryShort && (
        // Custom play button for very short audio files
        <button
          onClick={playAudio}
          disabled={!isReady || isPlaying || isLoading}
          style={{
            padding: '8px 16px',
            background: isPlaying ? '#10B981' : (theme?.primary || '#3B82F6'),
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            cursor: isReady && !isPlaying && !isLoading ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s',
            opacity: isReady ? 1 : 0.6
          }}
          onMouseEnter={(e) => {
            if (isReady && !isPlaying && !isLoading) {
              (e.target as HTMLButtonElement).style.transform = 'scale(1.05)';
            }
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.transform = 'scale(1)';
          }}
        >
          <LucideIcon
            name={isPlaying ? "Pause" : "Play"}
            size={16}
            color="white"
          />
          {isLoading ? 'Loading...' : (isPlaying ? 'Playing...' : 'Play Audio')}
        </button>
      )}

      {error && (
        <div style={{
          fontSize: '12px',
          color: '#EF4444',
          marginTop: '4px',
          fontStyle: 'italic'
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

interface RichTextRendererProps {
  html?: string | null;
  media?: Media;
  theme?: SoftTheme;
  mediaRecords?: MediaRecords;
}

/**
 * A safe, component-based renderer for flashcard content.
 * Supports basic Markdown and safe HTML rendering without dangerouslySetInnerHTML.
 */
const RichTextRenderer = ({ html: content, media, theme, mediaRecords }: RichTextRendererProps) => {
  // Track mediaRecords length as a primitive so React detects mutations
  // even when the SDK reuses the same array reference.
  const mediaRecordsLength = mediaRecords?.length ?? 0;

  const renderedContent = useMemo(() => {
    if (!content) return null;

    // Helper to determine if content is likely HTML or Markdown
    // Also treat void/self-closing tags as HTML so Anki templates with <br>, <hr>, etc. render correctly
    const hasTagPair = /<([a-z][a-z0-9]*)\b[^>]*>[\s\S]*<\/\1>/i.test(content);
    const hasVoidTag = /<(br|hr|img|input|meta|link|source|track|wbr)\b[^>]*\/?>/i.test(content);
    const isHtml = hasTagPair || hasVoidTag;

    if (isHtml) {
      // Use DOMParser to safely parse the HTML string
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');

      // Recursive function to convert DOM nodes to React elements
      const renderNode = (node: Node, index: React.Key): ReactNode => {
        // Text Node
        if (node.nodeType === 3) {
          // Process markdown in text nodes (renderMarkdownSpan already handles media placeholders)
          return renderMarkdownSpan(node.textContent, media, index, theme, mediaRecords);
        }

        // Element Node
        if (node.nodeType === 1) {
          const el = node as Element;
          const tagName = el.tagName.toLowerCase();

          if (tagName === 'script' || tagName === 'style') return null;

          // Handle img tags with [IMAGE:X] placeholders in src
          if (tagName === 'img' && el.getAttribute('src')) {
            const src = el.getAttribute('src')!;
            const match = src.match(/\[IMAGE:(\d+)\]/);
            if (match) {
              const imageIndex = parseInt(match[1], 10);
              if (media?.images?.[imageIndex]) {
                return (
                  <FlashcardImage
                    key={index}
                    url={media.images[imageIndex]}
                    alt={el.getAttribute('alt') || `Image ${imageIndex + 1}`}
                    theme={theme}
                    mediaRecords={mediaRecords}
                  />
                );
              }
              // If image not found, return placeholder text
              return <span key={index} style={{ color: '#9ca3af', fontStyle: 'italic' }}>[Image {imageIndex}]</span>;
            }
          }

          const isVoid = VOID_ELEMENTS.has(tagName);
          const children = isVoid
            ? undefined
            : Array.from(el.childNodes).map((child, i) => renderNode(child, `${index}-${i}`));

          const props: Record<string, unknown> = { key: index };
          Array.from(el.attributes).forEach(attr => {
            let name = attr.name;
            if (name === 'class') name = 'className';
            else if (name === 'for') name = 'htmlFor';
            else if (name.startsWith('on')) return;

            props[name] = attr.value;
          });

          if (props.style && typeof props.style === 'string') {
            const styleObj: Record<string, string> = {};
            props.style.split(';').forEach((s: string) => {
              const [k, v] = s.split(':');
              if (k && v) {
                const camelK = k.trim().replace(/-./g, x => x[1].toUpperCase());
                styleObj[camelK] = v.trim();
              }
            });
            props.style = styleObj;
          }

          return React.createElement(tagName, props, children);
        }
        return null;
      };

      const nodes = Array.from(doc.body.childNodes).map((node, i) => renderNode(node, i));
      return nodes.length > 0 ? nodes : null;
    } else {
      // Parse as Markdown
      const lines = content.split('\n');
      return lines.map((line, lineIdx) => {
        if (!line.trim() && lineIdx !== lines.length - 1) return <br key={lineIdx} />;

        // Handle list items
        const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)/);
        if (listMatch) {
          const indent = listMatch[1].length;
          const content = listMatch[3];
          return (
            <div key={lineIdx} style={{ marginLeft: `${indent * 12 + 12}px`, marginBottom: '4px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{ color: theme?.primary || '#3b82f6', marginTop: '4px' }}>
                <LucideIcon name="Dot" size={16} />
              </div>
              <div style={{ flex: 1 }}>{renderMarkdownSpan(content, media, lineIdx, theme, mediaRecords)}</div>
            </div>
          );
        }

        return (
          <div key={lineIdx} style={{ marginBottom: line.trim() ? '8px' : '0' }}>
            {renderMarkdownSpan(line, media, lineIdx, theme, mediaRecords)}
          </div>
        );
      });
    }
  }, [content, media, theme, mediaRecords, mediaRecordsLength]);

  return (
    <div
      className="rich-text-content"
      style={{
        color: theme?.textPrimary,
        width: '100%',
        textAlign: 'left',
        lineHeight: '1.6'
      }}
    >
      {renderedContent}
    </div>
  );
};

/**
 * Helper to parse inline markdown (bold, italic) and media placeholders
 */
const renderMarkdownSpan = (text: string | null, media: Media | undefined, baseKey: React.Key, theme: SoftTheme | undefined, mediaRecords: MediaRecords | undefined): ReactNode => {
  if (!text) return null;

  let parts: ReactNode[] = [text];

  // 1. Handle Bold **text**
  parts = parts.flatMap((part, i) => {
    if (typeof part !== 'string') return part;
    const subParts: ReactNode[] = [];
    const pattern = /\*\*([^*]+)\*\*/g;
    let lastIdx = 0;
    let match;
    while ((match = pattern.exec(part)) !== null) {
      if (match.index > lastIdx) subParts.push(part.substring(lastIdx, match.index));
      subParts.push(<strong key={`b-${baseKey}-${i}-${match.index}`} style={{ fontWeight: '700' }}>{match[1]}</strong>);
      lastIdx = pattern.lastIndex;
    }
    subParts.push(part.substring(lastIdx));
    return subParts;
  });

  // 2. Handle Italic *text*
  parts = parts.flatMap((part, i) => {
    if (typeof part !== 'string') return part;
    const subParts: ReactNode[] = [];
    const pattern = /\*([^*]+)\*/g;
    let lastIdx = 0;
    let match;
    while ((match = pattern.exec(part)) !== null) {
      if (match.index > lastIdx) subParts.push(part.substring(lastIdx, match.index));
      subParts.push(<em key={`i-${baseKey}-${i}-${match.index}`} style={{ fontStyle: 'italic', opacity: 0.9 }}>{match[1]}</em>);
      lastIdx = pattern.lastIndex;
    }
    subParts.push(part.substring(lastIdx));
    return subParts;
  });

  // 3. Handle Media Placeholders [IMAGE:0] or [AUDIO:0]
  parts = parts.flatMap((part, i) => {
    if (typeof part !== 'string') return part;
    return renderTextWithPlaceholders(part, media, `${baseKey}-m-${i}`, theme, mediaRecords);
  });

  return parts;
};

/**
 * Helper to split text by media placeholders and inject React components
 */
const renderTextWithPlaceholders = (text: string | null, media: Media | undefined, baseKey: React.Key, theme: SoftTheme | undefined, mediaRecords: MediaRecords | undefined): ReactNode => {
  if (!text) return null;

  // First, clean up any malformed audio placeholders (like [AUDIO] without numbers)
  let cleanedText = text.replace(/\[AUDIO\](?!\d)/g, '').replace(/\[audio\](?!\d)/g, '');

  const pattern = /\[(IMAGE|AUDIO):(\d+)\]/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(cleanedText)) !== null) {
    if (match.index > lastIndex) {
      parts.push(cleanedText.substring(lastIndex, match.index));
    }

    const type = match[1];
    const index = parseInt(match[2], 10);

    if (type === 'IMAGE' && media?.images?.[index]) {
      parts.push(
        <FlashcardImage
          key={`${baseKey}-img-${index}`}
          url={media.images[index]}
          alt={`Image ${index + 1}`}
          theme={theme}
          mediaRecords={mediaRecords}
        />
      );
    } else if (type === 'AUDIO' && media?.audio?.[index]) {
      parts.push(
        <FlashcardAudio
          key={`${baseKey}-aud-${index}`}
          url={media.audio[index]}
          theme={theme}
          mediaRecords={mediaRecords}
        />
      );
    } else {
      parts.push(match[0]);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < cleanedText.length) {
    parts.push(cleanedText.substring(lastIndex));
  }

  return parts.length > 0 ? parts : cleanedText;
};

export default RichTextRenderer;
