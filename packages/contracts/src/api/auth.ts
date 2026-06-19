import type { ApiResponse, ISODateTimeString } from '../common.js';
import type { User } from '../domain.js';

export interface LoginRequest {
  /** BACKEND_CONFIRMATION_REQUIRED: Login identifier and normalization rules are not confirmed. */
  readonly username: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Credential mechanism and password policy are not confirmed. */
  readonly password: string;
}

export interface LoginResponse {
  /** BACKEND_CONFIRMATION_REQUIRED: Access-token format and transport are not confirmed. */
  readonly accessToken: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Refresh-token issuance and rotation are not confirmed. */
  readonly refreshToken: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Token expiry representation is not confirmed. */
  readonly accessTokenExpiresAt: ISODateTimeString;
  /** BACKEND_CONFIRMATION_REQUIRED: Authenticated user projection is not confirmed. */
  readonly user: User;
}

/** BACKEND_CONFIRMATION_REQUIRED: Login response envelope is not confirmed. */
export type LoginApiResponse = ApiResponse<LoginResponse>;

export interface RefreshTokenRequest {
  /** BACKEND_CONFIRMATION_REQUIRED: Refresh-token transport and rotation are not confirmed. */
  readonly refreshToken: string;
}

export interface RefreshTokenResponse {
  /** BACKEND_CONFIRMATION_REQUIRED: Refreshed access-token format is not confirmed. */
  readonly accessToken: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Refresh-token rotation behavior is not confirmed. */
  readonly refreshToken: string;
  /** BACKEND_CONFIRMATION_REQUIRED: Token expiry representation is not confirmed. */
  readonly accessTokenExpiresAt: ISODateTimeString;
}

/** BACKEND_CONFIRMATION_REQUIRED: Refresh-token response envelope is not confirmed. */
export type RefreshTokenApiResponse = ApiResponse<RefreshTokenResponse>;

export interface LogoutRequest {
  /** BACKEND_CONFIRMATION_REQUIRED: Whether logout requires a refresh token is not confirmed. */
  readonly refreshToken?: string;
}

export interface LogoutResponse {
  /** BACKEND_CONFIRMATION_REQUIRED: Logout acknowledgement and revocation semantics are not confirmed. */
  readonly loggedOut: boolean;
}

/** BACKEND_CONFIRMATION_REQUIRED: Logout response envelope is not confirmed. */
export type LogoutApiResponse = ApiResponse<LogoutResponse>;
