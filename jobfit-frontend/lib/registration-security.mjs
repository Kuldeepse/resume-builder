// Never release an existing registrant's tracking code or mutate their record
// in response to an unauthenticated repeat registration.
export function isDuplicateRegistration(status, errorCode) {
  return status === 409 && String(errorCode || '') === '23505';
}

export function duplicateRegistrationResponse() {
  return {
    status: 'received',
    registration_id: null,
    status_lookup_code: null,
    message: 'Your request has been received. If you registered previously, use the tracking code from your original confirmation email. Existing registration details have not been changed.',
  };
}
