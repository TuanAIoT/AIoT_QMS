import type { DashboardSummaryApiResponse, DashboardSummaryRequest } from '@qms/contracts';

import type { HttpClient } from './http-client.js';
import { API_PATHS } from './paths.js';

export class DashboardClient {
  constructor(private readonly httpClient: HttpClient) {}

  getDashboardSummary(request: DashboardSummaryRequest): Promise<DashboardSummaryApiResponse> {
    return this.httpClient.request(API_PATHS.dashboard.summary, {
      query: { locationId: request.locationId },
    });
  }
}
