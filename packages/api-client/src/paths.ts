// BACKEND_CONFIRMATION_REQUIRED: All endpoint candidates and their final grouping under
// the confirmed /api/v1 base path require Backend confirmation.
export const API_PATHS = {
  auth: {
    login: 'auth/login',
    refreshToken: 'auth/refresh',
    logout: 'auth/logout',
  },
  counterSession: {
    start: 'counter-session/start',
    active: 'counter-session/active',
    end: 'counter-session/end',
  },
  queue: {
    waiting: 'queue/waiting',
    callNext: 'queue/call-next',
    recall: 'queue/recall',
    skip: 'queue/skip',
    transfer: 'queue/transfer',
    finish: 'queue/finish',
    assistedTicket: 'queue/ticket/assisted',
  },
  dashboard: {
    summary: 'dashboard/summary',
  },
} as const;
