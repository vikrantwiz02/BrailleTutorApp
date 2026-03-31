// ─── Offline NLU Engine ───────────────────────────────────────────────────────
// Classifies natural-language voice input into intents WITHOUT any network call.
//
// Strategy: weighted keyword-group scoring + Jaccard example similarity.
//
//   score = 0.5 × keyword_score + 0.4 × max_example_jaccard + 0.1 × phrase_bonus
//
// "keyword groups" use AND logic between groups, OR logic within each group.
// A group matches if any of its synonym tokens appear in the normalised input.
// A strong-phrase bonus is added when the whole phrase is found verbatim.
//
// The engine falls through to 'tutor.ask' for anything that reads as a question
// or explanation request, so the user can always speak naturally.

import type { IntentType, NLUEntity, NLUResult } from './types';

// ── Synonym pools (extend here to improve recognition) ───────────────────────

const NAV_VERBS   = ['go','open','show','take','navigate','bring','switch','jump','head','move','launch','pull up','get to'];
const SCR_HOME    = ['home','main','start','dashboard','beginning'];
const SCR_LESSONS = ['lesson','lessons','learn','learning','study','curriculum','course','class','content'];
const SCR_PROGRESS= ['progress','stats','statistics','achievement','achievements','score','performance','history','analytics','results'];
const SCR_SETTINGS= ['setting','settings','preference','preferences','option','options','configure','configuration'];
const SCR_DEVICE  = ['device','printer','braille','bluetooth','ble','hardware','connect','peripheral'];
const SCR_NOTIF   = ['notification','notifications','alert','alerts','message','messages','inbox','notice'];

const LESSON_NEXT = ['next','forward','continue','proceed','advance','following','after','upcoming','move on','go on','carry on'];
const LESSON_PREV = ['previous','back','before','prior','go back','last','return','backward','backwards','revisit'];
const LESSON_RPT  = ['repeat','again','replay','redo','once more','say again','reread','hear again','resay'];
const LESSON_HINT = ['hint','help','clue','tip','suggestion','assist','stuck','guide','nudge','what to do'];
const LESSON_STRT = ['start','begin','initiate','kick off','lets go','let us go','do lesson','open lesson'];
const LESSON_COMP = ['complete','finish','done','end','finalize','submit','mark complete','i am done','all done'];
const LESSON_PRAC = ['practice','practise','exercise','drill','train','rehearse','quick practice','work on'];
const LESSON_CHAL = ['challenge','test','quiz','exam','assessment','evaluate','test me','quiz me'];
const LESSON_EXIT = ['exit','quit','leave','escape','close lesson','stop lesson','get out'];

const SPEECH_STOP   = ['stop','quiet','silence','shut','mute','enough','shh','hush','be quiet','stop talking','stop speaking'];
const SPEECH_PAUSE  = ['pause','wait','hold on','hang on','freeze','suspend','hold'];
const SPEECH_RESUME = ['resume','unpause','keep going','carry on','continue speaking','start again','go on'];
const SPEECH_FAST   = ['faster','speed up','quicker','quickly','accelerate','hurry','speak faster','talk faster'];
const SPEECH_SLOW   = ['slower','slow down','decelerate','slow','ease','take your time','speak slowly','talk slower'];
const SPEECH_LOUD   = ['louder','volume up','increase volume','speak up','raise volume','turn up','speak louder','talk louder'];
const SPEECH_SOFT   = ['softer','quieter','volume down','lower volume','decrease volume','turn down','speak softer','talk quieter'];

const DEV_CONNECT   = ['connect device','pair device','connect braille','pair braille','link device','connect printer','link printer'];
const DEV_DISCONNECT= ['disconnect','unpair','unlink','detach','unplug','cut connection'];
const DEV_SCAN      = ['scan','search for device','find device','discover','look for device','detect device'];
const DEV_STATUS    = ['device status','connection status','check device','is device connected','device info'];
const DEV_PRINT     = ['print','emboss','write braille','output','produce braille','generate braille','print this','print the'];

const LANG_EN = ['english','en','english language'];
const LANG_HI = ['hindi','hi','hindi language'];
const LANG_ES = ['spanish','es','espanol','español','spanish language'];

const VOICE_ON  = ['enable voice','turn on voice','voice on','turn voice on','switch voice on'];
const VOICE_OFF = ['disable voice','turn off voice','voice off','turn voice off','switch voice off'];
const ANN_ON    = ['enable auto announce','turn on auto announce','auto announce on','enable announcements'];
const ANN_OFF   = ['disable auto announce','turn off auto announce','auto announce off','disable announcements'];

const STATUS_PROG   = ['my progress','how am i doing','how many lessons','lessons completed','my streak','my score','my stats','show my progress','what is my progress','progress report'];
const STATUS_SCREEN = ['where am i','which screen','what screen','current screen','what page'];
const STATUS_LESSON = ['current lesson','what lesson','which lesson','am i in a lesson','lesson info'];

const NOTIF_READ  = ['read notifications','check notifications','any notifications','read alerts','what notifications'];
const NOTIF_CLEAR = ['clear notifications','dismiss notifications','clear alerts','mark all read','delete notifications'];

const HELP_WORDS  = ['help','commands','what can','how do i','what can you do','voice commands','list commands','available commands','guide','instructions'];
const UNDO_WORDS  = ['undo','revert','rollback','take back','reverse','undo that','go back','that was wrong'];
const CONFIRM_WDS = ['yes','confirm','do it','go ahead','okay','ok','sure','affirmative','absolutely','proceed','yep','yup'];
const CANCEL_WDS  = ['no','cancel','stop that','never mind','forget it','abort','negative','nope','don\'t'];
const GREET_WDS   = ['hello','hi','hey','good morning','good afternoon','good evening','howdy','what\'s up','whats up','greetings'];
const QUESTION_WDS= ['what is','what are','what does','how does','explain','tell me about','describe','why is','why does','who is','what braille','teach me about','help me understand','can you explain'];

// ── Intent definitions ────────────────────────────────────────────────────────

interface IntentDef {
  intent: IntentType;
  // AND between outer arrays, OR within each inner array
  keywordGroups: string[][];
  // Extra full-phrase patterns that add 0.25 bonus when matched
  strongPhrases: string[];
  // Screens where this intent gets +0.15 confidence boost
  contextAffinities: string[];
  // Minimum combined score to be a candidate
  threshold: number;
}

const INTENT_DEFS: IntentDef[] = [
  // ── Navigation ──────────────────────────────────────────────────────────────
  {
    intent: 'navigate',
    keywordGroups: [NAV_VERBS, [...SCR_HOME,...SCR_LESSONS,...SCR_PROGRESS,...SCR_SETTINGS,...SCR_DEVICE,...SCR_NOTIF]],
    strongPhrases: ['go to','take me to','navigate to','open the'],
    contextAffinities: ['home','lessons','progress','settings'],
    threshold: 0.18,
  },
  // ── Lesson controls ─────────────────────────────────────────────────────────
  {
    intent: 'lesson.next',
    keywordGroups: [LESSON_NEXT],
    strongPhrases: ['go next','move forward','next step','continue lesson'],
    contextAffinities: ['activeLesson','lessonDetail'],
    threshold: 0.15,
  },
  {
    intent: 'lesson.previous',
    keywordGroups: [LESSON_PREV],
    strongPhrases: ['go back','previous step','go previous'],
    contextAffinities: ['activeLesson'],
    threshold: 0.15,
  },
  {
    intent: 'lesson.repeat',
    keywordGroups: [LESSON_RPT],
    strongPhrases: ['say that again','repeat that','play again'],
    contextAffinities: ['activeLesson'],
    threshold: 0.15,
  },
  {
    intent: 'lesson.hint',
    keywordGroups: [LESSON_HINT],
    strongPhrases: ['give me a hint','i need a hint','show hint'],
    contextAffinities: ['activeLesson'],
    threshold: 0.15,
  },
  {
    intent: 'lesson.start',
    keywordGroups: [LESSON_STRT],
    strongPhrases: ['start lesson','begin lesson','start learning','start the lesson'],
    contextAffinities: ['lessonDetail','lessons'],
    threshold: 0.18,
  },
  {
    intent: 'lesson.complete',
    keywordGroups: [LESSON_COMP],
    strongPhrases: ['mark complete','finish lesson','complete lesson'],
    contextAffinities: ['activeLesson'],
    threshold: 0.2,
  },
  {
    intent: 'lesson.practice',
    keywordGroups: [LESSON_PRAC],
    strongPhrases: ['quick practice','let me practice','start practice'],
    contextAffinities: ['activeLesson','lessonDetail'],
    threshold: 0.18,
  },
  {
    intent: 'lesson.challenge',
    keywordGroups: [LESSON_CHAL],
    strongPhrases: ['challenge me','test me','take a quiz'],
    contextAffinities: ['activeLesson','lessonDetail'],
    threshold: 0.18,
  },
  {
    intent: 'lesson.exit',
    keywordGroups: [LESSON_EXIT],
    strongPhrases: ['exit lesson','leave lesson','quit lesson','stop the lesson'],
    contextAffinities: ['activeLesson'],
    threshold: 0.2,
  },
  // ── Speech controls ─────────────────────────────────────────────────────────
  {
    intent: 'speech.stop',
    keywordGroups: [SPEECH_STOP],
    strongPhrases: ['stop speaking','stop talking','stop reading','be quiet'],
    contextAffinities: [],
    threshold: 0.15,
  },
  {
    intent: 'speech.pause',
    keywordGroups: [SPEECH_PAUSE],
    strongPhrases: ['pause speech','pause speaking'],
    contextAffinities: [],
    threshold: 0.15,
  },
  {
    intent: 'speech.resume',
    keywordGroups: [SPEECH_RESUME],
    strongPhrases: ['resume speaking','continue speaking','keep talking'],
    contextAffinities: [],
    threshold: 0.15,
  },
  {
    intent: 'speech.faster',
    keywordGroups: [SPEECH_FAST],
    strongPhrases: ['speak faster','talk faster','read faster'],
    contextAffinities: [],
    threshold: 0.15,
  },
  {
    intent: 'speech.slower',
    keywordGroups: [SPEECH_SLOW],
    strongPhrases: ['speak slower','talk slower','read slower','slow down'],
    contextAffinities: [],
    threshold: 0.15,
  },
  {
    intent: 'speech.louder',
    keywordGroups: [SPEECH_LOUD],
    strongPhrases: ['speak louder','talk louder','turn up volume'],
    contextAffinities: [],
    threshold: 0.15,
  },
  {
    intent: 'speech.softer',
    keywordGroups: [SPEECH_SOFT],
    strongPhrases: ['speak softer','turn down volume','lower the volume'],
    contextAffinities: [],
    threshold: 0.15,
  },
  // ── Device ──────────────────────────────────────────────────────────────────
  {
    intent: 'device.connect',
    keywordGroups: [DEV_CONNECT],
    strongPhrases: ['connect to device','connect braille printer','connect my device'],
    contextAffinities: ['device'],
    threshold: 0.18,
  },
  {
    intent: 'device.disconnect',
    keywordGroups: [DEV_DISCONNECT],
    strongPhrases: ['disconnect device','disconnect printer'],
    contextAffinities: ['device'],
    threshold: 0.2,
  },
  {
    intent: 'device.scan',
    keywordGroups: [DEV_SCAN],
    strongPhrases: ['scan for devices','find braille device','search bluetooth'],
    contextAffinities: ['device'],
    threshold: 0.18,
  },
  {
    intent: 'device.status',
    keywordGroups: [DEV_STATUS],
    strongPhrases: ['device status','connection status','check connection'],
    contextAffinities: ['device'],
    threshold: 0.18,
  },
  {
    intent: 'device.print',
    keywordGroups: [DEV_PRINT],
    strongPhrases: ['print this','print the text','emboss this','print in braille'],
    contextAffinities: ['device'],
    threshold: 0.18,
  },
  // ── Settings ────────────────────────────────────────────────────────────────
  {
    intent: 'settings.language',
    keywordGroups: [['language','lang','tongue','switch to',...LANG_EN,...LANG_HI,...LANG_ES]],
    strongPhrases: ['change language','set language','switch language','speak in'],
    contextAffinities: ['settings'],
    threshold: 0.18,
  },
  {
    intent: 'settings.voice_on',
    keywordGroups: [VOICE_ON],
    strongPhrases: ['turn on voice','enable voice assistant'],
    contextAffinities: ['settings'],
    threshold: 0.2,
  },
  {
    intent: 'settings.voice_off',
    keywordGroups: [VOICE_OFF],
    strongPhrases: ['turn off voice','disable voice assistant'],
    contextAffinities: ['settings'],
    threshold: 0.25,
  },
  {
    intent: 'settings.announce_on',
    keywordGroups: [ANN_ON],
    strongPhrases: ['turn on announcements','enable auto announce'],
    contextAffinities: ['settings'],
    threshold: 0.2,
  },
  {
    intent: 'settings.announce_off',
    keywordGroups: [ANN_OFF],
    strongPhrases: ['turn off announcements','disable auto announce'],
    contextAffinities: ['settings'],
    threshold: 0.2,
  },
  // ── Status ──────────────────────────────────────────────────────────────────
  {
    intent: 'status.progress',
    keywordGroups: [STATUS_PROG],
    strongPhrases: ['my progress','how am i doing','show stats','show my stats'],
    contextAffinities: ['home','progress'],
    threshold: 0.15,
  },
  {
    intent: 'status.screen',
    keywordGroups: [STATUS_SCREEN],
    strongPhrases: ['where am i','which screen am i on'],
    contextAffinities: [],
    threshold: 0.18,
  },
  {
    intent: 'status.lesson',
    keywordGroups: [STATUS_LESSON],
    strongPhrases: ['current lesson','what lesson am i on'],
    contextAffinities: ['activeLesson'],
    threshold: 0.18,
  },
  // ── Notifications ────────────────────────────────────────────────────────────
  {
    intent: 'notifications.read',
    keywordGroups: [NOTIF_READ],
    strongPhrases: ['read my notifications','any new notifications'],
    contextAffinities: [],
    threshold: 0.18,
  },
  {
    intent: 'notifications.clear',
    keywordGroups: [NOTIF_CLEAR],
    strongPhrases: ['clear all notifications','dismiss all'],
    contextAffinities: [],
    threshold: 0.22,
  },
  // ── Meta ────────────────────────────────────────────────────────────────────
  {
    intent: 'help',
    keywordGroups: [HELP_WORDS],
    strongPhrases: ['help me','what can you do','list commands'],
    contextAffinities: [],
    threshold: 0.15,
  },
  {
    intent: 'undo',
    keywordGroups: [UNDO_WORDS],
    strongPhrases: ['undo that','take that back'],
    contextAffinities: [],
    threshold: 0.18,
  },
  {
    intent: 'confirm',
    keywordGroups: [CONFIRM_WDS],
    strongPhrases: ['yes confirm','yes go ahead','yes do it'],
    contextAffinities: [],
    threshold: 0.15,
  },
  {
    intent: 'cancel',
    keywordGroups: [CANCEL_WDS],
    strongPhrases: ['no cancel','never mind','forget it'],
    contextAffinities: [],
    threshold: 0.15,
  },
  {
    intent: 'greet',
    keywordGroups: [GREET_WDS],
    strongPhrases: ['hello there','hey there'],
    contextAffinities: [],
    threshold: 0.15,
  },
];

// ── Stopwords (ignored during token overlap) ──────────────────────────────────

const STOPWORDS = new Set([
  'a','an','the','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','shall','should',
  'may','might','can','could','must','to','of','in','on','at','for',
  'with','by','from','as','into','through','about','i','me','my',
  'you','your','we','our','they','their','it','its','this','that',
  'and','or','but','if','then','so','just','please','could you',
  'would you','can you','want','want to','like','like to','need','need to',
]);

// ── Utility functions ─────────────────────────────────────────────────────────

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenise(text: string): string[] {
  return normalise(text)
    .split(' ')
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

// Jaccard similarity between two token arrays
function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  setA.forEach(t => { if (setB.has(t)) inter++; });
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Score how well the input satisfies all keyword groups for an intent
function keywordGroupScore(inputTokens: string[], groups: string[][]): number {
  if (groups.length === 0) return 0;
  let matched = 0;
  for (const group of groups) {
    const groupNorm = group.map(normalise);
    const hasMatch = groupNorm.some(phrase => {
      const phraseTokens = phrase.split(' ');
      if (phraseTokens.length === 1) return inputTokens.includes(phraseTokens[0]);
      // Multi-word phrase: check for substring in normalised input
      return true; // handled in phrase matching below
    });
    // Also check full normalised text for multi-word group phrases
    if (hasMatch) matched++;
  }
  return matched / groups.length;
}

// Check if any strong phrase appears verbatim in normalised input
function strongPhraseBonus(normInput: string, phrases: string[]): number {
  for (const p of phrases) {
    if (normInput.includes(normalise(p))) return 0.25;
  }
  return 0;
}

// Context affinity bonus
function contextBonus(currentContext: string, affinities: string[]): number {
  return affinities.includes(currentContext) ? 0.15 : 0;
}

// ── Entity extraction ─────────────────────────────────────────────────────────

const SCREEN_MAP: Record<string, string> = {
  home: 'Home', main: 'Home', dashboard: 'Home', start: 'Home',
  lesson: 'Lessons', lessons: 'Lessons', learn: 'Lessons', learning: 'Lessons', study: 'Lessons',
  progress: 'Progress', stats: 'Progress', statistics: 'Progress', achievements: 'Progress',
  setting: 'Settings', settings: 'Settings', preferences: 'Settings', options: 'Settings',
  device: 'Device', printer: 'Device', bluetooth: 'Device', connect: 'Device', braille: 'Device',
  notification: 'Notifications', notifications: 'Notifications', alerts: 'Notifications', inbox: 'Notifications',
};

function extractScreen(norm: string): string {
  for (const [key, val] of Object.entries(SCREEN_MAP)) {
    if (norm.includes(key)) return val;
  }
  return 'Home';
}

function extractLanguage(norm: string): string {
  if (LANG_HI.some(w => norm.includes(w))) return 'Hindi';
  if (LANG_ES.some(w => norm.includes(w))) return 'Spanish';
  return 'English';
}

function extractPrintText(original: string): string {
  const patterns = [
    /print\s+(?:the\s+)?(?:text\s+)?["']?(.+?)["']?\s*$/i,
    /emboss\s+(.+)/i,
    /write\s+(?:in\s+braille\s+)?["']?(.+?)["']?\s*$/i,
    /print\s+["'](.+?)["']/i,
  ];
  for (const pat of patterns) {
    const m = original.match(pat);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  // Fallback: everything after the trigger verb
  const fallback = original.replace(/^(print|emboss|write)\s+/i, '').trim();
  return fallback || original;
}

function extractEntities(intent: IntentType, originalText: string, norm: string): import('./types').NLUEntity {
  switch (intent) {
    case 'navigate':
      return { screen: extractScreen(norm) };
    case 'settings.language':
      return { language: extractLanguage(norm) };
    case 'device.print':
      return { printText: extractPrintText(originalText) };
    case 'tutor.ask':
      return { question: originalText };
    case 'lesson.start': {
      const levels = ['beginner','intermediate','advanced','expert'];
      const lvl = levels.find(l => norm.includes(l));
      return { lessonQuery: lvl || originalText.replace(/^(start|begin|open)\s+(lesson\s+)?/i, '').trim() };
    }
    default:
      return {};
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function classifyOffline(
  rawText: string,
  currentContext: string = 'home',
): NLUResult {
  const norm = normalise(rawText);
  const tokens = tokenise(rawText);

  // Shortcircuit: pure greeting
  if (GREET_WDS.some(g => norm === normalise(g))) {
    return { intent: 'greet', confidence: 0.98, entities: {}, originalText: rawText, source: 'offline' };
  }

  // Shortcircuit: pure single-word meta commands
  const metaMap: Record<string, IntentType> = {
    help: 'help', undo: 'undo',
    yes: 'confirm', confirm: 'confirm', ok: 'confirm', okay: 'confirm',
    no: 'cancel', cancel: 'cancel',
    stop: 'speech.stop', pause: 'speech.pause', resume: 'speech.resume',
    next: 'lesson.next', previous: 'lesson.previous', back: 'lesson.previous',
    repeat: 'lesson.repeat', hint: 'lesson.hint',
    complete: 'lesson.complete', done: 'lesson.complete',
    exit: 'lesson.exit', quit: 'lesson.exit',
  };
  const singleWord = tokens[0];
  if (tokens.length <= 2 && singleWord && metaMap[singleWord]) {
    const intent = metaMap[singleWord];
    return {
      intent,
      confidence: 0.92,
      entities: extractEntities(intent, rawText, norm),
      originalText: rawText,
      source: 'offline',
    };
  }

  // Question detection → tutor.ask fallback (handled after scoring)
  const isQuestion =
    rawText.trim().endsWith('?') ||
    QUESTION_WDS.some(q => norm.startsWith(normalise(q)));

  let bestIntent: IntentType = 'unknown';
  let bestScore = 0;

  for (const def of INTENT_DEFS) {
    // Tokenise all group items and flatten for example-Jaccard
    const allGroupTokens = def.keywordGroups.flat().flatMap(tokenise);

    // 1. Keyword group score: check token presence per group
    let groupMatched = 0;
    for (const group of def.keywordGroups) {
      const groupFlat = group.flatMap(phrase => normalise(phrase).split(' '));
      const hit = tokens.some(t => groupFlat.includes(t)) ||
                  group.some(phrase => norm.includes(normalise(phrase)));
      if (hit) groupMatched++;
    }
    const kw = def.keywordGroups.length > 0 ? groupMatched / def.keywordGroups.length : 0;

    // 2. Jaccard similarity with the aggregate example pool
    const jac = jaccard(tokens, allGroupTokens);

    // 3. Strong-phrase bonus
    const sp = strongPhraseBonus(norm, def.strongPhrases);

    // 4. Context bonus
    const ctx = contextBonus(currentContext, def.contextAffinities);

    const score = 0.5 * kw + 0.4 * jac + sp + ctx;

    if (score > bestScore && score >= def.threshold) {
      bestScore = score;
      bestIntent = def.intent;
    }
  }

  // If nothing scored well but it looks like a question → tutor.ask
  if ((bestScore < 0.15 || bestIntent === 'unknown') && isQuestion) {
    bestIntent = 'tutor.ask';
    bestScore = 0.6;
  }

  // Final fallback for truly unrecognised long inputs → tutor.ask
  if (bestIntent === 'unknown' && tokens.length > 3) {
    bestIntent = 'tutor.ask';
    bestScore = 0.45;
  }

  const confidence = Math.min(bestScore, 0.97);

  return {
    intent: bestIntent,
    confidence,
    entities: extractEntities(bestIntent, rawText, norm),
    originalText: rawText,
    source: 'offline',
  };
}
