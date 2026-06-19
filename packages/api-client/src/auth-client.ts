import type {
  LoginApiResponse,
  LoginRequest,
  LogoutApiResponse,
  LogoutRequest,
  RefreshTokenApiResponse,
  RefreshTokenRequest,
} from '@qms/contracts';

import type { HttpClient } from './http-client.js';
import { API_PATHS } from './paths.js';

export class AuthClient {
  constructor(private readonly httpClient: HttpClient) {}

  login(request: LoginRequest): Promise<LoginApiResponse> {
    return this.httpClient.request(API_PATHS.auth.login, { method: 'POST', body: request });
  }

  refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenApiResponse> {
    return this.httpClient.request(API_PATHS.auth.refreshToken, {
      method: 'POST',
      body: request,
    });
  }

  logout(request: LogoutRequest): Promise<LogoutApiResponse> {
    return this.httpClient.request(API_PATHS.auth.logout, { method: 'POST', body: request });
  }
}
