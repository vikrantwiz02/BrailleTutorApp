import type { VoiceCommand } from './voiceCommandService';

export interface VoiceTask {
  id: string;
  label: string;
  command: VoiceCommand;
  requiresConfirmation: boolean;
  undoable: boolean;
}

interface UndoRecord {
  taskId: string;
  undo: (() => Promise<void> | void) | null;
  timestamp: number;
}

class VoiceTaskRegistryService {
  private pendingTask: VoiceTask | null = null;
  private lastUndoRecord: UndoRecord | null = null;

  private readonly CONFIRM_PATTERNS = /^(yes|confirm|do it|go ahead|okay|ok)$/i;
  private readonly CANCEL_PATTERNS = /^(no|cancel|stop that|never mind)$/i;
  private readonly UNDO_PATTERNS = /^(undo|go back|revert|rollback)$/i;

  mapCommandToTask(command: VoiceCommand, context: string): VoiceTask | null {
    if (command.type === 'unknown') {
      return null;
    }

    const base = {
      command,
      requiresConfirmation: false,
      undoable: false,
    };

    if (command.type === 'navigate') {
      return {
        ...base,
        id: `nav.${command.action.toLowerCase()}`,
        label: `Navigate to ${command.action}`,
      };
    }

    if (command.type === 'lesson') {
      const risky = command.action === 'complete';
      return {
        ...base,
        id: `lesson.${command.action}`,
        label: `Lesson ${command.action}`,
        requiresConfirmation: risky,
      };
    }

    if (command.type === 'device') {
      const risky = command.action === 'disconnect';
      return {
        ...base,
        id: `device.${command.action}`,
        label: `Device ${command.action}`,
        requiresConfirmation: risky,
      };
    }

    if (command.type === 'notification') {
      const risky = command.action === 'clear';
      return {
        ...base,
        id: `notification.${command.action}`,
        label: `Notification ${command.action}`,
        requiresConfirmation: risky,
      };
    }

    if (command.type === 'settings') {
      const undoable = command.action !== 'voice_off';
      const risky = command.action === 'voice_off';
      return {
        ...base,
        id: `settings.${command.action}`,
        label: `Settings ${command.action}`,
        requiresConfirmation: risky,
        undoable,
      };
    }

    if (command.type === 'speech') {
      const undoable = command.action !== 'stop';
      return {
        ...base,
        id: `speech.${command.action}`,
        label: `Speech ${command.action}`,
        undoable,
      };
    }

    if (command.type === 'help') {
      return {
        ...base,
        id: `help.${context}`,
        label: 'Read available voice commands',
      };
    }

    if (command.type === 'status') {
      return {
        ...base,
        id: `status.${command.action}`,
        label: 'Read status',
      };
    }

    return {
      ...base,
      id: `${command.type}.${command.action}`,
      label: `${command.type} ${command.action}`,
    };
  }

  isConfirmText(text: string): boolean {
    return this.CONFIRM_PATTERNS.test(text.trim());
  }

  isCancelText(text: string): boolean {
    return this.CANCEL_PATTERNS.test(text.trim());
  }

  isUndoText(text: string): boolean {
    return this.UNDO_PATTERNS.test(text.trim());
  }

  queueForConfirmation(task: VoiceTask): string {
    this.pendingTask = task;
    return `Please confirm: ${task.label}. Say confirm or cancel.`;
  }

  confirmPendingTask(): VoiceTask | null {
    const task = this.pendingTask;
    this.pendingTask = null;
    return task;
  }

  cancelPendingTask(): boolean {
    if (!this.pendingTask) return false;
    this.pendingTask = null;
    return true;
  }

  hasPendingTask(): boolean {
    return this.pendingTask !== null;
  }

  rememberUndo(task: VoiceTask, undo: (() => Promise<void> | void) | null): void {
    if (!task.undoable) return;
    this.lastUndoRecord = {
      taskId: task.id,
      undo,
      timestamp: Date.now(),
    };
  }

  async undoLastTask(): Promise<{ ok: boolean; message: string }> {
    if (!this.lastUndoRecord) {
      return { ok: false, message: 'No recent undoable task found.' };
    }

    if (!this.lastUndoRecord.undo) {
      return { ok: false, message: 'Last task cannot be undone.' };
    }

    await this.lastUndoRecord.undo();
    const taskId = this.lastUndoRecord.taskId;
    this.lastUndoRecord = null;
    return { ok: true, message: `Undid task ${taskId}.` };
  }
}

export const voiceTaskRegistryService = new VoiceTaskRegistryService();
export default voiceTaskRegistryService;
