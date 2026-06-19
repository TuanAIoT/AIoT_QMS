import { AuthClient } from './auth-client.js';
import type { ApiClientConfig } from './config.js';
import { CounterSessionClient } from './counter-session-client.js';
import { DashboardClient } from './dashboard-client.js';
import { HttpClient } from './http-client.js';
import { QueueClient } from './queue-client.js';

export interface ApiClient {
  readonly authClient: AuthClient;
  readonly counterSessionClient: CounterSessionClient;
  readonly queueClient: QueueClient;
  readonly dashboardClient: DashboardClient;
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const httpClient = new HttpClient(config);
  return {
    authClient: new AuthClient(httpClient),
    counterSessionClient: new CounterSessionClient(httpClient),
    queueClient: new QueueClient(httpClient),
    dashboardClient: new DashboardClient(httpClient),
  };
}
