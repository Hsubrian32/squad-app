/**
 * Centralised logger shim.
 *
 * • In __DEV__: pretty-prints to the metro console.
 * • In production: forwards to Sentry (once integrated) and stays silent
 *   otherwise — no unintentional data leakage.
 *
 * Wire Sentry by uncommenting the TODO lines below after running:
 *   npx expo install @sentry/react-native
 *   npx sentry-wizard -i reactNative
 */

// import * as Sentry from '@sentry/react-native';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  if (__DEV__) {
    const prefix = `[${level.toUpperCase()}]`;
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](prefix, message, ...args);
    return;
  }

  if (level === 'error' || level === 'warn') {
    // TODO — forward to Sentry in production:
    // Sentry.captureMessage(`${message} ${args.join(' ')}`, level === 'error' ? 'error' : 'warning');
  }
}

export const logger = {
  debug: (msg: string, ...args: unknown[]) => log('debug', msg, ...args),
  info:  (msg: string, ...args: unknown[]) => log('info',  msg, ...args),
  warn:  (msg: string, ...args: unknown[]) => log('warn',  msg, ...args),
  error: (msg: string, ...args: unknown[]) => log('error', msg, ...args),

  /**
   * Log a caught exception with optional context.
   * Wire to Sentry.captureException() when ready.
   */
  exception: (error: unknown, context?: Record<string, unknown>): void => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[EXCEPTION]', error, context);
      return;
    }
    // TODO — Sentry.captureException(error, { extra: context });
  },
};
