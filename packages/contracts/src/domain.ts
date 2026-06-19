import type {
  CounterId,
  DeviceId,
  EntityId,
  ISODateTimeString,
  LocationId,
  ServiceId,
  SessionId,
  StaffId,
  TicketId,
} from './common.js';
import type {
  AudioOutputMode,
  CounterStatus,
  DeviceStatus,
  DeviceType,
  PriorityLevel,
  SessionStatus,
  TicketSource,
  TicketStatus,
} from './statuses.js';

export interface Location {
  /** BACKEND_CONFIRMATION_REQUIRED: Location identifier format is not confirmed. */
  readonly id: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Location code rules are not confirmed. */
  readonly code: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Location naming rules are not confirmed. */
  readonly name: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Address availability and format are not confirmed. */
  readonly address?: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Location lifecycle semantics are not confirmed. */
  readonly isActive: boolean;
}

export interface User {
  /** BACKEND_CONFIRMATION_REQUIRED: User identifier format is not confirmed. */
  readonly id: EntityId;
  /** BACKEND_CONFIRMATION_REQUIRED: Login identifier rules are not confirmed. */
  readonly username: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Display-name source and privacy rules are not confirmed. */
  readonly displayName: string;
  /** BACKEND_CONFIRMATION_REQUIRED: User-to-location authorization is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: RBAC role names and semantics are not confirmed. */
  readonly roles: readonly string[];
  /** BACKEND_CONFIRMATION_REQUIRED: User lifecycle semantics are not confirmed. */
  readonly isActive: boolean;
}

export interface Staff {
  /** BACKEND_CONFIRMATION_REQUIRED: Staff identifier format is not confirmed. */
  readonly id: StaffId;
  /** BACKEND_CONFIRMATION_REQUIRED: Staff location ownership is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Mapping between staff and login user is not confirmed. */
  readonly userId?: EntityId;
  /** BACKEND_CONFIRMATION_REQUIRED: Staff code format is not confirmed. */
  readonly code: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Staff name exposure rules are not confirmed. */
  readonly fullName: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Position catalogue is not confirmed. */
  readonly position?: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Staff lifecycle semantics are not confirmed. */
  readonly isActive: boolean;
}

export interface Service {
  /** BACKEND_CONFIRMATION_REQUIRED: Service identifier format is not confirmed. */
  readonly id: ServiceId;
  /** BACKEND_CONFIRMATION_REQUIRED: Global versus local service ownership is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Service code format is not confirmed. */
  readonly code: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Service naming rules are not confirmed. */
  readonly name: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Ticket prefix rules are not confirmed. */
  readonly ticketPrefix: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Average handling-time source and unit are not confirmed. */
  readonly averageHandleTimeMinutes?: number;
  /** BACKEND_CONFIRMATION_REQUIRED: Priority feature configuration is not confirmed. */
  readonly isPriorityEnabled: boolean;
}

export interface ServicePool {
  /** BACKEND_CONFIRMATION_REQUIRED: Service-pool identifier format is not confirmed. */
  readonly id: EntityId;
  /** BACKEND_CONFIRMATION_REQUIRED: Service-pool location ownership is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Relationship between a pool and services is not confirmed. */
  readonly serviceId: ServiceId;
  /** BACKEND_CONFIRMATION_REQUIRED: Pool naming rules are not confirmed. */
  readonly name: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Counter membership rules are not confirmed. */
  readonly counterIds: readonly CounterId[];
  /** BACKEND_CONFIRMATION_REQUIRED: Assignment modes and behavior are Backend-owned and unconfirmed. */
  readonly assignmentMode: 'LEAST_QUEUE' | 'ROUND_ROBIN' | 'FIXED';
}

export interface Counter {
  /** BACKEND_CONFIRMATION_REQUIRED: Counter identifier format is not confirmed. */
  readonly id: CounterId;
  /** BACKEND_CONFIRMATION_REQUIRED: Counter location ownership is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Counter-to-service relationship is not confirmed. */
  readonly serviceId?: ServiceId;
  /** BACKEND_CONFIRMATION_REQUIRED: Counter-to-pool relationship is not confirmed. */
  readonly servicePoolId?: EntityId;
  /** BACKEND_CONFIRMATION_REQUIRED: Counter naming rules are not confirmed. */
  readonly name: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Counter status values and transitions are not confirmed. */
  readonly status: CounterStatus;
  /** BACKEND_CONFIRMATION_REQUIRED: Current-ticket projection semantics are not confirmed. */
  readonly currentTicketId?: TicketId;
}

export interface CounterSession {
  /** BACKEND_CONFIRMATION_REQUIRED: Session identifier format is not confirmed. */
  readonly id: SessionId;
  /** BACKEND_CONFIRMATION_REQUIRED: Session location ownership is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Session-to-counter relationship is not confirmed. */
  readonly counterId: CounterId;
  /** BACKEND_CONFIRMATION_REQUIRED: Session-to-staff relationship is not confirmed. */
  readonly staffId: StaffId;
  /** BACKEND_CONFIRMATION_REQUIRED: Session start timestamp rules are not confirmed. */
  readonly startedAt: ISODateTimeString;
  /** BACKEND_CONFIRMATION_REQUIRED: Session end timestamp rules are not confirmed. */
  readonly endedAt?: ISODateTimeString;
  /** BACKEND_CONFIRMATION_REQUIRED: Session status transitions are not confirmed. */
  readonly status: SessionStatus;
  /** BACKEND_CONFIRMATION_REQUIRED: Ticket-count semantics are not confirmed. */
  readonly ticketsServed: number;
}

export interface Ticket {
  /** BACKEND_CONFIRMATION_REQUIRED: Ticket identifier format is not confirmed. */
  readonly id: TicketId;
  /** BACKEND_CONFIRMATION_REQUIRED: Ticket location ownership is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Session association and nullability are not confirmed. */
  readonly sessionId?: SessionId;
  /** BACKEND_CONFIRMATION_REQUIRED: Human-readable ticket-number format is not confirmed. */
  readonly ticketNumber: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Ticket-to-service relationship is not confirmed. */
  readonly serviceId: ServiceId;
  /** BACKEND_CONFIRMATION_REQUIRED: Counter assignment timing and nullability are not confirmed. */
  readonly counterId?: CounterId;
  /** BACKEND_CONFIRMATION_REQUIRED: Service-pool assignment representation is not confirmed. */
  readonly servicePoolId?: EntityId;
  /** BACKEND_CONFIRMATION_REQUIRED: Ticket status values and transitions are not confirmed. */
  readonly status: TicketStatus;
  /** BACKEND_CONFIRMATION_REQUIRED: Ticket source values are not confirmed. */
  readonly source: TicketSource;
  /** BACKEND_CONFIRMATION_REQUIRED: Priority-level meaning and calculation are Backend-owned. */
  readonly priorityLevel: PriorityLevel;
  /** BACKEND_CONFIRMATION_REQUIRED: Ticket issue timestamp rules are not confirmed. */
  readonly issuedAt: ISODateTimeString;
  /** BACKEND_CONFIRMATION_REQUIRED: Called timestamp availability is not confirmed. */
  readonly calledAt?: ISODateTimeString;
  /** BACKEND_CONFIRMATION_REQUIRED: Serving timestamp availability is not confirmed. */
  readonly servingAt?: ISODateTimeString;
  /** BACKEND_CONFIRMATION_REQUIRED: Finish timestamp availability is not confirmed. */
  readonly finishedAt?: ISODateTimeString;
  /** BACKEND_CONFIRMATION_REQUIRED: Multi-service behavior is optional and unconfirmed. */
  readonly nextServiceId?: ServiceId;
  /** BACKEND_CONFIRMATION_REQUIRED: EWT calculation and response field are Backend-owned. */
  readonly estimatedWaitSeconds?: number;
}

export interface QueueSummary {
  /** BACKEND_CONFIRMATION_REQUIRED: Queue-summary location scope is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Waiting-count semantics are not confirmed. */
  readonly waitingCount: number;
  /** BACKEND_CONFIRMATION_REQUIRED: Called-count semantics are not confirmed. */
  readonly calledCount: number;
  /** BACKEND_CONFIRMATION_REQUIRED: Serving-count semantics are not confirmed. */
  readonly servingCount: number;
  /** BACKEND_CONFIRMATION_REQUIRED: Skipped-count semantics are not confirmed. */
  readonly skippedCount: number;
  /** BACKEND_CONFIRMATION_REQUIRED: Average-wait calculation is Backend-owned and unconfirmed. */
  readonly averageWaitSeconds?: number;
  /** BACKEND_CONFIRMATION_REQUIRED: Snapshot timestamp rules are not confirmed. */
  readonly updatedAt: ISODateTimeString;
}

export interface Device {
  /** BACKEND_CONFIRMATION_REQUIRED: Device identifier format is not confirmed. */
  readonly id: DeviceId;
  /** BACKEND_CONFIRMATION_REQUIRED: Device location ownership is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Device code format is not confirmed. */
  readonly code: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Device naming rules are not confirmed. */
  readonly name: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Device type values are not confirmed. */
  readonly type: DeviceType;
  /** BACKEND_CONFIRMATION_REQUIRED: Device status and offline threshold are not confirmed. */
  readonly status: DeviceStatus;
  /** BACKEND_CONFIRMATION_REQUIRED: Last-seen timestamp source is not confirmed. */
  readonly lastSeenAt?: ISODateTimeString;
  /** BACKEND_CONFIRMATION_REQUIRED: Audio routing applicability by device is not confirmed. */
  readonly audioOutputMode?: AudioOutputMode;
}

export interface DisplayState {
  /** BACKEND_CONFIRMATION_REQUIRED: Display-state location scope is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Display-to-counter filtering is not confirmed. */
  readonly counterId?: CounterId;
  /** BACKEND_CONFIRMATION_REQUIRED: Current-ticket projection is not confirmed. */
  readonly currentTicket: Ticket | null;
  /** BACKEND_CONFIRMATION_REQUIRED: Waiting-ticket projection and ordering are not confirmed. */
  readonly waitingTickets: readonly Ticket[];
  /** BACKEND_CONFIRMATION_REQUIRED: Display snapshot timestamp rules are not confirmed. */
  readonly updatedAt: ISODateTimeString;
}

export interface AudioCommand {
  /** BACKEND_CONFIRMATION_REQUIRED: Audio command ticket representation is not confirmed. */
  readonly ticketNumber: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Audio command counter representation is not confirmed. */
  readonly counterName: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Server versus kiosk routing representation is not confirmed. */
  readonly outputMode: AudioOutputMode;
  /** BACKEND_CONFIRMATION_REQUIRED: TTS text versus audio-reference contract is not confirmed. */
  readonly announcementText: string;
}

export interface SurveyConfig {
  /** BACKEND_CONFIRMATION_REQUIRED: Timeout default and limits are not confirmed. */
  readonly surveyTimeoutSeconds: number;
}

export interface SurveySubmission {
  /** BACKEND_CONFIRMATION_REQUIRED: Survey submission identifier is not confirmed. */
  readonly id?: EntityId;
  /** BACKEND_CONFIRMATION_REQUIRED: Survey submission location scope is not confirmed. */
  readonly locationId: LocationId;
  /** BACKEND_CONFIRMATION_REQUIRED: Survey-to-ticket relationship is not confirmed. */
  readonly ticketId: TicketId;
  /** BACKEND_CONFIRMATION_REQUIRED: Survey-to-device relationship is not confirmed. */
  readonly deviceId?: DeviceId;
  /** BACKEND_CONFIRMATION_REQUIRED: Rating scale and requiredness are not confirmed. */
  readonly rating: 1 | 2 | 3 | 4 | 5;
  /** BACKEND_CONFIRMATION_REQUIRED: Feedback limits and sanitization rules are not confirmed. */
  readonly feedback?: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Submission timestamp source is not confirmed. */
  readonly submittedAt: ISODateTimeString;
}
