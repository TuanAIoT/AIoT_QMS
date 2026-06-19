export interface ApiClientConfig {
  /** API base URL, normally ending in /api/v1. It must be supplied by the consuming App. */
  readonly baseUrl: string;
  readonly getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>;
  readonly timeoutMs?: number;
}
