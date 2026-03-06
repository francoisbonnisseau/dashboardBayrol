export function formatBotpressError(error: unknown, fallbackMessage: string): string {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (
    normalized.includes('token is invalid') ||
    normalized.includes('invalid token') ||
    normalized.includes('unauthorized') ||
    normalized.includes('status code 401')
  ) {
    return 'Unable to connect to Botpress. Please check configuration.';
  }

  return message || fallbackMessage;
}
