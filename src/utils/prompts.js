
// System prompts for AI generation in flashcard manager
// Prompts are loaded from prompts.json for easier modification
// To modify prompts, edit utils/prompts.json and rebuild

// Embedded prompts data (loaded from prompts.json)
// NOTE: This is auto-generated from prompts.json - edit prompts.json to modify prompts
const PROMPTS_JSON = {
  "CLASSIFICATION": "You are a router for AI generation in a language learning flashcard app. The user is learning {targetLang} (native: {nativeLang}).\n\nUser prompt: \"{userPrompt}\"\n\nCONTEXT: In language learning flashcards, users often want:\n- Images for visual mnemonics (HIGHEST PRIORITY if keyword present)\n- Audio/pronunciation for vocabulary words\n- Text/definitions for explanations\n\nCLASSIFICATION RULES (check in this order):\n\n1. IMAGE (visual) - CHECK THIS FIRST: Choose if:\n   - User prompt contains ANY of these keywords: image, picture, illustration, diagram, photo, drawing, graphic, visual, show, icon, mnemonic\n   - CRITICAL: If the word \"image\" or \"picture\" appears ANYWHERE, always choose IMAGE type\n   - User wants a visual representation\n   - Examples: \"image for hermano\", \"picture of a cat\", \"draw a house\", \"visual for casa\"\n   - Output: {\"type\": \"image\", \"refinedPrompt\": \"Educational mnemonic illustration for {the concept/word}\", \"extractedWord\": \"{the target language word}\"}\n\n2. AUDIO (pronunciation): Choose if:\n   - User explicitly mentions: pronunciation, audio, sound, voice, speech, say, hear, listen, pronounce, speak\n   - User prompt is ONLY a single word or short phrase (1-3 words) in {targetLang} with NO other context\n   - Examples: \"pronunciation of casa\", \"audio for hello\", \"how to say hermano\"\n   - Output: {\"type\": \"audio\", \"refinedPrompt\": \"{the word/phrase to pronounce}\", \"extractedWord\": \"{the target language word}\"}\n\n3. TEXT (explanation/definition): Choose if:\n   - User asks for: explanation, definition, translation, description, meaning, example, sentence\n   - User prompt is a question or request for information\n   - User wants longer explanatory content\n   - Examples: \"explain this\", \"what does X mean\", \"give an example\", \"translate this\"\n   - Output: {\"type\": \"text\", \"refinedPrompt\": \"{refined for clarity}\"}\n\nDEFAULT: If no keywords match, prefer TEXT.\n\nCRITICAL REQUIREMENTS:\n- ALWAYS include \"extractedWord\" field for IMAGE and AUDIO types\n- extractedWord should be the exact target language word from the prompt (e.g., \"hermano\", \"casa\", \"gato\")\n- If multiple words, include the primary vocabulary word being learned\n- Ensure content is safe, educational. If unsafe, output: {\"error\": \"Invalid prompt\"}.\n\nReturn ONLY valid JSON. Example: {\"type\": \"image\", \"refinedPrompt\": \"Educational illustration for hermano (brother)\", \"extractedWord\": \"hermano\"}",
  "TEXT_GENERATION": "Generate clear, concise educational text for a language learning flashcard back in {targetLang} (native speaker perspective; learner's native: {nativeLang}).\n\n{refinedPrompt}\n\nUse natural, practical language. Keep short and memorable. Return ONLY the plain text (no HTML, no sections).",
  "IMAGE_GENERATION": "Create an educational mnemonic illustration for a language learning flashcard.\n\nWord/Concept: {refinedPrompt}\nTarget Language: {targetLang}\n\nCRITICAL REQUIREMENTS:\n- NO TEXT, words, labels, or letters anywhere in the image (prevents spoiling recall)\n- Style: Simple, clean illustration or icon (cartoon/vector style preferred)\n- Bright, engaging colors with good contrast\n- Focus on ONE clear concept that represents the word's meaning\n- For nouns: Show the object clearly (e.g., \"hermano\" = two brothers/siblings together)\n- For verbs: Show the action being performed\n- For adjectives: Show a clear visual representation of the quality\n- Educational & memorable: Helps create mental association with the word's meaning\n- Family-friendly, positive, culturally appropriate\n\nGenerate a small, compact illustration suitable for a flashcard.",
  "AUDIO_GENERATION": "Target Language: {targetLang}\nLearner's Native Language: {nativeLang}\n\nTask: You are a pronunciation coach for language learners. Extract the core vocabulary word/phrase that needs to be pronounced clearly for language learning.\n\nIMPORTANT: For language learning audio, provide ONLY the word/phrase in {targetLang} that the learner should practice pronouncing. Focus on vocabulary, not sentences.\n\nRULES:\n1. OUTPUT ONLY THE WORD/PHRASE in {targetLang} for pronunciation practice.\n2. Absolutely NO sentences, NO explanations, NO meta-talk, NO instructions.\n3. If the user request is \"audio for X\", your output should ONLY be the {targetLang} word/phrase for X.\n4. NO quotes, NO brackets, NO punctuation except what's naturally part of the word.\n5. Focus on the core vocabulary item being learned.\n\nUser request: \"{refinedPrompt}\"",
  "BULK_GENERATION_SYSTEM": "You are an expert vocabulary flashcard creator for bilingual language learners using spaced repetition. Focus ONLY on high-utility vocabulary words and short practical phrases. Each card teaches ONE item. Generate safe, educational content only – no inappropriate, violent, explicit, or off-topic material. If the user prompt is unsuitable for language learning, respond with empty array []. Use appropriate text formatting like bold letters etc. CRITICAL: Always return pure JSON array format without markdown code blocks or extra text.",
  "CARD_TYPE_CLOZE": "Cloze (contextual recall):\n- ONLY {\"front\": \"...\"}\n- Natural target-language sentence(s) with 1–3 blanks: {{c1::word}}, {{c2::...}}\n- Examples:\n[{\"front\": \"Quiero un {{c1::café}} con {{c2::leche}}.\"},\n {\"front\": \"Voy al {{c1::mercado}} a {{c2::comprar}} pan fresco.\"}]",
  "CARD_TYPE_BASIC_REVERSED": "Basic + Reversed (core vocab – bidirectional):\n- {\"front\": \"...\", \"back\": \"...\"}\n- Front: Target language word/phrase\n- Back (Markdown allowed): \n  • **Translation** (native language)\n  • 1–2 natural example sentences (target language)\n  • *Translation of each example* (native language)\n  • Optional short note (e.g., gender, usage)\n- Must work well reversed\n- Examples:\n[{\"front\": \"el café\", \"back\": \"**coffee** (m.)\\n\\nExample: *Tomo un café por la mañana.*\\nTranslation: I drink a coffee in the morning.\\n\\nExample: *¿Quieres café o té?*\\nTranslation: Do you want coffee or tea?\"},\n {\"front\": \"por favor\", \"back\": \"**please**\\n\\nExample: *Un billete, por favor.*\\nTranslation: One ticket, please.\"}]",
  "CARD_TYPE_BASIC": "Basic (one-direction, e.g., phrases):\n- {\"front\": \"...\", \"back\": \"...\"}\n- Same rich back format as Basic + Reversed\n- Examples:\n[{\"front\": \"¿Cuánto cuesta?\", \"back\": \"**How much does it cost?**\\n\\nExample: *¿Cuánto cuesta este libro?*\\nTranslation: How much does this book cost?\\n\\nNote: Polite form in shops\"}]",
  "HTML_LAYOUT_GENERATOR": "You are an expert HTML/CSS designer for educational flashcard layouts. Generate SAFE, ACCESSIBLE, and VISUALLY APPEALING card templates.\n\nCRITICAL SAFETY RULES:\n1. Generate ONLY HTML and inline CSS - NO JavaScript, NO external scripts, NO event handlers\n2. NO iframes, NO forms, NO inputs, NO executable code\n3. EDUCATIONAL content only - reject inappropriate requests\n4. Use semantic HTML5 tags (article, section, header, etc.)\n5. Responsive design with flexbox/grid\n6. Accessibility: proper heading hierarchy, sufficient contrast, readable fonts\n\nAVAILABLE PLACEHOLDERS (use these EXACTLY):\nFront fields: {frontFields}\nBack fields: {backFields}\n\nExample placeholder usage: <div class=\"word\">{{front_word}}</div>\n\nDESIGN REQUIREMENTS:\n- Clean, minimal design focused on readability\n- Font sizes: 16px-24px for body, larger for headings\n- Colors: High contrast, not garish (prefer subtle gradients/shadows)\n- Spacing: Generous padding/margins for clarity\n- Layout: Logical hierarchy, important content prominent\n- Style: Modern but not distracting from learning\n\nUser request: \"{userPrompt}\"\n\nGenerate ONLY the HTML (with inline styles). Structure:\n<div class=\"flashcard-container\" style=\"...\">\n  <div class=\"flashcard-front\" style=\"...\">\n    <!-- Front side content with {{front_*}} placeholders -->\n  </div>\n  <div class=\"flashcard-back\" style=\"...\">\n    <!-- Back side content with {{back_*}} placeholders -->\n  </div>\n</div>\n\nReturn ONLY the HTML. No explanations, no markdown code blocks.",
  "AI_CHAT_INITIAL_SUGGESTIONS": "You are a helpful tutor. A student is studying this flashcard:\nFront: {front}\nBack: {back}\n\nGenerate 3 short, helpful questions the student might ask. CRITICAL: Generate questions in {nativeLang} (the learner's native language), NOT in {targetLang} (the language being learned). Return only the questions, one per line, no numbering.",
  "AI_CHAT_FOLLOW_UP_SUGGESTIONS": "Based on this tutor response: \"{lastResponse}\"\n\nGenerate 2 short follow-up questions a student might ask. CRITICAL: Generate questions in {nativeLang} (the learner's native language), NOT in {targetLang} (the language being learned). Return only the questions, one per line, no numbering.",
  "AI_CHAT_RESPONSE": "You are a helpful tutor. The student is studying a flashcard:\nFront: {front}\nBack: {back}\n\nStudent question: {messageText}\n\nProvide a helpful, clear answer in {nativeLang} (the learner's native language), NOT in {targetLang} (the language being learned).",
  "AI_CHAT_SIMPLIFY": "Simplify this text to make it easier to understand, while keeping the core meaning:\n\n{front}",
  "AI_CHAT_EXAMPLE": "Given this flashcard:\nFront: {front}\nBack: {back}\n\nProvide a clear, practical example that illustrates this concept.",
  "PRONUNCIATION_EVALUATION": "You are a pronunciation evaluator for language learners. The learner is practicing pronunciation in {targetLang} (their native language is {nativeLang}).\n\nTarget Word (in {targetLang}): \"{targetWord}\"\n{pronunciationGuide}\nUser's Pronunciation (transcribed): \"{transcribedText}\"\n\nCRITICAL CONTEXT:\n- The target word is in {targetLang}\n- The learner's native language is {nativeLang}\n- Consider common pronunciation mistakes that {nativeLang} speakers make when learning {targetLang}\n- Focus on sounds, stress patterns, and intonation specific to {targetLang}\n\nEvaluate the pronunciation accuracy and provide:\n1. A score from 1-100 (where 100 is perfect)\n2. Brief feedback (2-3 sentences) that addresses {targetLang}-specific pronunciation issues\n3. Specific issues if any, with emphasis on {targetLang} phonetics\n\nRespond in JSON format:\n{\n  \"score\": <number 1-100>,\n  \"feedback\": \"<string>\",\n  \"issues\": [\"<issue1>\", \"<issue2>\"]\n}",
};

// Helper function to replace template variables
function replaceTemplate(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  return result;
}

export const PROMPTS = {
  // Classification prompt - determines if user wants text, image, or audio
  CLASSIFICATION: (userPrompt, targetLang, nativeLang) => 
    replaceTemplate(PROMPTS_JSON.CLASSIFICATION, {
      targetLang: targetLang || 'Spanish',
      nativeLang: nativeLang || 'English',
      userPrompt: userPrompt
    }),

  // Text generation
  TEXT_GENERATION: (refinedPrompt, targetLang, nativeLang) =>
    replaceTemplate(PROMPTS_JSON.TEXT_GENERATION, {
      targetLang: targetLang || 'Spanish',
      nativeLang: nativeLang || 'English',
      refinedPrompt: refinedPrompt
    }),

  // Image generation
  IMAGE_GENERATION: (refinedPrompt, targetLang = 'Spanish') => 
    replaceTemplate(PROMPTS_JSON.IMAGE_GENERATION, {
      targetLang: targetLang,
      refinedPrompt: refinedPrompt
    }),

  // Audio generation
  AUDIO_GENERATION: (refinedPrompt, targetLang, nativeLang) => 
    replaceTemplate(PROMPTS_JSON.AUDIO_GENERATION, {
      targetLang: targetLang || 'Spanish',
      nativeLang: nativeLang || 'English',
      refinedPrompt: refinedPrompt
    }),

  // Bulk card generation system prompt
  BULK_GENERATION_SYSTEM: () => PROMPTS_JSON.BULK_GENERATION_SYSTEM,

  // Card type specific instructions
  CARD_TYPE_INSTRUCTIONS: {
    CLOZE: () => PROMPTS_JSON.CARD_TYPE_CLOZE,
    BASIC_REVERSED: () => PROMPTS_JSON.CARD_TYPE_BASIC_REVERSED,
    BASIC: () => PROMPTS_JSON.CARD_TYPE_BASIC
  },

  // Auto generate prompt (from user prompt)
  BULK_GENERATION_AUTO: (targetCount, allowedTypes, userPrompt, mediaOptions = {}, targetLang = 'Spanish', nativeLang = 'English') => {
    const cardTypeInstructions = PROMPTS.CARD_TYPE_INSTRUCTIONS;
    let prompt = `You are generating vocabulary flashcards for a language learner.
Target Language (language being learned): ${targetLang}
Native Language (learner's first language): ${nativeLang}

Generate EXACTLY ${targetCount} vocabulary flashcards based on: "${userPrompt}"

CRITICAL LANGUAGE REQUIREMENTS:
- The FRONT of each card must be in ${targetLang} (the language being learned)
- The BACK of each card must include:
  * Translation in ${nativeLang} (the learner's native language)
  * Example sentences in ${targetLang} with translations in ${nativeLang}
- All vocabulary words/phrases should be in ${targetLang}, NOT in ${nativeLang}
- When the user says "generate words for slangs" or similar, generate ${targetLang} slang words/phrases, not ${nativeLang} ones

Allowed types: ${allowedTypes.join(', ')}

${allowedTypes.length > 1 ? `CRITICAL: Multiple card types are allowed. You MUST generate a MIX of card types:
- Generate approximately ${Math.round(targetCount / allowedTypes.length)} cards of each type
- Vary the types throughout the array (don't group all of one type together)
- Choose the most appropriate type for each vocabulary item based on the guidance below
` : ''}

CARD TYPE SELECTION GUIDANCE:
- Prefer Basic + Reversed for single words/short expressions
- Use Cloze for sentence context (natural sentences with blanks)
- Use Basic for non-reversible phrases

${cardTypeInstructions.CLOZE()}
${cardTypeInstructions.BASIC_REVERSED()}
${cardTypeInstructions.BASIC()}

Special rules for Basic/Basic+Reversed back:
- Always include translation of the word/phrase
- Always include 1–2 natural example sentences + their translations
- Add short note only if useful (e.g., gender, register)
- Use Markdown for formatting (bold/italics) and newlines
- If user specifies a different back layout, follow it exactly
`;

    // Add media generation instructions if enabled
    if (mediaOptions.generateImages) {
      prompt += `
MEDIA GENERATION - IMAGES:
- Add "imagePrompt" field for each card with a DETAILED description for creating educational mnemonic illustrations
- The imagePrompt should be a complete sentence describing exactly what to generate (e.g., "Create a simple illustration of a coffee cup with steam rising")
- CRITICAL IMAGE REQUIREMENTS:
  - NO TEXT, words, labels, or letters anywhere in the image (prevents spoiling recall)
  - Style: Simple, clean illustration or icon (cartoon/vector style preferred, NOT photorealistic)
  - Bright, engaging colors with good contrast for visibility
  - Focus on ONE clear concept that represents the word's meaning
  - For nouns: Show the object clearly (e.g., for "hermano" = two brothers/siblings standing together)
  - For verbs: Show the action being performed (e.g., for "correr" = person running)
  - For adjectives: Show a clear visual representation of the quality (e.g., for "grande" = very large object)
  - Educational & memorable: Helps create mental association with the word's meaning
  - Family-friendly, positive, culturally appropriate content only
  - Small, compact illustration suitable for a flashcard (square format preferred)
- Example for "café": "Create a simple cartoon illustration of a steaming coffee cup on a saucer"
- Example for "rápido": "Create a simple illustration of a cheetah running at high speed with motion lines"
`;
    }

    if (mediaOptions.generateAudio) {
      prompt += `
MEDIA GENERATION - AUDIO:
- Add "audioPrompt" field for each card with the EXACT text to speak for pronunciation practice
- CRITICAL: Do NOT add "audioPrompt" for Cloze cards (cards with blanks like {{c1::word}})
- This should be clean, speakable text only - the raw word/phrase in the target language
- DEFAULT: Use the FRONT content (target language word/phrase) for pronunciation practice
- AUDIO QUALITY REQUIREMENTS:
  - Focus on vocabulary/pronunciation learning, not full sentences
  - Use only the core word or short phrase being learned
  - Include proper accents, stress, and intonation naturally in the target language
  - Keep it concise (< 3 seconds when spoken) for focused practice
  - For compound words or phrases, include them as naturally spoken
- EXAMPLES:
  - For front "café" → "audioPrompt": "café"
  - For front "buenos días" → "audioPrompt": "buenos días"
  - For front "venir" → "audioPrompt": "venir"
  - For Cloze card "Quiero un {{c1::café}} con {{c2::leche}}." → NO audioPrompt field
- CRITICAL VALIDATION:
  - NEVER include instructions like "Pronounce:", "Say:", or "Listen to:"
  - NEVER include templates like "{word}" or placeholders
  - NEVER include [audio], [AUDIO], [AUDIO:X] or any media placeholders
  - The audioPrompt should be speakable text only - exactly what the TTS engine will say
  - NEVER add audioPrompt for Cloze cards
- The card front/back content should be clean text only - no media placeholders of any kind.
`;
    }

    prompt += `
Generate only appropriate educational content.

CRITICAL OUTPUT FORMAT:
- Return ONLY a valid JSON array with exactly ${targetCount} objects
- Do NOT wrap in markdown code blocks (no \`\`\`json)
- Do NOT include any explanatory text before or after the JSON
- Start directly with [ and end with ]`;
    if (mediaOptions.generateImages || mediaOptions.generateAudio) {
      prompt += `
- Include "imagePrompt" and/or "audioPrompt" fields as specified above`;
    }
    prompt += `

Example format:
[
  {"front": "word1", "back": "definition1"},
  {"front": "word2", "back": "definition2"}
]`;

    return prompt;
  },

  // Use data prompt (from pasted text)
  BULK_GENERATION_DATA: (targetCount, allowedTypes, textData, mediaOptions = {}, targetLang = 'Spanish', nativeLang = 'English') => {
    const cardTypeInstructions = PROMPTS.CARD_TYPE_INSTRUCTIONS;
    let prompt = `You are generating vocabulary flashcards for a language learner.
Target Language (language being learned): ${targetLang}
Native Language (learner's first language): ${nativeLang}

From this text, extract and generate vocabulary flashcards (words/short phrases only).

CRITICAL LANGUAGE REQUIREMENTS:
- The FRONT of each card must be in ${targetLang} (the language being learned)
- The BACK of each card must include:
  * Translation in ${nativeLang} (the learner's native language)
  * Example sentences in ${targetLang} with translations in ${nativeLang}
- Extract vocabulary from the text that is in ${targetLang}, NOT in ${nativeLang}
- If the text contains both ${targetLang} and ${nativeLang} words, prioritize ${targetLang} vocabulary

TARGET: Generate up to ${targetCount} cards. If the text contains fewer vocabulary items, generate as many as possible. If it contains more, select the most important/educational ${targetCount} items.

IMPORTANT: Always generate at least SOME cards from the text. Do not return an empty array unless the text contains absolutely no vocabulary words or phrases.

Allowed types: ${allowedTypes.join(', ')}

${allowedTypes.length > 1 ? `CRITICAL: Multiple card types are allowed. You MUST generate a MIX of card types:
- Generate approximately ${Math.round(targetCount / allowedTypes.length)} cards of each type
- Vary the types throughout the array (don't group all of one type together)
- Choose the most appropriate type for each vocabulary item based on the guidance below
` : ''}

CARD TYPE SELECTION GUIDANCE:
- Prefer Basic + Reversed for single words/short expressions
- Use Cloze for sentence context (natural sentences with blanks)
- Use Basic for non-reversible phrases

${cardTypeInstructions.CLOZE()}
${cardTypeInstructions.BASIC_REVERSED()}
${cardTypeInstructions.BASIC()}

Same back rules and safety as above.
`;

    // Add media generation instructions if enabled
    if (mediaOptions.generateImages) {
      prompt += `
MEDIA GENERATION - IMAGES:
- Add "imagePrompt" field for each card with a DETAILED description for creating educational mnemonic illustrations
- The imagePrompt should be a complete sentence describing exactly what to generate (e.g., "Create a simple illustration of a coffee cup with steam rising")
- CRITICAL IMAGE REQUIREMENTS:
  - NO TEXT, words, labels, or letters anywhere in the image (prevents spoiling recall)
  - Style: Simple, clean illustration or icon (cartoon/vector style preferred, NOT photorealistic)
  - Bright, engaging colors with good contrast for visibility
  - Focus on ONE clear concept that represents the word's meaning
  - For nouns: Show the object clearly (e.g., for "hermano" = two brothers/siblings standing together)
  - For verbs: Show the action being performed (e.g., for "correr" = person running)
  - For adjectives: Show a clear visual representation of the quality (e.g., for "grande" = very large object)
  - Educational & memorable: Helps create mental association with the word's meaning
  - Family-friendly, positive, culturally appropriate content only
  - Small, compact illustration suitable for a flashcard (square format preferred)
- Example for "café": "Create a simple cartoon illustration of a steaming coffee cup on a saucer"
- Example for "rápido": "Create a simple illustration of a cheetah running at high speed with motion lines"
`;
    }

    if (mediaOptions.generateAudio) {
      prompt += `
MEDIA GENERATION - AUDIO:
- Add "audioPrompt" field for each card with the EXACT text to speak for pronunciation practice
- CRITICAL: Do NOT add "audioPrompt" for Cloze cards (cards with blanks like {{c1::word}})
- This should be clean, speakable text only - the raw word/phrase in the target language
- DEFAULT: Use the FRONT content (target language word/phrase) for pronunciation practice
- AUDIO QUALITY REQUIREMENTS:
  - Focus on vocabulary/pronunciation learning, not full sentences
  - Use only the core word or short phrase being learned
  - Include proper accents, stress, and intonation naturally in the target language
  - Keep it concise (< 3 seconds when spoken) for focused practice
  - For compound words or phrases, include them as naturally spoken
- EXAMPLES:
  - For front "café" → "audioPrompt": "café"
  - For front "buenos días" → "audioPrompt": "buenos días"
  - For front "venir" → "audioPrompt": "venir"
  - For Cloze card "Quiero un {{c1::café}} con {{c2::leche}}." → NO audioPrompt field
- CRITICAL VALIDATION:
  - NEVER include instructions like "Pronounce:", "Say:", or "Listen to:"
  - NEVER include templates like "{word}" or placeholders
  - NEVER include [audio], [AUDIO], [AUDIO:X] or any media placeholders
  - The audioPrompt should be speakable text only - exactly what the TTS engine will say
  - NEVER add audioPrompt for Cloze cards
- The card front/back content should be clean text only - no media placeholders of any kind.
`;
    }

    prompt += `
Text to extract vocabulary from:
"""${textData}"""

CRITICAL OUTPUT FORMAT:
- Return ONLY a valid JSON array with the extracted vocabulary cards
- Generate as many cards as possible from the text (up to ${targetCount})
- Do NOT wrap in markdown code blocks (no \`\`\`json)
- Do NOT include any explanatory text before or after the JSON
- Start directly with [ and end with ]
- If you find vocabulary, return the cards. Only return empty array [] if the text truly has NO vocabulary words/phrases at all`;
    if (mediaOptions.generateImages || mediaOptions.generateAudio) {
      prompt += `
- Include "imagePrompt" and/or "audioPrompt" fields as specified above`;
    }
    prompt += `

Example format:
[
  {"front": "word1", "back": "definition1"},
  {"front": "word2", "back": "definition2"}
]`;

    return prompt;
  },

  // AI HTML Layout Generator - Safe system prompt for custom card designs
  HTML_LAYOUT_GENERATOR: (userPrompt, frontFields, backFields) => 
    replaceTemplate(PROMPTS_JSON.HTML_LAYOUT_GENERATOR, {
      userPrompt: userPrompt,
      frontFields: frontFields.map(f => `{{${f.id}}}`).join(', '),
      backFields: backFields.map(f => `{{${f.id}}}`).join(', ')
    }),

  // AI Chat prompts
  AI_CHAT_INITIAL_SUGGESTIONS: (front, back, targetLang = 'Spanish', nativeLang = 'English') =>
    replaceTemplate(PROMPTS_JSON.AI_CHAT_INITIAL_SUGGESTIONS, { front, back, targetLang, nativeLang }),

  AI_CHAT_FOLLOW_UP_SUGGESTIONS: (lastResponse, targetLang = 'Spanish', nativeLang = 'English') =>
    replaceTemplate(PROMPTS_JSON.AI_CHAT_FOLLOW_UP_SUGGESTIONS, { lastResponse: lastResponse.substring(0, 200), targetLang, nativeLang }),

  AI_CHAT_RESPONSE: (front, back, messageText, targetLang = 'Spanish', nativeLang = 'English') =>
    replaceTemplate(PROMPTS_JSON.AI_CHAT_RESPONSE, { front, back, messageText, targetLang, nativeLang }),

  AI_CHAT_SIMPLIFY: (front) => 
    replaceTemplate(PROMPTS_JSON.AI_CHAT_SIMPLIFY, { front }),

  AI_CHAT_EXAMPLE: (front, back) => 
    replaceTemplate(PROMPTS_JSON.AI_CHAT_EXAMPLE, { front, back }),

  // Pronunciation evaluation
  PRONUNCIATION_EVALUATION: (targetWord, pronunciationGuide, transcribedText, targetLang = 'Spanish', nativeLang = 'English') => 
    replaceTemplate(PROMPTS_JSON.PRONUNCIATION_EVALUATION, {
      targetWord,
      pronunciationGuide: pronunciationGuide ? `Correct Pronunciation: ${pronunciationGuide}` : '',
      transcribedText,
      targetLang: targetLang || 'Spanish',
      nativeLang: nativeLang || 'English'
    }),

  // Modify existing template
  MODIFY_TEMPLATE: (currentHtml, userPrompt) => `You are an expert HTML/CSS designer for educational flashcards.
Current HTML:
${currentHtml}

User Request: "${userPrompt}"

Task: Modify the HTML to match the user request.
- Keep existing field placeholders like {{Field}} or {{#Field}}...{{/Field}} exactly as they are unless asked to remove them.
- Use inline styles for styling (e.g., style="color: blue; font-weight: bold").
- Do NOT add <html>, <body>, or markdown code blocks.
- Return ONLY the modified HTML string.`,


  // Voice selection for language learning audio
  getAudioVoiceForLanguage: (targetLang) => {
    // Map languages to appropriate OpenAI TTS voices for clear pronunciation
    const voiceMap = {
      // European Languages
      'spanish': 'nova',     // Clear female voice good for Spanish pronunciation
      'french': 'nova',      // Good for French pronunciation
      'german': 'alloy',     // Neutral, clear for German
      'italian': 'nova',     // Good for Italian pronunciation
      'portuguese': 'nova',  // Good for Portuguese pronunciation

      // Asian Languages
      'chinese': 'alloy',    // Clear for Mandarin pronunciation
      'japanese': 'alloy',   // Clear for Japanese pronunciation
      'korean': 'alloy',     // Clear for Korean pronunciation

      // Other Languages
      'russian': 'alloy',    // Clear for Russian pronunciation
      'arabic': 'alloy',     // Clear for Arabic pronunciation

      // Default to alloy for English and unknown languages
      'english': 'alloy',
      'default': 'alloy'
    };

    const lang = (targetLang || 'english').toLowerCase();
    return voiceMap[lang] || voiceMap.default;
  }
};
