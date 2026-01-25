// Liblouis Braille Translation Service
// Uses liblouis-js for text-to-braille and braille-to-text conversion

// Braille dot patterns (Unicode)
const BRAILLE_PATTERNS: Record<string, string> = {
  // Letters a-z
  'a': '⠁', 'b': '⠃', 'c': '⠉', 'd': '⠙', 'e': '⠑',
  'f': '⠋', 'g': '⠛', 'h': '⠓', 'i': '⠊', 'j': '⠚',
  'k': '⠅', 'l': '⠇', 'm': '⠍', 'n': '⠝', 'o': '⠕',
  'p': '⠏', 'q': '⠟', 'r': '⠗', 's': '⠎', 't': '⠞',
  'u': '⠥', 'v': '⠧', 'w': '⠺', 'x': '⠭', 'y': '⠽',
  'z': '⠵',
  
  // Numbers (with number indicator)
  '1': '⠁', '2': '⠃', '3': '⠉', '4': '⠙', '5': '⠑',
  '6': '⠋', '7': '⠛', '8': '⠓', '9': '⠊', '0': '⠚',
  
  // Punctuation
  ' ': '⠀', // Braille space
  '.': '⠲', ',': '⠂', '?': '⠦', '!': '⠖',
  "'": '⠄', '"': '⠦', '-': '⠤', ':': '⠒',
  ';': '⠆', '(': '⠶', ')': '⠶',
  
  // Indicators
  'capital': '⠠', // Capital letter indicator
  'number': '⠼',  // Number indicator
};

// Reverse mapping for braille-to-text
const BRAILLE_TO_TEXT: Record<string, string> = {};
for (const [text, braille] of Object.entries(BRAILLE_PATTERNS)) {
  if (text.length === 1 && text !== 'capital' && text !== 'number') {
    BRAILLE_TO_TEXT[braille] = text;
  }
}

// Dot patterns for device output (1-6 format)
export const DOT_PATTERNS: Record<string, number[]> = {
  'a': [1], 'b': [1, 2], 'c': [1, 4], 'd': [1, 4, 5], 'e': [1, 5],
  'f': [1, 2, 4], 'g': [1, 2, 4, 5], 'h': [1, 2, 5], 'i': [2, 4], 'j': [2, 4, 5],
  'k': [1, 3], 'l': [1, 2, 3], 'm': [1, 3, 4], 'n': [1, 3, 4, 5], 'o': [1, 3, 5],
  'p': [1, 2, 3, 4], 'q': [1, 2, 3, 4, 5], 'r': [1, 2, 3, 5], 's': [2, 3, 4], 't': [2, 3, 4, 5],
  'u': [1, 3, 6], 'v': [1, 2, 3, 6], 'w': [2, 4, 5, 6], 'x': [1, 3, 4, 6], 'y': [1, 3, 4, 5, 6],
  'z': [1, 3, 5, 6],
  '1': [1], '2': [1, 2], '3': [1, 4], '4': [1, 4, 5], '5': [1, 5],
  '6': [1, 2, 4], '7': [1, 2, 4, 5], '8': [1, 2, 5], '9': [2, 4], '0': [2, 4, 5],
  ' ': [],
  '.': [2, 5, 6], ',': [2], '?': [2, 3, 6], '!': [2, 3, 5],
  'capital': [6], 'number': [3, 4, 5, 6],
};

export interface BrailleCell {
  character: string;
  dots: number[];
  unicode: string;
  dotMatrix: boolean[][]; // 3 rows x 2 cols
}

export interface TranslationResult {
  text: string;
  brailleUnicode: string;
  cells: BrailleCell[];
  dotSequence: number[][];
}

class BrailleTranslationService {
  // Convert text to Braille Unicode
  textToBraille(text: string): TranslationResult {
    const cells: BrailleCell[] = [];
    let brailleUnicode = '';
    const dotSequence: number[][] = [];
    let isNumberMode = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const lowerChar = char.toLowerCase();
      
      // Handle capitals
      if (char !== lowerChar && /[A-Z]/.test(char)) {
        const capitalCell = this.createCell('capital', BRAILLE_PATTERNS.capital, DOT_PATTERNS.capital);
        cells.push(capitalCell);
        brailleUnicode += capitalCell.unicode;
        dotSequence.push(capitalCell.dots);
        isNumberMode = false;
      }
      
      // Handle numbers
      if (/[0-9]/.test(char) && !isNumberMode) {
        const numberCell = this.createCell('number', BRAILLE_PATTERNS.number, DOT_PATTERNS.number);
        cells.push(numberCell);
        brailleUnicode += numberCell.unicode;
        dotSequence.push(numberCell.dots);
        isNumberMode = true;
      }
      
      // Reset number mode on non-number
      if (!/[0-9]/.test(char) && char !== ' ') {
        isNumberMode = false;
      }
      
      // Get the Braille pattern
      const pattern = BRAILLE_PATTERNS[lowerChar];
      const dots = DOT_PATTERNS[lowerChar] || [];
      
      if (pattern) {
        const cell = this.createCell(char, pattern, dots);
        cells.push(cell);
        brailleUnicode += pattern;
        dotSequence.push(dots);
      }
    }

    return {
      text,
      brailleUnicode,
      cells,
      dotSequence,
    };
  }

  // Convert Braille Unicode back to text
  brailleToText(brailleUnicode: string): string {
    let text = '';
    let capitalNext = false;
    let numberMode = false;

    for (const char of brailleUnicode) {
      if (char === BRAILLE_PATTERNS.capital) {
        capitalNext = true;
        continue;
      }
      
      if (char === BRAILLE_PATTERNS.number) {
        numberMode = true;
        continue;
      }
      
      let converted = BRAILLE_TO_TEXT[char] || '';
      
      if (numberMode && /[a-j]/.test(converted)) {
        // Convert a-j to 1-0
        const numMap: Record<string, string> = {
          'a': '1', 'b': '2', 'c': '3', 'd': '4', 'e': '5',
          'f': '6', 'g': '7', 'h': '8', 'i': '9', 'j': '0',
        };
        converted = numMap[converted] || converted;
      }
      
      if (capitalNext && converted) {
        converted = converted.toUpperCase();
        capitalNext = false;
      }
      
      if (char === '⠀' || converted === ' ') {
        numberMode = false;
      }
      
      text += converted;
    }

    return text;
  }

  // Create a Braille cell object
  private createCell(character: string, unicode: string, dots: number[]): BrailleCell {
    // Create 3x2 dot matrix
    const dotMatrix: boolean[][] = [
      [false, false],
      [false, false],
      [false, false],
    ];

    for (const dot of dots) {
      const row = (dot - 1) % 3;
      const col = dot <= 3 ? 0 : 1;
      dotMatrix[row][col] = true;
    }

    return {
      character,
      dots,
      unicode,
      dotMatrix,
    };
  }

  // Get dot pattern for a single character
  getDotPattern(char: string): number[] {
    return DOT_PATTERNS[char.toLowerCase()] || [];
  }

  // Get Braille Unicode for a single character
  getBrailleChar(char: string): string {
    return BRAILLE_PATTERNS[char.toLowerCase()] || '';
  }

  // Convert dot pattern array to character
  dotsToCharacter(dots: number[]): string {
    if (!dots || dots.length === 0) return ' ';
    
    // Sort dots for consistent comparison
    const sortedDots = [...dots].sort((a, b) => a - b).join(',');
    
    // Find matching character
    for (const [char, pattern] of Object.entries(DOT_PATTERNS)) {
      if (char.length === 1 && char !== 'capital' && char !== 'number') {
        const patternStr = [...pattern].sort((a, b) => a - b).join(',');
        if (patternStr === sortedDots) {
          return char;
        }
      }
    }
    
    return '?'; // Unknown pattern
  }

  // Generate device commands for printing
  generatePrintCommands(text: string): string[] {
    const translation = this.textToBraille(text);
    const commands: string[] = [];
    
    // Generate G-code style commands for each cell
    let x = 0;
    const cellWidth = 2.5; // mm between cells
    const dotSpacing = 2.3; // mm between dots in a cell
    const rowSpacing = 2.3; // mm between rows

    for (const cell of translation.cells) {
      for (const dot of cell.dots) {
        const row = (dot - 1) % 3;
        const col = dot <= 3 ? 0 : 1;
        const dotX = x + (col * dotSpacing);
        const dotY = row * rowSpacing;
        
        // G-code: Move to position, lower tool, raise tool
        commands.push(`G0 X${dotX.toFixed(2)} Y${dotY.toFixed(2)}`);
        commands.push('M3'); // Emboss dot
        commands.push('M5'); // Retract
      }
      
      x += cellWidth + dotSpacing;
    }

    return commands;
  }

  // Get all Grade 1 contractions
  getGrade1Contractions(): Record<string, { braille: string; dots: number[] }> {
    return {
      'and': { braille: '⠯', dots: [1, 2, 3, 4, 6] },
      'for': { braille: '⠿', dots: [1, 2, 3, 4, 5, 6] },
      'of': { braille: '⠷', dots: [1, 2, 3, 5, 6] },
      'the': { braille: '⠮', dots: [2, 3, 4, 6] },
      'with': { braille: '⠾', dots: [2, 3, 4, 5, 6] },
      'ch': { braille: '⠡', dots: [1, 6] },
      'gh': { braille: '⠣', dots: [1, 2, 6] },
      'sh': { braille: '⠩', dots: [1, 4, 6] },
      'th': { braille: '⠹', dots: [1, 4, 5, 6] },
      'wh': { braille: '⠱', dots: [1, 5, 6] },
      'ed': { braille: '⠫', dots: [1, 2, 4, 6] },
      'er': { braille: '⠻', dots: [1, 2, 4, 5, 6] },
      'ou': { braille: '⠳', dots: [1, 2, 5, 6] },
      'ow': { braille: '⠪', dots: [2, 4, 6] },
      'st': { braille: '⠌', dots: [3, 4] },
      'ar': { braille: '⠜', dots: [3, 4, 5] },
      'ing': { braille: '⠬', dots: [3, 4, 6] },
    };
  }

  // Get Nemeth math symbols
  getNemethSymbols(): Record<string, { braille: string; dots: number[] }> {
    return {
      '+': { braille: '⠬', dots: [3, 4, 6] },
      '-': { braille: '⠤', dots: [3, 6] },
      '×': { braille: '⠈⠡', dots: [4, 1, 6] },
      '÷': { braille: '⠈⠌', dots: [4, 3, 4] },
      '=': { braille: '⠨⠅', dots: [4, 6, 1, 3] },
      '<': { braille: '⠈⠣', dots: [4, 1, 2, 6] },
      '>': { braille: '⠈⠜', dots: [4, 3, 4, 5] },
      '(': { braille: '⠷', dots: [1, 2, 3, 5, 6] },
      ')': { braille: '⠾', dots: [2, 3, 4, 5, 6] },
    };
  }

  // Validate Braille input
  isValidBraille(input: string): boolean {
    // Check if all characters are valid Braille Unicode (U+2800 to U+28FF)
    for (const char of input) {
      const code = char.charCodeAt(0);
      if (code < 0x2800 || code > 0x28FF) {
        return false;
      }
    }
    return true;
  }
}

export const brailleService = new BrailleTranslationService();
export default brailleService;
