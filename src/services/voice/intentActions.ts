// ─── Intent Action Executor ───────────────────────────────────────────────────
// Maps every NLUResult intent to a concrete app action + spoken response.
// Returns a VoiceAction descriptor; the core calls execute() to run it.

import type { NLUResult, VoiceAction, AssistantContext, AssistantHandlers } from './types';
import { voiceService } from '../voiceService';
import { store } from '../../store';
import { updateSetting } from '../../store/slices/settingsSlice';
import { nextStep, previousStep } from '../../store/slices/lessonsSlice';
import { notificationService } from '../notificationService';

// ── Response templates ────────────────────────────────────────────────────────

const RESPONSES: Record<string, string | ((ctx: AssistantContext, entities: Record<string, any>) => string)> = {
  // Navigation
  'navigate': (_ctx, e) => `Opening ${e.screen || 'that screen'}.`,

  // Lesson controls
  'lesson.next':     () => '',  // Silent — screen handles UI
  'lesson.previous': () => '',
  'lesson.repeat':   () => 'Repeating that for you.',
  'lesson.hint':     () => 'Here is a hint.',
  'lesson.start':    () => 'Starting lesson.',
  'lesson.complete': () => 'Marking lesson complete. Well done!',
  'lesson.practice': () => 'Opening quick practice.',
  'lesson.challenge':() => 'Challenge mode on. Good luck!',
  'lesson.exit':     () => 'Exiting lesson.',

  // Speech
  'speech.stop':   () => '',
  'speech.pause':  () => 'Paused.',
  'speech.resume': () => 'Resuming.',
  'speech.faster': () => 'Speaking faster.',
  'speech.slower': () => 'Speaking slower.',
  'speech.louder': () => 'Volume increased.',
  'speech.softer': () => 'Volume decreased.',

  // Device
  'device.connect':    () => 'Connecting to braille device.',
  'device.disconnect': () => 'Disconnecting device.',
  'device.scan':       () => 'Scanning for nearby devices.',
  'device.status':     (ctx) => ctx.deviceConnected ? 'Braille device is connected.' : 'No device connected.',
  'device.print':      (_ctx, e) => `Printing: ${e.printText || 'your text'}.`,

  // Settings
  'settings.language':    (_ctx, e) => `Language changed to ${e.language || 'English'}.`,
  'settings.voice_on':    () => 'Voice assistant enabled.',
  'settings.voice_off':   () => '',  // No TTS when disabling voice
  'settings.announce_on': () => 'Auto-announce enabled.',
  'settings.announce_off':() => 'Auto-announce disabled.',

  // Status
  'status.progress': (ctx) =>
    `You have completed ${ctx.completedLessonsCount} lessons with a ${ctx.streak} day streak. Keep it up!`,
  'status.screen':  (ctx) => `You are on the ${ctx.currentScreen} screen.`,
  'status.lesson':  (ctx) => ctx.currentLesson
    ? `You are on ${ctx.currentLesson.title}, step ${ctx.currentLesson.stepNumber} of ${ctx.currentLesson.totalSteps}.`
    : 'You are not in an active lesson right now.',

  // Notifications
  'notifications.read':  () => 'Opening notifications.',
  'notifications.clear': () => 'All notifications marked as read.',

  // Meta
  'help': () =>
    'You can say things like: go to lessons, next step, give me a hint, connect device, ' +
    'what is my progress, speak slower, and much more. Just talk naturally.',
  'undo':    () => 'Undoing last action.',
  'confirm': () => 'Confirmed.',
  'cancel':  () => 'Cancelled.',
  'greet':   (ctx) => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return `${greeting}! ${ctx.completedLessonsCount > 0
      ? `You have completed ${ctx.completedLessonsCount} lessons. Ready to continue?`
      : "Welcome! Say 'go to lessons' to start learning."}`;
  },

  'unknown': () => "I didn't catch that. Try saying 'help' to hear what I can do.",
};

function getResponse(
  intent: string,
  ctx: AssistantContext,
  entities: Record<string, any>,
  suggestedResponse?: string,
): string {
  if (suggestedResponse) return suggestedResponse;
  const tpl = RESPONSES[intent];
  if (!tpl) return '';
  return typeof tpl === 'function' ? tpl(ctx, entities) : tpl;
}

// ── Intent → VoiceAction mapping ─────────────────────────────────────────────

export function buildAction(nlu: NLUResult, ctx: AssistantContext): VoiceAction {
  const { intent, entities, suggestedResponse } = nlu;
  const response = getResponse(intent, ctx, entities as any, suggestedResponse);

  const base: VoiceAction = {
    id: `${intent}-${Date.now()}`,
    label: response || intent,
    intent,
    entities,
    requiresConfirmation: false,
    undoable: false,
  };

  // Mark destructive actions as requiring confirmation
  if (intent === 'device.disconnect' || intent === 'lesson.exit' ||
      intent === 'notifications.clear' || intent === 'settings.voice_off') {
    base.requiresConfirmation = true;
  }

  // Mark reversible settings/speech changes as undoable
  if (intent.startsWith('settings.') || intent === 'speech.faster' ||
      intent === 'speech.slower' || intent === 'speech.louder' || intent === 'speech.softer') {
    base.undoable = true;
  }

  return base;
}

// ── Action executor ───────────────────────────────────────────────────────────

export async function executeAction(
  action: VoiceAction,
  ctx: AssistantContext,
  handlers: AssistantHandlers,
): Promise<string> {
  const { intent, entities } = action;
  const dispatch = store.dispatch;

  switch (intent) {

    // ── Navigation ────────────────────────────────────────────────────────────
    case 'navigate': {
      const screen = entities.screen || 'Home';
      handlers.onNavigate(screen);
      break;
    }

    // ── Lesson controls ───────────────────────────────────────────────────────
    case 'lesson.next':
      dispatch(nextStep());
      handlers.onLessonAction('next');
      break;

    case 'lesson.previous':
      dispatch(previousStep());
      handlers.onLessonAction('previous');
      break;

    case 'lesson.repeat':
      handlers.onLessonAction('repeat');
      break;

    case 'lesson.hint':
      handlers.onLessonAction('hint');
      break;

    case 'lesson.start':
      handlers.onLessonAction('start');
      break;

    case 'lesson.complete':
      handlers.onLessonAction('complete');
      break;

    case 'lesson.practice':
      handlers.onLessonAction('practice');
      break;

    case 'lesson.challenge':
      handlers.onLessonAction('challenge');
      break;

    case 'lesson.exit':
      handlers.onLessonAction('exit');
      break;

    // ── Speech controls ───────────────────────────────────────────────────────
    case 'speech.stop':
      await voiceService.stopSpeaking();
      break;

    case 'speech.pause':
      await voiceService.pauseSpeaking();
      break;

    case 'speech.resume':
      await voiceService.resumeSpeaking();
      break;

    case 'speech.faster': {
      const s = voiceService.getSettings();
      action.undoFn = async () => { await voiceService.updateSettings({ rate: s.rate }); };
      await voiceService.updateSettings({ rate: Math.min(1.8, s.rate + 0.2) });
      break;
    }

    case 'speech.slower': {
      const s = voiceService.getSettings();
      action.undoFn = async () => { await voiceService.updateSettings({ rate: s.rate }); };
      await voiceService.updateSettings({ rate: Math.max(0.4, s.rate - 0.2) });
      break;
    }

    case 'speech.louder': {
      const s = voiceService.getSettings();
      action.undoFn = async () => { await voiceService.updateSettings({ volume: s.volume }); };
      await voiceService.updateSettings({ volume: Math.min(1.0, s.volume + 0.2) });
      break;
    }

    case 'speech.softer': {
      const s = voiceService.getSettings();
      action.undoFn = async () => { await voiceService.updateSettings({ volume: s.volume }); };
      await voiceService.updateSettings({ volume: Math.max(0.1, s.volume - 0.2) });
      break;
    }

    // ── Device ────────────────────────────────────────────────────────────────
    case 'device.connect':
    case 'device.scan':
      handlers.onNavigate('Device');
      // Screens handle their own BLE logic
      if (global.deviceActionHandler) global.deviceActionHandler(intent === 'device.scan' ? 'scan' : 'connect');
      break;

    case 'device.disconnect':
      if (global.deviceActionHandler) global.deviceActionHandler('disconnect');
      break;

    case 'device.status':
      // Response is already built as spoken text — nothing extra to do
      break;

    case 'device.print':
      if (global.deviceActionHandler) global.deviceActionHandler('print', { text: entities.printText });
      break;

    // ── Settings ──────────────────────────────────────────────────────────────
    case 'settings.language': {
      const lang = entities.language || 'English';
      const prev = store.getState().settings.language;
      action.undoFn = async () => {
        dispatch(updateSetting({ language: prev }));
        await voiceService.updateSettings({ language: { English: 'en-US', Hindi: 'hi-IN', Spanish: 'es-ES' }[prev] || 'en-US' });
      };
      const localeMap: Record<string, string> = { English: 'en-US', Hindi: 'hi-IN', Spanish: 'es-ES' };
      dispatch(updateSetting({ language: lang }));
      await voiceService.updateSettings({ language: localeMap[lang] || 'en-US' });
      break;
    }

    case 'settings.voice_on': {
      const prev = store.getState().settings.voiceEnabled;
      action.undoFn = async () => { dispatch(updateSetting({ voiceEnabled: prev })); voiceService.setVoiceEnabled(prev); };
      dispatch(updateSetting({ voiceEnabled: true }));
      voiceService.setVoiceEnabled(true);
      break;
    }

    case 'settings.voice_off': {
      const prev = store.getState().settings.voiceEnabled;
      action.undoFn = async () => { dispatch(updateSetting({ voiceEnabled: prev })); voiceService.setVoiceEnabled(prev); };
      dispatch(updateSetting({ voiceEnabled: false }));
      voiceService.setVoiceEnabled(false);
      break;
    }

    case 'settings.announce_on': {
      const prev = store.getState().settings.autoAnnounce;
      action.undoFn = async () => { dispatch(updateSetting({ autoAnnounce: prev })); voiceService.setAutoAnnounce(prev); };
      dispatch(updateSetting({ autoAnnounce: true }));
      voiceService.setAutoAnnounce(true);
      break;
    }

    case 'settings.announce_off': {
      const prev = store.getState().settings.autoAnnounce;
      action.undoFn = async () => { dispatch(updateSetting({ autoAnnounce: prev })); voiceService.setAutoAnnounce(prev); };
      dispatch(updateSetting({ autoAnnounce: false }));
      voiceService.setAutoAnnounce(false);
      break;
    }

    // ── Notifications ─────────────────────────────────────────────────────────
    case 'notifications.read':
      handlers.onNavigate('Notifications');
      break;

    case 'notifications.clear':
      notificationService.markAllAsRead();
      break;

    // ── Meta ──────────────────────────────────────────────────────────────────
    case 'help':
    case 'greet':
    case 'status.progress':
    case 'status.screen':
    case 'status.lesson':
    case 'device.status':
      // Pure spoken responses — no side effects needed
      break;

    default:
      break;
  }

  return getResponse(intent, ctx, entities as any, action.label);
}

// Global device action handler (set by DeviceScreen)
declare global {
  var deviceActionHandler: ((action: string, params?: Record<string, any>) => void) | undefined;
}
