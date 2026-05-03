// ─── Online NLU — Gemini-powered intent classification and tutoring ────────────
//
// Used for two purposes:
//   1. classifyOnline()  — structured intent classification (4 s timeout)
//   2. askTutor()        — open-ended braille / learning question answering
//
// Falls back gracefully: caller catches errors and uses offlineNLU instead.

import type { NLUResult, IntentType } from './types';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const TIMEOUT_MS = 4_000;

// ── Shared fetch with timeout ─────────────────────────────────────────────────

async function geminiPost(body: object): Promise<any> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${GEMINI_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(tid);
  }
}

// ── Intent classification ─────────────────────────────────────────────────────

const CLASSIFY_SYSTEM = `You classify voice commands for a Braille learning app.

Respond ONLY with valid JSON:
{"intent":"<intent>","confidence":0.0-1.0,"entities":{...}}

Valid intents (pick the best match):
navigate.home | navigate.lessons | navigate.device | navigate.progress | navigate.settings | navigate.notifications
lesson.next | lesson.previous | lesson.repeat | lesson.start | lesson.stop | lesson.exit | lesson.hint | lesson.list
speech.stop | speech.pause | speech.resume | speech.faster | speech.slower | speech.louder | speech.softer
device.connect | device.disconnect | device.status | device.print | device.scan
settings.voice_on | settings.voice_off | settings.language
status.ask | progress.ask | notifications.clear | notifications.list
tutor.ask
meta.help | meta.undo | meta.confirm | meta.cancel | unknown

Entities (include when applicable):
  question    — the full question text (for tutor.ask)
  screen      — navigation target screen name
  language    — language name for settings.language
  printText   — text content for device.print

Examples:
"go to home screen" → {"intent":"navigate.home","confidence":0.95,"entities":{}}
"what is grade 2 braille?" → {"intent":"tutor.ask","confidence":0.98,"entities":{"question":"what is grade 2 braille?"}}
"print hello world" → {"intent":"device.print","confidence":0.93,"entities":{"printText":"hello world"}}`;

export async function classifyOnline(
  text: string,
  currentScreen: string,
): Promise<NLUResult | null> {
  if (!API_KEY) return null;

  try {
    const data = await geminiPost({
      system_instruction: { parts: [{ text: CLASSIFY_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: `Current screen: ${currentScreen}\nUser said: "${text}"` }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 200,
        responseMimeType: 'application/json',
      },
    });

    const raw: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = JSON.parse(raw.trim());

    return {
      intent: (parsed.intent ?? 'unknown') as IntentType,
      confidence: Number(parsed.confidence ?? 0.5),
      entities: parsed.entities ?? {},
      originalText: text,
      source: 'online' as const,
    };
  } catch {
    return null;
  }
}

// ── Tutor question answering ──────────────────────────────────────────────────

const TUTOR_SYSTEM = `You are an expert Braille tutor assistant inside a mobile learning app for visually impaired users.
Answer questions about Braille clearly and concisely.
Keep your answer under 3 sentences.
Do not use markdown formatting — plain text only.
Be warm, encouraging, and patient.`;

export async function askTutorOnline(question: string): Promise<string | null> {
  if (!API_KEY) return null;

  try {
    const data = await geminiPost({
      system_instruction: { parts: [{ text: TUTOR_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: question }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
      },
    });

    const answer: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return answer.trim() || null;
  } catch {
    return null;
  }
}

export const isOnlineNLUAvailable = (): boolean => Boolean(API_KEY);
