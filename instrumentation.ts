export async function register() {
  // Only enable Sentry instrumentation in production with valid DSN
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      await import('./sentry.server.config');
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
      await import('./sentry.edge.config');
    }
  }
}
