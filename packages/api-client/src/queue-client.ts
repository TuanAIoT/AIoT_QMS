import type {
  AssistedTicketApiResponse,
  AssistedTicketRequest,
  CallNextApiResponse,
  CallNextRequest,
  FinishApiResponse,
  FinishRequest,
  GetWaitingQueueApiResponse,
  GetWaitingQueueRequest,
  RecallApiResponse,
  RecallRequest,
  SkipApiResponse,
  SkipRequest,
  TransferApiResponse,
  TransferRequest,
} from '@qms/contracts';

import type { HttpClient } from './http-client.js';
import { API_PATHS } from './paths.js';

export class QueueClient {
  constructor(private readonly httpClient: HttpClient) {}

  getWaitingQueue(request: GetWaitingQueueRequest): Promise<GetWaitingQueueApiResponse> {
    return this.httpClient.request(API_PATHS.queue.waiting, {
      query: {
        locationId: request.locationId,
        counterId: request.counterId,
        serviceId: request.serviceId,
        page: request.pagination?.page,
        pageSize: request.pagination?.pageSize,
      },
    });
  }

  callNext(request: CallNextRequest): Promise<CallNextApiResponse> {
    return this.post(API_PATHS.queue.callNext, request);
  }

  recallTicket(request: RecallRequest): Promise<RecallApiResponse> {
    return this.post(API_PATHS.queue.recall, request);
  }

  skipTicket(request: SkipRequest): Promise<SkipApiResponse> {
    return this.post(API_PATHS.queue.skip, request);
  }

  transferTicket(request: TransferRequest): Promise<TransferApiResponse> {
    return this.post(API_PATHS.queue.transfer, request);
  }

  finishTicket(request: FinishRequest): Promise<FinishApiResponse> {
    return this.post(API_PATHS.queue.finish, request);
  }

  createAssistedTicket(request: AssistedTicketRequest): Promise<AssistedTicketApiResponse> {
    return this.post(API_PATHS.queue.assistedTicket, request);
  }

  private post<TResponse>(path: string, body: unknown): Promise<TResponse> {
    return this.httpClient.request(path, { method: 'POST', body });
  }
}
