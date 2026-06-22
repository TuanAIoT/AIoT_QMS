import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type Booking,
  type BookingApi,
  type BookingStatus,
  type CentralLocation,
  type CentralService,
  type CheckInToken,
  createIdempotencyKey,
} from './central-api';

const TERMINAL_STATUSES: ReadonlySet<BookingStatus> = new Set([
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
]);
const MAX_TIMER_DELAY_MS = 2_147_483_647;

type RetryAction = 'initialize' | 'services' | 'create' | 'qr' | 'cancel' | 'poll';
type BusyAction = 'initialize' | 'services' | 'create' | 'qr' | 'cancel' | null;

interface FlowError {
  readonly message: string;
  readonly retryAction: RetryAction;
}

export interface BookingFlowOptions {
  readonly api: BookingApi | null;
  readonly enabled: boolean;
  readonly pollIntervalMs?: number;
  readonly createKey?: () => string;
  readonly now?: () => Date;
  readonly confirmCancel?: () => boolean;
}

export interface BookingFlow {
  readonly phase: 'idle' | 'initializing' | 'ready';
  readonly locations: readonly CentralLocation[];
  readonly services: readonly CentralService[];
  readonly selectedLocationId: string;
  readonly selectedServiceId: string;
  readonly booking: Booking | null;
  readonly checkInToken: CheckInToken | null;
  readonly busyAction: BusyAction;
  readonly error: FlowError | null;
  readonly isTerminal: boolean;
  selectLocation(locationId: string): void;
  selectService(serviceId: string): void;
  createBooking(): Promise<void>;
  createQr(): Promise<void>;
  cancelBooking(): Promise<void>;
  retry(): void;
}

function safeMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function useBookingFlow(options: BookingFlowOptions): BookingFlow {
  const api = options.api;
  const pollIntervalMs = options.pollIntervalMs ?? 5_000;
  const keyFactory = options.createKey ?? createIdempotencyKey;
  const now = useMemo(() => options.now ?? (() => new Date()), [options.now]);
  const confirmCancel = useMemo(
    () => options.confirmCancel ?? (() => window.confirm('Bạn có chắc muốn hủy lượt này?')),
    [options.confirmCancel],
  );
  const [phase, setPhase] = useState<BookingFlow['phase']>('idle');
  const [locations, setLocations] = useState<readonly CentralLocation[]>([]);
  const [services, setServices] = useState<readonly CentralService[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [checkInToken, setCheckInToken] = useState<CheckInToken | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [error, setError] = useState<FlowError | null>(null);
  const [initializeAttempt, setInitializeAttempt] = useState(0);
  const [serviceAttempt, setServiceAttempt] = useState(0);
  const [pollAttempt, setPollAttempt] = useState(0);
  const actionController = useRef<AbortController | null>(null);
  const actionInFlight = useRef(false);
  const mounted = useRef(true);
  const createKeyRef = useRef<string>();
  const qrKeyRef = useRef<string>();
  const cancelKeyRef = useRef<string>();

  useEffect(() => {
    if (!options.enabled || api === null) {
      setPhase('idle');
      return;
    }
    const controller = new AbortController();
    let active = true;
    setPhase('initializing');
    setBusyAction('initialize');
    setError(null);
    void (async () => {
      try {
        await api.authenticate(controller.signal);
        const loadedLocations = await api.getLocations(controller.signal);
        if (active) {
          setLocations(loadedLocations);
          setPhase('ready');
          setBusyAction(null);
        }
      } catch (caught) {
        if (active && !controller.signal.aborted) {
          setPhase('idle');
          setBusyAction(null);
          setError({ message: safeMessage(caught), retryAction: 'initialize' });
        }
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [api, initializeAttempt, options.enabled]);

  useEffect(() => {
    setSelectedServiceId('');
    setServices([]);
    if (!options.enabled || api === null || selectedLocationId.length === 0) {
      return;
    }
    const controller = new AbortController();
    let active = true;
    setBusyAction('services');
    setError(null);
    void api
      .getServices(selectedLocationId, controller.signal)
      .then((loadedServices) => {
        if (active) {
          setServices(loadedServices);
          setBusyAction(null);
        }
      })
      .catch((caught: unknown) => {
        if (active && !controller.signal.aborted) {
          setBusyAction(null);
          setError({ message: safeMessage(caught), retryAction: 'services' });
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [api, options.enabled, selectedLocationId, serviceAttempt]);

  const activeBookingId = booking?.bookingId;
  const activeBookingStatus = booking?.status;

  useEffect(() => {
    if (checkInToken === null) {
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tokenValue = checkInToken.checkInToken;
    const expiresAt = Date.parse(checkInToken.expiresAt);
    const expireWhenDue = (): void => {
      const remainingMs = expiresAt - Date.now();
      if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
        timer = setTimeout(() => {
          if (active) {
            setCheckInToken((current) =>
              current?.checkInToken === tokenValue ? null : current,
            );
          }
        }, 0);
        return;
      }
      timer = setTimeout(expireWhenDue, Math.min(remainingMs, MAX_TIMER_DELAY_MS));
    };
    expireWhenDue();
    return () => {
      active = false;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, [checkInToken]);

  useEffect(() => {
    if (
      api === null ||
      activeBookingId === undefined ||
      activeBookingStatus === undefined ||
      isTerminalBookingStatus(activeBookingStatus)
    ) {
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const poll = async (): Promise<void> => {
      controller = new AbortController();
      try {
        const status = await api.getBookingStatus(activeBookingId, controller.signal);
        if (!active) {
          return;
        }
        setBooking((current) =>
          current?.bookingId === status.bookingId
            ? {
                ...current,
                status: status.status,
                updatedAt: status.updatedAt,
                canCancel: isTerminalBookingStatus(status.status) ? false : current.canCancel,
              }
            : current,
        );
        setError((current) => (current?.retryAction === 'poll' ? null : current));
        if (isTerminalBookingStatus(status.status)) {
          setCheckInToken(null);
          setError(null);
          return;
        }
        timer = setTimeout(() => void poll(), pollIntervalMs);
      } catch (caught) {
        if (active && controller.signal.aborted !== true) {
          setError({ message: safeMessage(caught), retryAction: 'poll' });
          timer = setTimeout(() => void poll(), pollIntervalMs);
        }
      }
    };
    timer = setTimeout(() => void poll(), pollIntervalMs);
    return () => {
      active = false;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      controller?.abort();
    };
  }, [api, activeBookingId, activeBookingStatus, pollAttempt, pollIntervalMs]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      actionController.current?.abort();
    };
  }, []);

  const runExclusive = useCallback(
    async (
      action: Exclude<BusyAction, 'initialize' | 'services' | null>,
      work: (signal: AbortSignal) => Promise<void>,
    ) => {
      if (actionInFlight.current) {
        return;
      }
      actionInFlight.current = true;
      const controller = new AbortController();
      actionController.current = controller;
      setBusyAction(action);
      setError(null);
      try {
        await work(controller.signal);
      } finally {
        if (actionController.current === controller) {
          actionController.current = null;
        }
        actionInFlight.current = false;
        if (mounted.current) {
          setBusyAction(null);
        }
      }
    },
    [],
  );

  const createBookingAction = useCallback(async (): Promise<void> => {
    if (
      api === null ||
      selectedLocationId.length === 0 ||
      selectedServiceId.length === 0 ||
      booking !== null
    ) {
      return;
    }
    await runExclusive('create', async (signal) => {
      const key = createKeyRef.current ?? keyFactory();
      createKeyRef.current = key;
      try {
        const created = await api.createBooking(
          {
            locationId: selectedLocationId,
            serviceId: selectedServiceId,
            requestedStartAt: now().toISOString(),
          },
          key,
          signal,
        );
        if (!mounted.current || signal.aborted) {
          return;
        }
        createKeyRef.current = undefined;
        setBooking(created);
        setCheckInToken(null);
      } catch (caught) {
        if (mounted.current && !signal.aborted) {
          setError({ message: safeMessage(caught), retryAction: 'create' });
        }
      }
    });
  }, [api, booking, keyFactory, now, runExclusive, selectedLocationId, selectedServiceId]);

  const createQrAction = useCallback(async (): Promise<void> => {
    if (api === null || booking === null || isTerminalBookingStatus(booking.status)) {
      return;
    }
    await runExclusive('qr', async (signal) => {
      const key = qrKeyRef.current ?? keyFactory();
      qrKeyRef.current = key;
      try {
        const issued = await api.createCheckInToken(booking.bookingId, key, signal);
        if (!mounted.current || signal.aborted) {
          return;
        }
        qrKeyRef.current = undefined;
        setCheckInToken(issued);
      } catch (caught) {
        if (mounted.current && !signal.aborted) {
          setError({ message: safeMessage(caught), retryAction: 'qr' });
        }
      }
    });
  }, [api, booking, keyFactory, runExclusive]);

  const cancelBookingAction = useCallback(async (): Promise<void> => {
    if (
      api === null ||
      booking === null ||
      !booking.canCancel ||
      isTerminalBookingStatus(booking.status) ||
      !confirmCancel()
    ) {
      return;
    }
    await runExclusive('cancel', async (signal) => {
      const key = cancelKeyRef.current ?? keyFactory();
      cancelKeyRef.current = key;
      try {
        const cancelled = await api.cancelBooking(booking.bookingId, key, signal);
        if (!mounted.current || signal.aborted) {
          return;
        }
        cancelKeyRef.current = undefined;
        setBooking((current) =>
          current?.bookingId === cancelled.bookingId
            ? {
                ...current,
                status: cancelled.status,
                updatedAt: cancelled.cancelledAt,
                canCancel: false,
              }
            : current,
        );
        setCheckInToken(null);
      } catch (caught) {
        if (mounted.current && !signal.aborted) {
          setError({ message: safeMessage(caught), retryAction: 'cancel' });
        }
      }
    });
  }, [api, booking, confirmCancel, keyFactory, runExclusive]);

  const retry = useCallback((): void => {
    if (error === null) {
      return;
    }
    if (error.retryAction === 'initialize') {
      setInitializeAttempt((value) => value + 1);
    } else if (error.retryAction === 'services') {
      setServiceAttempt((value) => value + 1);
    } else if (error.retryAction === 'create') {
      void createBookingAction();
    } else if (error.retryAction === 'qr') {
      void createQrAction();
    } else if (error.retryAction === 'cancel') {
      void cancelBookingAction();
    } else {
      setPollAttempt((value) => value + 1);
    }
  }, [cancelBookingAction, createBookingAction, createQrAction, error]);

  return {
    phase,
    locations,
    services,
    selectedLocationId,
    selectedServiceId,
    booking,
    checkInToken,
    busyAction,
    error,
    isTerminal: booking === null ? false : isTerminalBookingStatus(booking.status),
    selectLocation: setSelectedLocationId,
    selectService: setSelectedServiceId,
    createBooking: createBookingAction,
    createQr: createQrAction,
    cancelBooking: cancelBookingAction,
    retry,
  };
}
