/**
 * Compatibility layer: maps old miyagiAPI calls to DeepSpace integration API.
 *
 * Correct endpoint mapping (verified against deepspace-sdk api-worker):
 *   /generate-text   -> openai/chat-completion
 *   /generate-image  -> openai/generate-image
 *   /text-to-speech  -> speech/text-to-speech   (NOT openai/...)
 *   /speech-to-text  -> speech/speech-to-text   (NOT openai/...)
 */

import { integration } from 'deepspace'

export const miyagiAPI = {
  async post(endpoint, data) {
    const route = endpoint.replace(/^\//, ''); // strip leading slash

    switch (route) {
      case 'generate-text': {
        const messages = [];
        if (data.system_prompt) {
          messages.push({ role: 'system', content: data.system_prompt });
        }
        messages.push({ role: 'user', content: data.prompt });

        const res = await integration.post('openai/chat-completion', {
          messages,
          model: data.model || 'gpt-4o-mini',
          // OpenAI schema default is 100 which is too small for most prompts.
          max_tokens: data.max_tokens || 2000,
        });

        if (res.success && res.data) {
          const text = res.data?.choices?.[0]?.message?.content || '';
          return { success: true, data: { text } };
        }
        return { success: false, error: res.error || 'Failed to generate text' };
      }

      case 'generate-image': {
        // Valid sizes: '1024x1024' | '1536x1024' | '1024x1536' | 'auto'
        // (256x256 / 512x512 are NOT supported by the gpt-image-1 models)
        const res = await integration.post('openai/generate-image', {
          prompt: data.prompt,
          model: data.model || 'gpt-image-1-mini',
          n: data.n || 1,
          size: data.size || '1024x1024',
          quality: data.quality || 'low', // 'low' keeps cost down for flashcard icons
        });

        if (res.success && res.data) {
          // Handler returns { images: [...data-url-or-url], usage }
          const imageUrls = Array.isArray(res.data?.images) ? res.data.images : [];
          return { success: true, data: { imageUrls } };
        }
        return { success: false, error: res.error || 'Image generation failed' };
      }

      case 'text-to-speech': {
        // Endpoint is speech/text-to-speech (NOT openai/text-to-speech)
        const res = await integration.post('speech/text-to-speech', {
          input: data.text,
          model: data.model || 'tts-1',
          voice: data.voice || 'alloy',
          speed: data.speed ?? 1.0,
        });

        if (res.success && res.data) {
          // Handler returns { audioUrl, model, voice, response_format }
          const audioUrl = res.data?.audioUrl;
          return { success: true, data: { audioUrl } };
        }
        return { success: false, error: res.error || 'TTS failed' };
      }

      case 'speech-to-text': {
        // Endpoint is speech/speech-to-text (NOT openai/speech-to-text)
        const res = await integration.post('speech/speech-to-text', {
          audio: data.audio,
          model: data.model || 'whisper-1',
          ...(data.language ? { language: data.language } : {}),
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
