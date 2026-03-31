// ─── Online NLU Engine ────────────────────────────────────────────────────────
// Uses Google Gemini to classify intent and extract entities from natural
// language input. Returns the same NLUResult shape as offlineNLU so the
// caller never needs to know which engine produced the result.
//
// Strategy:
//   1. Build a compact JSON-mode prompt with full app context.
//   2. Enforce strict JSON output via the system instruction.
//   3. Parse the response; on any failure fall back to offline result.
//   4. Hard 4-second timeout so the app never hangs waiting for the API.

import { GoogleGenerativeAI } from '@google/generative-ai';
import { isGeminiConfigured } from '../../config/gemini';
import type { NLUResult, IntentType, NLUEntity, AssistantContext } from './types';
import { classifyOffline } from './offlineNLU';

const GEMINI_API_KEY = (process.env.EXPO_PUBLIC_GEMINI_API_KEY || '').trim();
const MODEL_ID = 'gemini-1.5-flash'; // Flash for low-latency NLU
const TIMEOUT_MS = 4000;

// ── Prompt construction ───────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `You are an intent classifier for a braille learning mobile app.
Given a user's voice input and the current app state, respond with ONLY a valid JSON object.
No markdown, no explanation — pure JSON matching this schema:
{
  "intent": "<intent_type>",
  "confidence": <0.0-1.0>,
  "entities": { /* optional fields below */ },
  "suggestedResponse": "<short, friendly spoken response, max 20 words>"
}

Valid intent_type values:
navigate | lesson.next | lesson.previous | lesson.repeat | lesson.hint |
lesson.start | lesson.complete | lesson.practice | lesson.challenge | lesson.exit |
speech.stop | speech.pause | speech.resume | speech.faster | speech.slower |
speech.louder | speech.softer |
device.connect | device.disconnect | device.scan | device.status | device.print |
settings.language | settings.voice_on | settings.voice_off |
settings.announce_on | settings.announce_off |
status.progress | status.screen | status.lesson |
notifications.read | notifications.clear |
help | undo | confirm | cancel | greet | tutor.ask | unknown

Entity fields (include only when relevant):
  screen: "Home" | "Lessons" | "Progress" | "Settings" | "Device" | "Notifications"
  language: "English" | "Hindi" | "Spanish"
  printText: <string to print in braille>
  lessonQuery: <partial lesson name or level>
  question: <the user's full question for the AI tutor>

Rules:
- Use "tutor.ask" for braille questions, explanations, or anything educational.
- Use "unknown" only when the input is completely unintelligible noise.
- Keep suggestedResponse friendly and concise (it will be spoken aloud).
- Confidence 0.95+ means near-certain; 0.6–0.94 means probable; below 0.6 means unsure.`;

function buildPrompt(userText: string, ctx: AssistantContext): string {
  const lessonInfo = ctx.currentLesson
    ? `${ctx.currentLesson.title} (step ${ctx.currentLesson.stepNumber}/${ctx.currentLesson.totalSteps})`
    : 'none';

  return `APP STATE:
screen: ${ctx.currentScreen}
currentLesson: ${lessonInfo}
completedLessons: ${ctx.completedLessonsCount}
streak: ${ctx.streak} days
deviceConnected: ${ctx.deviceConnected}

USER SAYS: "${userText}"`;
}

// ── Gemini client (lazy singleton) ────────────────────────────────────────────

let _model: ReturnType<InstanceType<typeof GoogleGenerativeAI>['getGenerativeModel']> | null = null;
let _initFailed = false;

function getModel() {
  if (_initFailed) return null;
  if (_model) return _model;

  if (!isGeminiConfigured()) {
    _initFailed = true;
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    _model = genAI.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        temperature: 0.1,   // low temp = deterministic classification
        topP: 0.9,
        maxOutputTokens: 256,
      },
    });
    return _model;
  } catch {
    _initFailed = true;
    return null;
  }
}

// ── Response parsing ──────────────────────────────────────────────────────────

function parseResponse(raw: string, originalText: string): NLUResult | null {
  try {
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    // Extract first JSON object
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    const intent: IntentType = parsed.intent ?? 'unknown';
    const confidence: number = typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.7;

    const entities: NLUEntity = {};
    if (parsed.entities?.screen) entities.screen = parsed.entities.screen;
    if (parsed.entities?.language) entities.language = parsed.entities.language;
    if (parsed.entities?.printText) entities.printText = parsed.entities.printText;
    if (parsed.entities?.lessonQuery) entities.lessonQuery = parsed.entities.lessonQuery;
    if (parsed.entities?.question) entities.question = parsed.entities.question;

    // For tutor.ask make sure we always have the question
    if (intent === 'tutor.ask' && !entities.question) {
      entities.question = originalText;
    }

    return {
      intent,
      confidence,
      entities,
      originalText,
      source: 'online',
      suggestedResponse: typeof parsed.suggestedResponse === 'string'
        ? parsed.suggestedResponse : undefined,
    };
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Classify using Gemini with a hard timeout.
 * Returns null when the API is unavailable, errored, or timed out —
 * the caller must fall back to offline classification.
 */
export async function classifyOnline(
  rawText: string,
  context: AssistantContext,
): Promise<NLUResult | null> {
  const model = getModel();
  if (!model) return null;

  const prompt = buildPrompt(rawText, context);

  try {
    const raceResult = await Promise.race([
      model.generateContent(prompt),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);

    if (!raceResult) {
      console.log('[OnlineNLU] Timeout — falling back to offline');
      return null;
    }

    const raw = raceResult.response.text();
    const result = parseResponse(raw, rawText);

    if (!result) {
      console.log('[OnlineNLU] Parse failed — falling back to offline');
      return null;
    }

    // If Gemini returns unknown with low confidence, let offline try
    if (result.intent === 'unknown' && result.confidence < 0.5) {
      return null;
    }

    return result;
  } catch (err) {
    const msg = String(err);
    if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
      _initFailed = true;
      console.warn('[OnlineNLU] Invalid API key — disabling online NLU');
    } else {
      console.log('[OnlineNLU] Error:', msg);
    }
    return null;
  }
}

/**
 * Full NLU pipeline: try online first, merge with offline for best result.
 * Online wins when confidence ≥ 0.7; otherwise offline result is used.
 */
export async function classify(
  rawText: string,
  context: AssistantContext,
): Promise<NLUResult> {
  const [online, offline] = await Promise.all([
    classifyOnline(rawText, context).catch(() => null),
    Promise.resolve(classifyOffline(rawText, context.currentScreen)),
  ]);

  if (online && online.confidence >= 0.7) return online;
  if (offline.confidence >= 0.5) return offline;
  // Merge: keep higher-confidence result
  if (online && online.confidence > offline.confidence) return online;
  return offline;
}
