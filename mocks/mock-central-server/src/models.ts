export const BOOKING_STATUSES = [
  'CREATED',
  'CONFIRMED',
  'READY_FOR_CHECK_IN',
  'CHECKED_IN',
  'QUEUED',
  'CALLED',
  'SERVING',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export interface MockLocation {
  readonly locationId: string;
  readonly code: string;
  readonly displayName: string;
  readonly displayAddress: string;
  readonly timeZone: 'Asia/Ho_Chi_Minh';
}

export interface MockService {
  readonly serviceId: string;
  readonly locationId: string;
  readonly code: string;
  readonly displayName: string;
  readonly bookingEnabled: boolean;
}

export interface Booking {
  readonly bookingId: string;
  readonly bookingReference: string;
  readonly locationId: string;
  readonly serviceId: string;
  readonly status: BookingStatus;
  readonly requestedStartAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly canCancel: boolean;
}

export interface BookingStatusView {
  readonly bookingId: string;
  readonly status: BookingStatus;
  readonly updatedAt: string;
  readonly stale: false;
}

export interface CheckInTokenResponse {
  readonly bookingId: string;
  readonly tokenType: 'QMS_CHECK_IN';
  readonly checkInToken: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface AuthExchangeResponse {
  readonly accessToken: string;
  readonly expiresAt: string;
  readonly sessionId: string;
}

export interface CancellationResponse {
  readonly bookingId: string;
  readonly status: 'CANCELLED';
  readonly cancelledAt: string;
}

export interface PaginationResponse<T> {
  readonly items: readonly T[];
  readonly totalItems: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export const MOCK_LOCATIONS: readonly MockLocation[] = [
  {
    locationId: 'loc_demo_north_7k2m',
    code: 'DEMO-NORTH',
    displayName: 'Điểm phục vụ Demo Bắc',
    displayAddress: 'Khu vực công khai Demo Bắc',
    timeZone: 'Asia/Ho_Chi_Minh',
  },
  {
    locationId: 'loc_demo_south_9p4x',
    code: 'DEMO-SOUTH',
    displayName: 'Điểm phục vụ Demo Nam',
    displayAddress: 'Khu vực công khai Demo Nam',
    timeZone: 'Asia/Ho_Chi_Minh',
  },
] as const;

export const MOCK_SERVICES: readonly MockService[] = [
  {
    serviceId: 'svc_demo_north_a3f8',
    locationId: 'loc_demo_north_7k2m',
    code: 'SVC-N-A',
    displayName: 'Dịch vụ Mẫu A',
    bookingEnabled: true,
  },
  {
    serviceId: 'svc_demo_north_b6q1',
    locationId: 'loc_demo_north_7k2m',
    code: 'SVC-N-B',
    displayName: 'Dịch vụ Mẫu B',
    bookingEnabled: true,
  },
  {
    serviceId: 'svc_demo_south_c2w5',
    locationId: 'loc_demo_south_9p4x',
    code: 'SVC-S-C',
    displayName: 'Dịch vụ Mẫu C',
    bookingEnabled: true,
  },
  {
    serviceId: 'svc_demo_south_d8r7',
    locationId: 'loc_demo_south_9p4x',
    code: 'SVC-S-D',
    displayName: 'Dịch vụ Mẫu D',
    bookingEnabled: true,
  },
] as const;
