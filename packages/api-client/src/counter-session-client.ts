import type {
  EndCounterSessionApiResponse,
  EndCounterSessionRequest,
  GetActiveCounterSessionApiResponse,
  GetActiveCounterSessionRequest,
  StartCounterSessionApiResponse,
  StartCounterSessionRequest,
} from '@qms/contracts';

import type { HttpClient } from './http-client.js';
import { API_PATHS } from './paths.js';

export class CounterSessionClient {
  constructor(private readonly httpClient: HttpClient) {}

  startCounterSession(
    request: StartCounterSessionRequest,
  ): Promise<StartCounterSessionApiResponse> {
    return this.httpClient.request(API_PATHS.counterSession.start, {
      method: 'POST',
      body: request,
    });
  }

  getActiveCounterSession(
    request: GetActiveCounterSessionRequest,
  ): Promise<GetActiveCounterSessionApiResponse> {
    return this.httpClient.request(API_PATHS.counterSession.active, {
      query: { locationId: request.locationId, counterId: request.counterId },
    });
  }

  endCounterSession(request: EndCounterSessionRequest): Promise<EndCounterSessionApiResponse> {
    return this.httpClient.request(API_PATHS.counterSession.end, {
      method: 'POST',
      body: request,
    });
  }
}
