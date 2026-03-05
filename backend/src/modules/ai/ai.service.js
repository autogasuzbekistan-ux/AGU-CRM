/**
 * AGU AI — Sun'iy Intellekt Servisi
 * Anthropic Claude API bilan integratsiya
 *
 * Modellar strategiyasi:
 *  - FAST (haiku)  : sentiment, tagger, smart reply, chatbot — tez, arzon
 *  - SMART (opus)  : lead scoring, summary, win probability, recommender — chuqur tahlil
 */

const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../../config/logger');

class AGUAIService {
  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      logger.warn('AGU AI: ANTHROPIC_API_KEY topilmadi. AI funksiyalari o\'chirilgan.');
      this.enabled = false;
      return;
    }

    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    this.fastModel  = process.env.AGU_AI_FAST_MODEL  || 'claude-haiku-4-5';
    this.smartModel = process.env.AGU_AI_SMART_MODEL || 'claude-opus-4-6';
    this.enabled    = process.env.AGU_AI_ENABLED !== 'false';

    logger.info(`AGU AI tayyor. Fast: ${this.fastModel} | Smart: ${this.smartModel}`);
  }

  /** Ish qilishi mumkinmi tekshirish */
  isAvailable() {
    return this.enabled && !!this.client;
  }

  /**
   * Asosiy chaqirish metodi
   * @param {string} model
   * @param {string} systemPrompt
   * @param {string} userPrompt
   * @param {number} maxTokens
   * @param {boolean} jsonMode - JSON formatda javob talab qilinsa
   */
  async call(model, systemPrompt, userPrompt, maxTokens = 1024, jsonMode = false) {
    if (!this.isAvailable()) throw new Error('AGU AI o\'chirilgan');

    const messages = [{ role: 'user', content: userPrompt }];

    const params = {
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    };

    try {
      const response = await this.client.messages.create(params);
      const text = response.content[0]?.text || '';

      if (jsonMode) {
        // Markdown code block ichidagi JSON ni chiqarish
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        const jsonStr = jsonMatch ? jsonMatch[1] : text;
        return JSON.parse(jsonStr.trim());
      }

      return text;
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        logger.warn('AGU AI: Rate limit. Keyinroq urinib ko\'ring.');
        throw new Error('AI xizmati band. Bir oz kuting.');
      }
      if (error instanceof Anthropic.APIError) {
        logger.error(`AGU AI API xatosi [${error.status}]:`, error.message);
        throw new Error('AI xizmatida xato yuz berdi');
      }
      throw error;
    }
  }

  /** Tez vazifalar (haiku) */
  async fast(systemPrompt, userPrompt, maxTokens = 512, jsonMode = false) {
    return this.call(this.fastModel, systemPrompt, userPrompt, maxTokens, jsonMode);
  }

  /** Murakkab vazifalar (opus) */
  async smart(systemPrompt, userPrompt, maxTokens = 2048, jsonMode = false) {
    return this.call(this.smartModel, systemPrompt, userPrompt, maxTokens, jsonMode);
  }

  /** Streaming javob (real-time) */
  async stream(model, systemPrompt, userPrompt, onChunk, maxTokens = 2048) {
    if (!this.isAvailable()) throw new Error('AGU AI o\'chirilgan');

    const stream = this.client.messages.stream({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        onChunk(event.delta.text);
      }
    }

    return await stream.finalMessage();
  }
}

// Singleton
const aguAI = new AGUAIService();
module.exports = aguAI;
