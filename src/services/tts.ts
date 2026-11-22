

import { toSpeechText } from './richText';

const JAPANESE_RE = /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/;

export function hasJapanese(text: string): boolean {
  return JAPANESE_RE.test(text);
}


export function speakableText(card: { front: string; back?: string; meaning?: string }): string {
  
  for (const field of [card.back, card.front, card.meaning]) {
    const text = toSpeechText(field ?? '');
    if (text && hasJapanese(text)) return text;
  }
  return '';
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string, lang = 'ja-JP'): void {
  if (!isSpeechSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = 0.9;
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
  if (voice) utter.voice = voice;
  synth.speak(utter);
}

export function stopSpeaking(): void {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}
