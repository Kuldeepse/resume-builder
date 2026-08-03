export function deriveEmailDeliveryState(result, fallbackReason = 'Email delivery status is unavailable.') {
  if (result.status === 'fulfilled') {
    if (result.value?.skipped) {
      return {
        status: 'skipped',
        error: fallbackReason,
      };
    }

    return {
      status: 'sent',
      error: null,
    };
  }

  const message =
    result.reason instanceof Error
      ? result.reason.message
      : String(result.reason || 'Email delivery failed.');

  return {
    status: 'failed',
    error: message,
  };
}
