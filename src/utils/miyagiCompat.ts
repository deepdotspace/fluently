/**
 * Compatibility layer: maps old miyagiAPI calls to DeepSpace integration API.
 *
 * Correct endpoint mapping (verified against deepspace-sdk api-worker):
 *   /generate-text   -> openai/chat-completion
 *   /generate-image  -> openai/generate-image
 *   /text-to-speech  -> speech/text-to-speech   (NOT openai/...)
 *   /speech-to-text  -> speech/speech-to-text   (NOT openai/...)
 */

import { integration } from 'deepspace';

// --- Request payload shapes (per endpoint) --------------------------------

interface GenerateTextData {
  prompt: string;
  system_prompt?: string;
  model?: string;
  max_tokens?: number;
}

interface GenerateImageData {
  prompt: string;
  model?: string;
  n?: number;
  size?: string;
  quality?: string;
}

interface TextToSpeechData {
  text: string;
  model?: string;
  voice?: string;
  speed?: number;
}

interface SpeechToTextData {
  audio: string;
  model?: string;
  language?: string;
}

// --- Upstream (integration) response payload shapes -----------------------

interface ChatCompletionPayload {
  choices?: Array<{ message?: { content?: string } }>;
}

interface GenerateImagePayload {
  images?: string[];
}

interface TextToSpeechPayload {
  audioUrl?: string;
}

interface SpeechToTextPayload {
  text?: string;
  model?: string;
  language?: string;
}

// --- miyagiAPI response shapes (per endpoint, returned to callers) --------

type MiyagiSuccess<T> = { success: true; data: T };
type MiyagiFailure = { success: false; error: string };
type MiyagiResponse<T> = MiyagiSuccess<T> | MiyagiFailure;

export const miyagiAPI = {
  async post(
    endpoint: string,
    data: unknown,
  ): Promise<MiyagiResponse<unknown>> {
    const route = endpoint.replace(/^\//, ''); // strip leading slash

    switch (route) {
      case 'generate-text': {
        const d = data as GenerateTextData;
        const messages: Array<{ role: string; content: string }> = [];
        if (d.system_prompt) {
          messages.push({ role: 'system', content: d.system_prompt });
        }
        messages.push({ role: 'user', content: d.prompt });

        const res = await integration.post<ChatCompletionPayload>('openai/chat-completion', {
          messages,
          model: d.model || 'gpt-4o-mini',
          // OpenAI schema default is 100 which is too small for most prompts.
          max_tokens: d.max_tokens || 2000,
        });

        if (res.success && res.data) {
          const text = res.data?.choices?.[0]?.message?.content || '';
          return { success: true, data: { text } };
        }
        return { success: false, error: res.error || 'Failed to generate text' };
      }

      case 'generate-image': {
        const d = data as GenerateImageData;
        // Valid sizes: '1024x1024' | '1536x1024' | '1024x1536' | 'auto'
        // (256x256 / 512x512 are NOT supported by the gpt-image-1 models)
        const res = await integration.post<GenerateImagePayload>('openai/generate-image', {
          prompt: d.prompt,
          model: d.model || 'gpt-image-1-mini',
          n: d.n || 1,
          size: d.size || '1024x1024',
          quality: d.quality || 'low', // 'low' keeps cost down for flashcard icons
        });

        if (res.success && res.data) {
          // Handler returns { images: [...data-url-or-url], usage }
          const imageUrls = Array.isArray(res.data?.images) ? res.data.images : [];
          return { success: true, data: { imageUrls } };
        }
        return { success: false, error: res.error || 'Image generation failed' };
      }

      case 'text-to-speech': {
        const d = data as TextToSpeechData;
        // Endpoint is speech/text-to-speech (NOT openai/text-to-speech)
        const res = await integration.post<TextToSpeechPayload>('speech/text-to-speech', {
          input: d.text,
          model: d.model || 'tts-1',
          voice: d.voice || 'alloy',
          speed: d.speed ?? 1.0,
        });

        if (res.success && res.data) {
          // Handler returns { audioUrl, model, voice, response_format }
          const audioUrl = res.data?.audioUrl;
          return { success: true, data: { audioUrl } };
        }
        return { success: false, error: res.error || 'TTS failed' };
      }

      case 'speech-to-text': {
        const d = data as SpeechToTextData;
        // Endpoint is speech/speech-to-text (NOT openai/speech-to-text)
        const res = await integration.post<SpeechToTextPayload>('speech/speech-to-text', {
          audio: d.audio,
          model: d.model || 'whisper-1',
          ...(d.language ? { language: d.language } : {}),
        });

        if (res.success && res.data) {
          // Handler returns { text, model, language }
          return { success: true, data: res.data };
        }
        return { success: false, error: res.error || 'STT failed' };
      }

      default:
        console.warn(`miyagiCompat: unknown endpoint "${route}"`);
        return { success: false, error: `Unknown endpoint: ${route}` };
    }
  }
};
