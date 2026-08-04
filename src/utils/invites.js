// Shared helpers for the email-link invite flow (pendingInvites + /join).

export function getInviteActionCodeSettings(orgId, inviteId) {
  return {
    url: `${window.location.origin}/join?orgId=${orgId}&inviteId=${inviteId}`,
    handleCodeInApp: true,
  }
}
