import { Injectable, signal } from '@angular/core';
import { translations } from './translations';

const LANG_KEY = 'shila_lang';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  currentLang = signal<string>(this.getInitialLang());

  constructor() {}

  private getInitialLang(): string {
    return localStorage.getItem(LANG_KEY) || 'en';
  }

  setLang(lang: string): void {
    localStorage.setItem(LANG_KEY, lang);
    this.currentLang.set(lang);
  }

  toggleLang(): void {
    const next = this.currentLang() === 'en' ? 'id' : 'en';
    this.setLang(next);
  }

  translate(key: string): string {
    const lang = this.currentLang();
    return (translations[lang] && translations[lang][key]) || translations['en'][key] || key;
  }
}