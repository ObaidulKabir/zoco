import type { DetectResult, TranslationPort } from '../ports/translation.port.js';

export class InMemoryTranslation implements TranslationPort {
  async detect(text: string): Promise<DetectResult> {
    const hasBengali = /[\u0980-\u09FF]/.test(text);
    return { language: hasBengali ? 'bn' : 'en', confidence: 0.9 };
  }

  async translate(text: string, _source: string, target: string): Promise<string> {
    return `[${target}] ${text}`;
  }
}
