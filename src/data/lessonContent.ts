// Comprehensive Lesson Content Database
// Each lesson has detailed steps with content, Braille patterns, and exercises

export interface LessonStep {
  type: 'introduction' | 'instruction' | 'demonstration' | 'practice' | 'quiz' | 'summary';
  title: string;
  content: string;
  braillePattern?: number[];  // Dots 1-6 that are raised [1,2] means dots 1 and 2 raised
  brailleUnicode?: string;    // Unicode representation
  letter?: string;            // The letter/symbol being taught
  practicePrompt?: string;    // What to practice
  expectedInput?: number[];   // Expected Braille input from device
  hint?: string;              // Help text
  audioScript?: string;       // Text for TTS
}

export interface LessonContent {
  lessonId: string;
  objectives: string[];
  steps: LessonStep[];
  quickPractice: QuickPracticeItem[];
  challenge: ChallengeItem[];
}

export interface QuickPracticeItem {
  prompt: string;
  answer: string;
  braillePattern: number[];
  brailleUnicode: string;
}

export interface ChallengeItem {
  type: 'identify' | 'write' | 'read' | 'spell';
  prompt: string;
  correctAnswer: string;
  options?: string[];  // For multiple choice
  braillePattern?: number[];
  points: number;
}

// Braille dot patterns for reference
// Dot positions:
// 1 4
// 2 5
// 3 6
export const BRAILLE_PATTERNS: Record<string, number[]> = {
  'A': [1],
  'B': [1, 2],
  'C': [1, 4],
  'D': [1, 4, 5],
  'E': [1, 5],
  'F': [1, 2, 4],
  'G': [1, 2, 4, 5],
  'H': [1, 2, 5],
  'I': [2, 4],
  'J': [2, 4, 5],
  'K': [1, 3],
  'L': [1, 2, 3],
  'M': [1, 3, 4],
  'N': [1, 3, 4, 5],
  'O': [1, 3, 5],
  'P': [1, 2, 3, 4],
  'Q': [1, 2, 3, 4, 5],
  'R': [1, 2, 3, 5],
  'S': [2, 3, 4],
  'T': [2, 3, 4, 5],
  'U': [1, 3, 6],
  'V': [1, 2, 3, 6],
  'W': [2, 4, 5, 6],
  'X': [1, 3, 4, 6],
  'Y': [1, 3, 4, 5, 6],
  'Z': [1, 3, 5, 6],
  '0': [3, 5, 6],
  '1': [1],
  '2': [1, 2],
  '3': [1, 4],
  '4': [1, 4, 5],
  '5': [1, 5],
  '6': [1, 2, 4],
  '7': [1, 2, 4, 5],
  '8': [1, 2, 5],
  '9': [2, 4],
  ' ': [],
  '.': [2, 5, 6],
  ',': [2],
  '?': [2, 3, 6],
  '!': [2, 3, 5],
  "'": [3],
  '-': [3, 6],
  '#': [3, 4, 5, 6],  // Number indicator
  'CAPITAL': [6],     // Capital indicator
};

// Unicode Braille characters
export const BRAILLE_UNICODE: Record<string, string> = {
  'A': '⠁', 'B': '⠃', 'C': '⠉', 'D': '⠙', 'E': '⠑',
  'F': '⠋', 'G': '⠛', 'H': '⠓', 'I': '⠊', 'J': '⠚',
  'K': '⠅', 'L': '⠇', 'M': '⠍', 'N': '⠝', 'O': '⠕',
  'P': '⠏', 'Q': '⠟', 'R': '⠗', 'S': '⠎', 'T': '⠞',
  'U': '⠥', 'V': '⠧', 'W': '⠺', 'X': '⠭', 'Y': '⠽',
  'Z': '⠵', ' ': '⠀',
  '0': '⠴', '1': '⠁', '2': '⠃', '3': '⠉', '4': '⠙',
  '5': '⠑', '6': '⠋', '7': '⠛', '8': '⠓', '9': '⠊',
  '#': '⠼', // Number indicator
  'CAPITAL': '⠠',
};

// Complete lesson content for all 260 lessons
export const lessonContents: Record<string, LessonContent> = {
  // ============ LESSON L001: Welcome to Braille ============
  'L001': {
    lessonId: 'L001',
    objectives: [
      'Understand what Braille is and its importance',
      'Learn about the Braille cell structure',
      'Get familiar with tactile reading basics',
      'Connect your Braille device'
    ],
    steps: [
      {
        type: 'introduction',
        title: 'Welcome to Braille Learning',
        content: 'Welcome to your Braille learning journey! Braille is a tactile writing system used by people who are visually impaired. It was invented by Louis Braille in 1824 and has become the primary form of written communication for blind people worldwide.',
        audioScript: 'Welcome to your Braille learning journey! Braille is a tactile writing system that uses raised dots. Let\'s begin your adventure into tactile reading!',
      },
      {
        type: 'instruction',
        title: 'The Braille Cell',
        content: 'The foundation of Braille is the "cell." Each Braille cell consists of 6 dots arranged in a rectangle: 3 rows and 2 columns. The dots are numbered 1-2-3 down the left side and 4-5-6 down the right side.',
        braillePattern: [1, 2, 3, 4, 5, 6],
        brailleUnicode: '⠿',
        audioScript: 'The Braille cell has 6 dots. Dots 1, 2, 3 are on the left. Dots 4, 5, 6 are on the right. Feel the pattern on your device.',
        hint: 'Think of it like a domino with 6 positions',
      },
      {
        type: 'demonstration',
        title: 'Dot Positions',
        content: 'Let\'s explore each dot position:\n• Dot 1: Top left\n• Dot 2: Middle left\n• Dot 3: Bottom left\n• Dot 4: Top right\n• Dot 5: Middle right\n• Dot 6: Bottom right\n\nFeel your device to identify each position.',
        braillePattern: [1, 2, 3, 4, 5, 6],
        brailleUnicode: '⠿',
        audioScript: 'Dot 1 is at top left. Dot 2 is middle left. Dot 3 is bottom left. Dot 4 is top right. Dot 5 is middle right. Dot 6 is bottom right.',
      },
      {
        type: 'practice',
        title: 'Feel the Full Cell',
        content: 'Your Braille device will now display a full cell with all 6 dots raised. Take a moment to feel each dot position with your fingertips.',
        practicePrompt: 'Touch the Braille display and identify all 6 dot positions',
        braillePattern: [1, 2, 3, 4, 5, 6],
        brailleUnicode: '⠿',
        audioScript: 'Feel the full cell on your device. All 6 dots are raised. Take your time to explore each position.',
        hint: 'Use your index finger to gently feel across the cell',
      },
      {
        type: 'summary',
        title: 'Great Start!',
        content: 'Congratulations on completing your first lesson! You\'ve learned:\n• Braille is a tactile writing system\n• The Braille cell has 6 dots\n• Dots are numbered 1-3 on left, 4-6 on right\n\nNext lesson: Understanding the Braille Cell in detail.',
        audioScript: 'Excellent work! You\'ve completed your first Braille lesson. You now understand the basic Braille cell structure. Get ready for the next lesson where we\'ll explore the cell in more detail.',
      },
    ],
    quickPractice: [
      {
        prompt: 'Which dot is at the top left?',
        answer: '1',
        braillePattern: [1],
        brailleUnicode: '⠁',
      },
      {
        prompt: 'Which dot is at the bottom right?',
        answer: '6',
        braillePattern: [6],
        brailleUnicode: '⠠',
      },
      {
        prompt: 'How many dots are in a Braille cell?',
        answer: '6',
        braillePattern: [1, 2, 3, 4, 5, 6],
        brailleUnicode: '⠿',
      },
    ],
    challenge: [
      {
        type: 'identify',
        prompt: 'How many dots are in a complete Braille cell?',
        correctAnswer: '6',
        options: ['4', '5', '6', '8'],
        points: 10,
      },
      {
        type: 'identify',
        prompt: 'Who invented Braille?',
        correctAnswer: 'Louis Braille',
        options: ['Helen Keller', 'Louis Braille', 'Thomas Edison', 'Alexander Graham Bell'],
        points: 10,
      },
      {
        type: 'identify',
        prompt: 'In what year was Braille invented?',
        correctAnswer: '1824',
        options: ['1800', '1824', '1850', '1900'],
        points: 15,
      },
    ],
  },

  // ============ LESSON L002: Understanding the Braille Cell ============
  'L002': {
    lessonId: 'L002',
    objectives: [
      'Master the 6-dot cell structure',
      'Practice identifying individual dots',
      'Understand dot numbering conventions',
      'Prepare for letter learning'
    ],
    steps: [
      {
        type: 'introduction',
        title: 'Mastering the Braille Cell',
        content: 'In this lesson, we\'ll dive deeper into the Braille cell. Understanding the cell structure is essential because every letter, number, and symbol in Braille is formed by different combinations of these 6 dots.',
        audioScript: 'Let\'s master the Braille cell. Every Braille character uses different combinations of 6 dots. This foundation is crucial for reading and writing Braille.',
      },
      {
        type: 'instruction',
        title: 'Left Column: Dots 1, 2, 3',
        content: 'The left column contains dots 1, 2, and 3, arranged vertically from top to bottom. These dots form the basis for many common letters.',
        braillePattern: [1, 2, 3],
        brailleUnicode: '⠇',
        audioScript: 'The left column has dots 1, 2, and 3. Dot 1 at top, dot 2 in middle, dot 3 at bottom. Feel this pattern now.',
        practicePrompt: 'Feel dots 1, 2, 3 on the left side',
      },
      {
        type: 'instruction',
        title: 'Right Column: Dots 4, 5, 6',
        content: 'The right column contains dots 4, 5, and 6, also arranged vertically. Combined with the left column, these create all Braille characters.',
        braillePattern: [4, 5, 6],
        brailleUnicode: '⠸',
        audioScript: 'The right column has dots 4, 5, and 6. Dot 4 at top, dot 5 in middle, dot 6 at bottom. Feel this pattern now.',
        practicePrompt: 'Feel dots 4, 5, 6 on the right side',
      },
      {
        type: 'practice',
        title: 'Top Row Practice',
        content: 'Now let\'s practice the top row: dots 1 and 4. This horizontal pair will help you orient yourself on any Braille cell.',
        braillePattern: [1, 4],
        brailleUnicode: '⠉',
        practicePrompt: 'Feel dots 1 and 4 - the top row',
        audioScript: 'Feel the top row - dots 1 and 4. They are at the same level, left and right.',
      },
      {
        type: 'practice',
        title: 'Middle Row Practice',
        content: 'The middle row consists of dots 2 and 5. Practice feeling this horizontal pair.',
        braillePattern: [2, 5],
        brailleUnicode: '⠒',
        practicePrompt: 'Feel dots 2 and 5 - the middle row',
        audioScript: 'Now feel the middle row - dots 2 and 5.',
      },
      {
        type: 'practice',
        title: 'Bottom Row Practice',
        content: 'The bottom row has dots 3 and 6. This completes your understanding of the cell grid.',
        braillePattern: [3, 6],
        brailleUnicode: '⠤',
        practicePrompt: 'Feel dots 3 and 6 - the bottom row',
        audioScript: 'Finally, feel the bottom row - dots 3 and 6.',
      },
      {
        type: 'summary',
        title: 'Cell Structure Mastered!',
        content: 'Excellent! You now understand:\n• Left column: Dots 1, 2, 3 (top to bottom)\n• Right column: Dots 4, 5, 6 (top to bottom)\n• Top row: Dots 1, 4\n• Middle row: Dots 2, 5\n• Bottom row: Dots 3, 6\n\nYou\'re ready to learn your first letter!',
        audioScript: 'Outstanding! You\'ve mastered the Braille cell structure. You\'re now ready to learn your first letter in the next lesson.',
      },
    ],
    quickPractice: [
      {
        prompt: 'What dots form the left column?',
        answer: '1, 2, 3',
        braillePattern: [1, 2, 3],
        brailleUnicode: '⠇',
      },
      {
        prompt: 'What dots form the top row?',
        answer: '1 and 4',
        braillePattern: [1, 4],
        brailleUnicode: '⠉',
      },
      {
        prompt: 'What dots form the bottom row?',
        answer: '3 and 6',
        braillePattern: [3, 6],
        brailleUnicode: '⠤',
      },
    ],
    challenge: [
      {
        type: 'identify',
        prompt: 'Which dots are in the middle row?',
        correctAnswer: '2 and 5',
        options: ['1 and 4', '2 and 5', '3 and 6', '1 and 2'],
        points: 10,
      },
      {
        type: 'identify',
        prompt: 'Which column contains dot 5?',
        correctAnswer: 'Right column',
        options: ['Left column', 'Right column', 'Middle', 'Top'],
        points: 10,
      },
      {
        type: 'identify',
        prompt: 'Dot 3 is located at which position?',
        correctAnswer: 'Bottom left',
        options: ['Top left', 'Middle left', 'Bottom left', 'Bottom right'],
        points: 15,
      },
    ],
  },

  // ============ LESSON L003: Letter A ============
  'L003': {
    lessonId: 'L003',
    objectives: [
      'Learn the Braille pattern for letter A',
      'Practice feeling and identifying letter A',
      'Understand that A is just dot 1',
      'Begin building your Braille alphabet'
    ],
    steps: [
      {
        type: 'introduction',
        title: 'Your First Letter: A',
        content: 'Congratulations on reaching this milestone! You\'re about to learn your first Braille letter. The letter A is the simplest letter in Braille - it uses only one dot.',
        audioScript: 'Exciting! You\'re about to learn your first Braille letter. The letter A is the simplest - it uses only one dot.',
      },
      {
        type: 'instruction',
        title: 'Letter A Pattern',
        content: 'The letter A is formed by raising only dot 1 - the top left dot. This is the simplest Braille character possible.',
        braillePattern: [1],
        brailleUnicode: '⠁',
        letter: 'A',
        audioScript: 'Letter A is dot 1 only - the top left dot. Feel this single raised dot on your device.',
        hint: 'Just one dot at the top left corner!',
      },
      {
        type: 'demonstration',
        title: 'See and Feel A',
        content: 'Look at the Braille display: ⠁\n\nThis is the letter A. Only the top-left dot (dot 1) is raised. The other 5 dots remain flat.',
        braillePattern: [1],
        brailleUnicode: '⠁',
        letter: 'A',
        audioScript: 'Feel the letter A. Only dot 1 is raised. All other dots are flat.',
      },
      {
        type: 'practice',
        title: 'Practice Letter A',
        content: 'Your device will display the letter A. Touch it gently with your fingertip. Notice how only one dot is raised in the top left position.',
        practicePrompt: 'Feel the letter A on your device. It\'s just dot 1.',
        braillePattern: [1],
        brailleUnicode: '⠁',
        expectedInput: [1],
        letter: 'A',
        audioScript: 'Practice feeling letter A. Touch gently and feel the single raised dot.',
        hint: 'Use your index finger to feel the single raised dot',
      },
      {
        type: 'practice',
        title: 'Write Letter A',
        content: 'Now try pressing dot 1 on your Braille device to write the letter A. Remember, it\'s just the top left dot!',
        practicePrompt: 'Press dot 1 to write the letter A',
        braillePattern: [1],
        brailleUnicode: '⠁',
        expectedInput: [1],
        letter: 'A',
        audioScript: 'Now write letter A by pressing dot 1.',
      },
      {
        type: 'summary',
        title: 'A is Mastered!',
        content: 'Wonderful job! You\'ve learned your first Braille letter!\n\n• Letter A = Dot 1 only\n• Location: Top left\n• Unicode: ⠁\n\nFun fact: In Braille numbers, this same pattern represents the number 1!',
        audioScript: 'Congratulations! You\'ve mastered the letter A. It\'s just dot 1 - simple and elegant. Next, you\'ll learn letter B!',
      },
    ],
    quickPractice: [
      {
        prompt: 'Which dot makes the letter A?',
        answer: 'Dot 1',
        braillePattern: [1],
        brailleUnicode: '⠁',
      },
      {
        prompt: 'Where is dot 1 located?',
        answer: 'Top left',
        braillePattern: [1],
        brailleUnicode: '⠁',
      },
      {
        prompt: 'How many dots are raised for letter A?',
        answer: '1',
        braillePattern: [1],
        brailleUnicode: '⠁',
      },
    ],
    challenge: [
      {
        type: 'write',
        prompt: 'Write the letter A',
        correctAnswer: 'A',
        braillePattern: [1],
        points: 10,
      },
      {
        type: 'identify',
        prompt: 'This pattern ⠁ represents which letter?',
        correctAnswer: 'A',
        options: ['A', 'B', 'C', 'D'],
        points: 10,
      },
      {
        type: 'identify',
        prompt: 'Letter A uses which dot(s)?',
        correctAnswer: 'Dot 1 only',
        options: ['Dot 1 only', 'Dots 1 and 2', 'Dots 1 and 4', 'All dots'],
        points: 15,
      },
    ],
  },

  // ============ LESSON L004: Letter B ============
  'L004': {
    lessonId: 'L004',
    objectives: [
      'Learn the Braille pattern for letter B',
      'Understand how B builds on A',
      'Practice distinguishing A from B',
      'Develop tactile discrimination skills'
    ],
    steps: [
      {
        type: 'introduction',
        title: 'Learning Letter B',
        content: 'Now let\'s learn the letter B! The letter B builds on what you know about A. While A is just dot 1, B adds dot 2 below it.',
        audioScript: 'Let\'s learn letter B! It builds on letter A by adding dot 2 below dot 1.',
      },
      {
        type: 'instruction',
        title: 'Letter B Pattern',
        content: 'Letter B uses two dots in the left column: dot 1 (top) and dot 2 (middle). These are stacked vertically on the left side.',
        braillePattern: [1, 2],
        brailleUnicode: '⠃',
        letter: 'B',
        audioScript: 'Letter B is dots 1 and 2 - a vertical pair on the left side.',
        hint: 'Think of it as A with an extra dot below',
      },
      {
        type: 'demonstration',
        title: 'Comparing A and B',
        content: 'Compare the patterns:\n• A: ⠁ (dot 1 only)\n• B: ⠃ (dots 1 and 2)\n\nNotice how B has one more dot below A.',
        braillePattern: [1, 2],
        brailleUnicode: '⠃',
        letter: 'B',
        audioScript: 'A is dot 1 only. B is dots 1 and 2. Feel the difference.',
      },
      {
        type: 'practice',
        title: 'Feel Letter B',
        content: 'Your device will display the letter B. Feel the two dots stacked vertically on the left side.',
        practicePrompt: 'Feel letter B - two dots on the left',
        braillePattern: [1, 2],
        brailleUnicode: '⠃',
        expectedInput: [1, 2],
        letter: 'B',
        audioScript: 'Feel letter B. Two dots stacked on the left side.',
      },
      {
        type: 'practice',
        title: 'Write Letter B',
        content: 'Press dots 1 and 2 together to write the letter B. These are the top and middle dots on the left column.',
        practicePrompt: 'Press dots 1 and 2 to write B',
        braillePattern: [1, 2],
        brailleUnicode: '⠃',
        expectedInput: [1, 2],
        letter: 'B',
        audioScript: 'Write letter B by pressing dots 1 and 2 together.',
      },
      {
        type: 'quiz',
        title: 'A or B?',
        content: 'Your device will show either A or B. Can you tell which one it is?',
        practicePrompt: 'Identify: Is this A or B?',
        braillePattern: [1, 2],
        brailleUnicode: '⠃',
        letter: 'B',
        audioScript: 'Quick quiz: Which letter is this?',
      },
      {
        type: 'summary',
        title: 'B Complete!',
        content: 'Great work! You now know:\n• A: ⠁ = Dot 1\n• B: ⠃ = Dots 1, 2\n\nYou can now read and write two letters! Next: Letter C.',
        audioScript: 'Excellent! You now know letters A and B. Next up is letter C!',
      },
    ],
    quickPractice: [
      {
        prompt: 'Which dots make letter B?',
        answer: 'Dots 1 and 2',
        braillePattern: [1, 2],
        brailleUnicode: '⠃',
      },
      {
        prompt: 'Letter B adds which dot to letter A?',
        answer: 'Dot 2',
        braillePattern: [1, 2],
        brailleUnicode: '⠃',
      },
      {
        prompt: 'Are the dots for B horizontal or vertical?',
        answer: 'Vertical',
        braillePattern: [1, 2],
        brailleUnicode: '⠃',
      },
    ],
    challenge: [
      {
        type: 'write',
        prompt: 'Write the letter B',
        correctAnswer: 'B',
        braillePattern: [1, 2],
        points: 10,
      },
      {
        type: 'identify',
        prompt: 'This pattern ⠃ is which letter?',
        correctAnswer: 'B',
        options: ['A', 'B', 'C', 'D'],
        points: 10,
      },
      {
        type: 'read',
        prompt: 'Read this: ⠁⠃',
        correctAnswer: 'AB',
        points: 20,
      },
    ],
  },

  // ============ LESSON L005: Letter C ============
  'L005': {
    lessonId: 'L005',
    objectives: [
      'Learn the Braille pattern for letter C',
      'Understand horizontal dot patterns',
      'Practice distinguishing A, B, and C',
      'Build tactile pattern recognition'
    ],
    steps: [
      {
        type: 'introduction',
        title: 'Learning Letter C',
        content: 'Welcome to letter C! This letter introduces a new concept - horizontal dot placement. While B had vertical dots, C has horizontal dots.',
        audioScript: 'Let\'s learn letter C! It uses a horizontal pattern - dots side by side.',
      },
      {
        type: 'instruction',
        title: 'Letter C Pattern',
        content: 'Letter C uses dots 1 and 4 - the top row of the Braille cell. These two dots sit side by side horizontally.',
        braillePattern: [1, 4],
        brailleUnicode: '⠉',
        letter: 'C',
        audioScript: 'Letter C is dots 1 and 4 - a horizontal pair at the top.',
        hint: 'Two dots side by side at the top',
      },
      {
        type: 'demonstration',
        title: 'Vertical vs Horizontal',
        content: 'Compare the patterns:\n• B: ⠃ (dots 1,2 - vertical)\n• C: ⠉ (dots 1,4 - horizontal)\n\nBoth use 2 dots but arranged differently!',
        braillePattern: [1, 4],
        brailleUnicode: '⠉',
        letter: 'C',
        audioScript: 'B is vertical - up and down. C is horizontal - side by side.',
      },
      {
        type: 'practice',
        title: 'Feel Letter C',
        content: 'Feel the letter C on your device. Notice the two dots are at the same height, forming the top row.',
        practicePrompt: 'Feel letter C - two dots at the top',
        braillePattern: [1, 4],
        brailleUnicode: '⠉',
        expectedInput: [1, 4],
        letter: 'C',
        audioScript: 'Feel letter C. Two dots at the top, side by side.',
      },
      {
        type: 'practice',
        title: 'Write Letter C',
        content: 'Press dots 1 and 4 simultaneously to write C. These are the top-left and top-right dots.',
        practicePrompt: 'Press dots 1 and 4 to write C',
        braillePattern: [1, 4],
        brailleUnicode: '⠉',
        expectedInput: [1, 4],
        letter: 'C',
        audioScript: 'Write letter C by pressing dots 1 and 4 together.',
      },
      {
        type: 'quiz',
        title: 'Pattern Recognition',
        content: 'Time to test your skills! Can you identify A, B, or C by touch?',
        practicePrompt: 'Which letter is this?',
        braillePattern: [1, 4],
        brailleUnicode: '⠉',
        letter: 'C',
        audioScript: 'Identify this letter by touch.',
      },
      {
        type: 'summary',
        title: 'C Mastered!',
        content: 'Excellent! Your letter knowledge:\n• A: ⠁ = Dot 1\n• B: ⠃ = Dots 1, 2 (vertical)\n• C: ⠉ = Dots 1, 4 (horizontal)\n\nYou\'re making great progress!',
        audioScript: 'Wonderful! You now know A, B, and C! You\'re building your Braille alphabet quickly.',
      },
    ],
    quickPractice: [
      {
        prompt: 'Which dots make letter C?',
        answer: 'Dots 1 and 4',
        braillePattern: [1, 4],
        brailleUnicode: '⠉',
      },
      {
        prompt: 'Is letter C vertical or horizontal?',
        answer: 'Horizontal',
        braillePattern: [1, 4],
        brailleUnicode: '⠉',
      },
      {
        prompt: 'Where is dot 4?',
        answer: 'Top right',
        braillePattern: [4],
        brailleUnicode: '⠈',
      },
    ],
    challenge: [
      {
        type: 'write',
        prompt: 'Write the letter C',
        correctAnswer: 'C',
        braillePattern: [1, 4],
        points: 10,
      },
      {
        type: 'read',
        prompt: 'Read this: ⠉⠁⠃',
        correctAnswer: 'CAB',
        points: 20,
      },
      {
        type: 'spell',
        prompt: 'Spell "ABC" in Braille',
        correctAnswer: '⠁⠃⠉',
        points: 25,
      },
    ],
  },

  // ============ LESSON L006: Review A, B, C ============
  'L006': {
    lessonId: 'L006',
    objectives: [
      'Consolidate knowledge of letters A, B, C',
      'Build speed in pattern recognition',
      'Practice reading simple words',
      'Develop muscle memory for writing'
    ],
    steps: [
      {
        type: 'introduction',
        title: 'Review Time!',
        content: 'Let\'s review and solidify your knowledge of letters A, B, and C. Practice makes perfect in Braille!',
        audioScript: 'Time to review! Let\'s practice A, B, and C to build your confidence.',
      },
      {
        type: 'instruction',
        title: 'Pattern Summary',
        content: 'Quick review:\n• A ⠁ = Dot 1 (single dot, top left)\n• B ⠃ = Dots 1,2 (vertical pair)\n• C ⠉ = Dots 1,4 (horizontal pair)\n\nAll three letters include dot 1!',
        audioScript: 'A is dot 1 alone. B is dots 1 and 2 vertical. C is dots 1 and 4 horizontal. They all share dot 1.',
      },
      {
        type: 'practice',
        title: 'Speed Round: A',
        content: 'Feel and identify the letter A as quickly as you can!',
        practicePrompt: 'Quick! Identify letter A',
        braillePattern: [1],
        brailleUnicode: '⠁',
        letter: 'A',
        audioScript: 'Quick! What letter is this?',
      },
      {
        type: 'practice',
        title: 'Speed Round: B',
        content: 'Feel and identify the letter B!',
        practicePrompt: 'Quick! Identify letter B',
        braillePattern: [1, 2],
        brailleUnicode: '⠃',
        letter: 'B',
        audioScript: 'What letter is this?',
      },
      {
        type: 'practice',
        title: 'Speed Round: C',
        content: 'Feel and identify the letter C!',
        practicePrompt: 'Quick! Identify letter C',
        braillePattern: [1, 4],
        brailleUnicode: '⠉',
        letter: 'C',
        audioScript: 'Name this letter!',
      },
      {
        type: 'practice',
        title: 'Read a Word: CAB',
        content: 'Try reading your first word! The pattern is: ⠉⠁⠃\n\nC - A - B = CAB (like a taxi cab!)',
        practicePrompt: 'Read: ⠉⠁⠃',
        braillePattern: [1, 4],
        brailleUnicode: '⠉⠁⠃',
        audioScript: 'Read this word: C, A, B. What does it spell?',
      },
      {
        type: 'summary',
        title: 'Review Complete!',
        content: 'Outstanding! You\'ve mastered A, B, and C!\n\nYou can now:\n• Identify all three letters by touch\n• Write them on your Braille device\n• Read the word "CAB"\n\nNext: Letter D!',
        audioScript: 'Congratulations! You\'ve completed the review. You\'re ready for letter D!',
      },
    ],
    quickPractice: [
      {
        prompt: 'Write the letters A, B, C in order',
        answer: '⠁⠃⠉',
        braillePattern: [1],
        brailleUnicode: '⠁⠃⠉',
      },
      {
        prompt: 'Read this word: ⠉⠁⠃',
        answer: 'CAB',
        braillePattern: [1, 4],
        brailleUnicode: '⠉⠁⠃',
      },
      {
        prompt: 'Which letter uses only dot 1?',
        answer: 'A',
        braillePattern: [1],
        brailleUnicode: '⠁',
      },
    ],
    challenge: [
      {
        type: 'read',
        prompt: 'Read: ⠃⠁⠉',
        correctAnswer: 'BAC',
        points: 15,
      },
      {
        type: 'spell',
        prompt: 'Spell "CAB" in Braille',
        correctAnswer: '⠉⠁⠃',
        points: 20,
      },
      {
        type: 'identify',
        prompt: 'Which letter has horizontal dots?',
        correctAnswer: 'C',
        options: ['A', 'B', 'C'],
        points: 10,
      },
    ],
  },
};

// Helper function to get lesson content
export const getLessonContent = (lessonId: string): LessonContent | null => {
  return lessonContents[lessonId] || null;
};

// Generate default content for lessons without detailed content
export const generateDefaultContent = (lesson: { id: string; title: string; description: string }): LessonContent => {
  return {
    lessonId: lesson.id,
    objectives: [
      `Complete the ${lesson.title} lesson`,
      'Practice the concepts taught',
      'Build on previous knowledge'
    ],
    steps: [
      {
        type: 'introduction',
        title: lesson.title,
        content: lesson.description,
        audioScript: lesson.description,
      },
      {
        type: 'instruction',
        title: 'Learning Objectives',
        content: `In this lesson, you will learn about: ${lesson.description}`,
        audioScript: `Let's learn about ${lesson.title}.`,
      },
      {
        type: 'practice',
        title: 'Practice Session',
        content: 'Practice the concepts from this lesson with your Braille device.',
        practicePrompt: 'Follow along with your device',
        audioScript: 'Time to practice what you\'ve learned.',
      },
      {
        type: 'summary',
        title: 'Lesson Complete',
        content: `You've completed ${lesson.title}! Great work on your Braille learning journey.`,
        audioScript: `Congratulations on completing ${lesson.title}!`,
      },
    ],
    quickPractice: [],
    challenge: [],
  };
};

export default lessonContents;
