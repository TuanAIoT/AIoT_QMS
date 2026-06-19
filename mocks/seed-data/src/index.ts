import type {
  Counter,
  CounterSession,
  Device,
  Location,
  Service,
  Staff,
  SurveyConfig,
  Ticket,
} from '@qms/contracts';

export const DEMO_LOCATION = {
  id: 'location-demo-001',
  code: 'DEMO-001',
  name: 'Điểm triển khai Demo',
  isActive: true,
} satisfies Location;

export const DEMO_STAFF = [
  {
    id: 'staff-demo-001',
    locationId: DEMO_LOCATION.id,
    code: 'STAFF-DEMO-01',
    fullName: 'Nhân viên Demo 01',
    position: 'Giao dịch viên Demo',
    isActive: true,
  },
  {
    id: 'staff-demo-002',
    locationId: DEMO_LOCATION.id,
    code: 'STAFF-DEMO-02',
    fullName: 'Nhân viên Demo 02',
    position: 'Quản trị viên Demo',
    isActive: true,
  },
] as const satisfies readonly Staff[];

export const DEMO_SERVICES = [
  {
    id: 'service-demo-001',
    locationId: DEMO_LOCATION.id,
    code: 'SERVICE-DEMO-01',
    name: 'Dịch vụ Demo A',
    ticketPrefix: 'A',
    averageHandleTimeMinutes: 5,
    isPriorityEnabled: false,
  },
  {
    id: 'service-demo-002',
    locationId: DEMO_LOCATION.id,
    code: 'SERVICE-DEMO-02',
    name: 'Dịch vụ Demo B',
    ticketPrefix: 'B',
    averageHandleTimeMinutes: 8,
    isPriorityEnabled: true,
  },
  {
    id: 'service-demo-003',
    locationId: DEMO_LOCATION.id,
    code: 'SERVICE-DEMO-03',
    name: 'Dịch vụ Demo C',
    ticketPrefix: 'C',
    averageHandleTimeMinutes: 10,
    isPriorityEnabled: false,
  },
] as const satisfies readonly Service[];

export const DEMO_COUNTERS = [
  {
    id: 'counter-demo-001',
    locationId: DEMO_LOCATION.id,
    serviceId: DEMO_SERVICES[0].id,
    name: 'Quầy Demo 01',
    status: 'OPEN',
    currentTicketId: 'ticket-demo-003',
  },
  {
    id: 'counter-demo-002',
    locationId: DEMO_LOCATION.id,
    serviceId: DEMO_SERVICES[1].id,
    name: 'Quầy Demo 02',
    status: 'OPEN',
    currentTicketId: 'ticket-demo-002',
  },
  {
    id: 'counter-demo-003',
    locationId: DEMO_LOCATION.id,
    serviceId: DEMO_SERVICES[2].id,
    name: 'Quầy Demo 03',
    status: 'CLOSED',
  },
] as const satisfies readonly Counter[];

export const DEMO_ACTIVE_COUNTER_SESSION = {
  id: 'session-demo-001',
  locationId: DEMO_LOCATION.id,
  counterId: DEMO_COUNTERS[0].id,
  staffId: DEMO_STAFF[0].id,
  startedAt: '2026-06-18T08:00:00.000Z',
  status: 'ACTIVE',
  ticketsServed: 2,
} satisfies CounterSession;

export const DEMO_TICKETS = [
  {
    id: 'ticket-demo-001',
    locationId: DEMO_LOCATION.id,
    ticketNumber: 'A-001',
    serviceId: DEMO_SERVICES[0].id,
    status: 'WAITING',
    source: 'KIOSK',
    priorityLevel: 0,
    issuedAt: '2026-06-18T08:05:00.000Z',
  },
  {
    id: 'ticket-demo-002',
    locationId: DEMO_LOCATION.id,
    sessionId: DEMO_ACTIVE_COUNTER_SESSION.id,
    ticketNumber: 'B-001',
    serviceId: DEMO_SERVICES[1].id,
    counterId: DEMO_COUNTERS[1].id,
    status: 'CALLED',
    source: 'ZALO',
    priorityLevel: 1,
    issuedAt: '2026-06-18T08:06:00.000Z',
    calledAt: '2026-06-18T08:10:00.000Z',
  },
  {
    id: 'ticket-demo-003',
    locationId: DEMO_LOCATION.id,
    sessionId: DEMO_ACTIVE_COUNTER_SESSION.id,
    ticketNumber: 'A-002',
    serviceId: DEMO_SERVICES[0].id,
    counterId: DEMO_COUNTERS[0].id,
    status: 'SERVING',
    source: 'STAFF',
    priorityLevel: 0,
    issuedAt: '2026-06-18T08:07:00.000Z',
    calledAt: '2026-06-18T08:11:00.000Z',
    servingAt: '2026-06-18T08:12:00.000Z',
  },
  {
    id: 'ticket-demo-004',
    locationId: DEMO_LOCATION.id,
    ticketNumber: 'C-001',
    serviceId: DEMO_SERVICES[2].id,
    status: 'SKIPPED',
    source: 'KIOSK',
    priorityLevel: 0,
    issuedAt: '2026-06-18T08:08:00.000Z',
  },
  {
    id: 'ticket-demo-005',
    locationId: DEMO_LOCATION.id,
    ticketNumber: 'B-002',
    serviceId: DEMO_SERVICES[1].id,
    counterId: DEMO_COUNTERS[1].id,
    status: 'TRANSFERRED',
    source: 'KIOSK',
    priorityLevel: 2,
    issuedAt: '2026-06-18T08:09:00.000Z',
  },
  {
    id: 'ticket-demo-006',
    locationId: DEMO_LOCATION.id,
    sessionId: DEMO_ACTIVE_COUNTER_SESSION.id,
    ticketNumber: 'A-003',
    serviceId: DEMO_SERVICES[0].id,
    counterId: DEMO_COUNTERS[0].id,
    status: 'FINISHED',
    source: 'KIOSK',
    priorityLevel: 0,
    issuedAt: '2026-06-18T07:45:00.000Z',
    calledAt: '2026-06-18T07:50:00.000Z',
    servingAt: '2026-06-18T07:51:00.000Z',
    finishedAt: '2026-06-18T07:58:00.000Z',
  },
  {
    id: 'ticket-demo-007',
    locationId: DEMO_LOCATION.id,
    ticketNumber: 'C-002',
    serviceId: DEMO_SERVICES[2].id,
    status: 'CANCELLED',
    source: 'ZALO',
    priorityLevel: 0,
    issuedAt: '2026-06-18T07:55:00.000Z',
  },
] as const satisfies readonly Ticket[];

export const DEMO_DEVICES = [
  {
    id: 'device-demo-kiosk-001',
    locationId: DEMO_LOCATION.id,
    code: 'DEVICE-KIOSK-DEMO-01',
    name: 'Kiosk Demo 01',
    type: 'KIOSK',
    status: 'ONLINE',
    lastSeenAt: '2026-06-18T08:15:00.000Z',
    audioOutputMode: 'KIOSK_SPEAKER',
  },
  {
    id: 'device-demo-display-001',
    locationId: DEMO_LOCATION.id,
    code: 'DEVICE-DISPLAY-DEMO-01',
    name: 'Màn hình Demo 01',
    type: 'DISPLAY_BOX',
    status: 'ONLINE',
    lastSeenAt: '2026-06-18T08:15:00.000Z',
  },
  {
    id: 'device-demo-tablet-001',
    locationId: DEMO_LOCATION.id,
    code: 'DEVICE-TABLET-DEMO-01',
    name: 'Thiết bị đánh giá Demo 01',
    type: 'TABLET',
    status: 'OFFLINE',
    lastSeenAt: '2026-06-18T07:30:00.000Z',
  },
] as const satisfies readonly Device[];

// BACKEND_CONFIRMATION_REQUIRED: Development-only timeout; product default and limits are pending.
export const DEMO_SURVEY_CONFIG = {
  surveyTimeoutSeconds: 20,
} satisfies SurveyConfig;

export const QMS_SEED_DATA = {
  locations: [DEMO_LOCATION],
  staff: DEMO_STAFF,
  services: DEMO_SERVICES,
  counters: DEMO_COUNTERS,
  activeCounterSession: DEMO_ACTIVE_COUNTER_SESSION,
  tickets: DEMO_TICKETS,
  devices: DEMO_DEVICES,
  surveyConfig: DEMO_SURVEY_CONFIG,
} as const;
