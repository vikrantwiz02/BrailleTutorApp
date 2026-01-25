// Production Logger Service
// Provides consistent logging with environment-aware behavior

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  context?: string;
}

class Logger {
  private isDevelopment = __DEV__;
  private sentryDSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

  private formatMessage(level: LogLevel, message: string, context?: string): string {
    const prefix = context ? `[${context}]` : '';
    return `${prefix} ${message}`;
  }

  private createEntry(level: LogLevel, message: string, data?: any, context?: string): LogEntry {
    return {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      context,
    };
  }

  private sendToSentry(entry: LogEntry): void {
    if (this.sentryDSN && entry.level === 'error') {
      // Sentry integration would go here
      // Sentry.captureMessage(entry.message, { extra: entry.data });
    }
  }

  debug(message: string, data?: any, context?: string): void {
    if (this.isDevelopment) {
      console.log(this.formatMessage('debug', message, context), data || '');
    }
  }

  info(message: string, data?: any, context?: string): void {
    if (this.isDevelopment) {
      console.info(this.formatMessage('info', message, context), data || '');
    }
    // In production, could send to analytics
  }

  warn(message: string, data?: any, context?: string): void {
    const entry = this.createEntry('warn', message, data, context);
    console.warn(this.formatMessage('warn', message, context), data || '');
    this.sendToSentry(entry);
  }

  error(message: string, error?: Error | any, context?: string): void {
    const entry = this.createEntry('error', message, { error: error?.message || error }, context);
    console.error(this.formatMessage('error', message, context), error || '');
    this.sendToSentry(entry);
  }

  // Track user actions for analytics
  track(event: string, properties?: Record<string, any>): void {
    if (this.isDevelopment) {
      console.log(`[TRACK] ${event}`, properties || '');
    }
    // In production, would send to analytics service
  }
}

export const logger = new Logger();
export default logger;
