export const COLLECTIONS = {
  userProfile: (userId: string) => `users/${userId}/profile`,
  auditLog: (userId: string) => `users/${userId}/audit_log`,
  // Future sub-projects will add their collections here
} as const
