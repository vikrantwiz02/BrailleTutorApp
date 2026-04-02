// Translation Service for Braille Tutor App
// Completely offline, static translation fallback

export interface TranslationDict {
  en: string;
  hi: string;
  es: string;
}

export interface Translations {
  [key: string]: TranslationDict;
}

// UI Translations
export const uiTranslations: Translations = {
  // Common
  'welcome': {
    en: 'Welcome to Braille Tutor',
    hi: 'ब्रेल ट्यूटर में आपका स्वागत है',
    es: 'Bienvenido a Braille Tutor',
  },
  'start_learning': {
    en: 'Start Learning',
    hi: 'सीखना शुरू करें',
    es: 'Comenzar a Aprender',
  },
  'continue': {
    en: 'Continue',
    hi: 'जारी रखें',
    es: 'Continuar',
  },
  'next': {
    en: 'Next',
    hi: 'अगला',
    es: 'Siguiente',
  },
  'previous': {
    en: 'Previous',
    hi: 'पिछला',
    es: 'Anterior',
  },
  'complete': {
    en: 'Complete',
    hi: 'पूर्ण',
    es: 'Completar',
  },
  'completed': {
    en: 'Completed',
    hi: 'पूर्ण',
    es: 'Completado',
  },
  'progress': {
    en: 'Progress',
    hi: 'प्रगति',
    es: 'Progreso',
  },
  'settings': {
    en: 'Settings',
    hi: 'सेटिंग्स',
    es: 'Configuración',
  },
  
  // Lesson related
  'lessons': {
    en: 'Lessons',
    hi: 'पाठ',
    es: 'Lecciones',
  },
  'lesson': {
    en: 'Lesson',
    hi: 'पाठ',
    es: 'Lección',
  },
  'alphabet': {
    en: 'Alphabet',
    hi: 'वर्णमाला',
    es: 'Alfabeto',
  },
  'numbers': {
    en: 'Numbers',
    hi: 'संख्याएं',
    es: 'Números',
  },
  'punctuation': {
    en: 'Punctuation',
    hi: 'विराम चिह्न',
    es: 'Puntuación',
  },
  'words': {
    en: 'Words',
    hi: 'शब्द',
    es: 'Palabras',
  },
  'sentences': {
    en: 'Sentences',
    hi: 'वाक्य',
    es: 'Oraciones',
  },
  
  // Braille specific
  'braille_pattern': {
    en: 'Braille Pattern',
    hi: 'ब्रेल पैटर्न',
    es: 'Patrón Braille',
  },
  'dots': {
    en: 'Dots',
    hi: 'बिंदु',
    es: 'Puntos',
  },
  'cell': {
    en: 'Cell',
    hi: 'सेल',
    es: 'Celda',
  },
  
  // Device
  'device': {
    en: 'Device',
    hi: 'उपकरण',
    es: 'Dispositivo',
  },
  'connect': {
    en: 'Connect',
    hi: 'कनेक्ट करें',
    es: 'Conectar',
  },
  'disconnect': {
    en: 'Disconnect',
    hi: 'डिस्कनेक्ट करें',
    es: 'Desconectar',
  },
  'scanning': {
    en: 'Scanning',
    hi: 'स्कैन कर रहा है',
    es: 'Escaneando',
  },
  'connected': {
    en: 'Connected',
    hi: 'कनेक्टेड',
    es: 'Conectado',
  },
};

// Lesson Content Translations
export const lessonTranslations: Translations = {
  // Category titles
  'beginner_alphabet': {
    en: 'Beginner Alphabet',
    hi: 'शुरुआती वर्णमाला',
    es: 'Alfabeto Principiante',
  },
  'intermediate_words': {
    en: 'Intermediate Words',
    hi: 'मध्यवर्ती शब्द',
    es: 'Palabras Intermedias',
  },
  'advanced_reading': {
    en: 'Advanced Reading',
    hi: 'उन्नत पठन',
    es: 'Lectura Avanzada',
  },
  
  // Letter descriptions
  'letter_a': {
    en: 'The letter A is represented by dot 1',
    hi: 'अक्षर A बिंदु 1 द्वारा दर्शाया जाता है',
    es: 'La letra A se representa con el punto 1',
  },
  'letter_b': {
    en: 'The letter B is represented by dots 1 and 2',
    hi: 'अक्षर B बिंदु 1 और 2 द्वारा दर्शाया जाता है',
    es: 'La letra B se representa con los puntos 1 y 2',
  },
  'letter_c': {
    en: 'The letter C is represented by dots 1 and 4',
    hi: 'अक्षर C बिंदु 1 और 4 द्वारा दर्शाया जाता है',
    es: 'La letra C se representa con los puntos 1 y 4',
  },
  
  // Instructions
  'tap_to_start': {
    en: 'Tap to start the lesson',
    hi: 'पाठ शुरू करने के लिए टैप करें',
    es: 'Toca para comenzar la lección',
  },
  'practice_letter': {
    en: 'Practice tracing the letter',
    hi: 'अक्षर का अभ्यास करें',
    es: 'Practica trazando la letra',
  },
  'great_job': {
    en: 'Great job!',
    hi: 'बहुत बढ़िया!',
    es: '¡Excelente trabajo!',
  },
  'try_again': {
    en: 'Try again',
    hi: 'फिर कोशिश करो',
    es: 'Inténtalo de nuevo',
  },
  'lesson_complete': {
    en: 'Lesson complete!',
    hi: 'पाठ पूर्ण!',
    es: '¡Lección completa!',
  },
};

class TranslationService {
  private currentLanguage: string = 'English';
  
  // Language code mapping
  private languageMap: Record<string, 'en' | 'hi' | 'es'> = {
    'English': 'en',
    'Hindi': 'hi',
    'Spanish': 'es',
    'en': 'en',
    'hi': 'hi',
    'es': 'es',
    'en-US': 'en',
    'hi-IN': 'hi',
    'es-ES': 'es',
  };

  setLanguage(language: string): void {
    this.currentLanguage = language;
    console.log(`Translation service language set to: ${language}`);
  }

  getLanguageCode(): 'en' | 'hi' | 'es' {
    return this.languageMap[this.currentLanguage] || 'en';
  }

  async translateText(text: string, targetLanguage?: 'en' | 'hi' | 'es'): Promise<string> {
    const langCode = targetLanguage || this.getLanguageCode();
    
    if (langCode === 'en') {
      return text;
    }

    if (uiTranslations[text]) {
      return uiTranslations[text][langCode];
    }
    return text;
  }

  async translateBatch(texts: string[]): Promise<Record<string, string>> {
    const langCode = this.getLanguageCode();
    
    if (langCode === 'en') {
      return texts.reduce((acc, text) => ({ ...acc, [text]: text }), {});
    }

    const results: Record<string, string> = {};
    for (const text of texts) {
      results[text] = uiTranslations[text]?.[langCode] || text;
    }

    return results;
  }

  translate(key: string): string {
    const langCode = this.getLanguageCode();
    
    if (uiTranslations[key]) {
      return uiTranslations[key][langCode];
    }
    
    if (lessonTranslations[key]) {
      return lessonTranslations[key][langCode];
    }
    
    return key;
  }

  async translateLessonTitle(title: string): Promise<string> {
    return this.translateText(title);
  }

  async translateLessonDescription(description: string): Promise<string> {
    return this.translateText(description);
  }

  translateBraillePattern(dots: number[], letter?: string): string {
    const langCode = this.getLanguageCode();
    
    const templates: TranslationDict = {
      en: letter 
        ? `The letter ${letter} is dots ${dots.join(', ')}`
        : `Braille pattern: dots ${dots.join(', ')}`,
      hi: letter
        ? `अक्षर ${letter} बिंदु ${dots.join(', ')} है`
        : `ब्रेल पैटर्न: बिंदु ${dots.join(', ')}`,
      es: letter
        ? `La letra ${letter} son puntos ${dots.join(', ')}`
        : `Patrón braille: puntos ${dots.join(', ')}`,
    };

    return templates[langCode];
  }

  getCategoryTranslations(category: string): TranslationDict {
    const categories: { [key: string]: TranslationDict } = {
      'alphabet': {
        en: 'Alphabet',
        hi: 'वर्णमाला',
        es: 'Alfabeto',
      },
      'numbers': {
        en: 'Numbers',
        hi: 'संख्याएं',
        es: 'Números',
      },
      'punctuation': {
        en: 'Punctuation',
        hi: 'विराम चिह्न',
        es: 'Puntuación',
      },
      'words': {
        en: 'Common Words',
        hi: 'सामान्य शब्द',
        es: 'Palabras Comunes',
      },
      'sentences': {
        en: 'Sentences',
        hi: 'वाक्य',
        es: 'Oraciones',
      },
    };

    return categories[category.toLowerCase()] || { en: category, hi: category, es: category };
  }

  async translateLessons(lessons: Array<{ title: string; description: string }>): Promise<Array<{ title: string; description: string }>> {
    const langCode = this.getLanguageCode();
    
    if (langCode === 'en') {
      return lessons;
    }

    return lessons.map((lesson) => ({
      title: uiTranslations[lesson.title]?.[langCode] || lesson.title,
      description: uiTranslations[lesson.description]?.[langCode] || lesson.description,
    }));
  }

  clearCache(): void {
    // No-op
  }
}

export const translationService = new TranslationService();
export default translationService;
