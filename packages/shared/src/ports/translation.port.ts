export type DetectResult = {
  language: string;
  confidence: number;
};

export interface TranslationPort {
  detect(text: string): Promise<DetectResult>;
  translate(text: string, source: string, target: string): Promise<string>;
}
