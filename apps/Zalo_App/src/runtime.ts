import { getSystemInfo } from 'zmp-sdk/apis';

export type ZaloRuntimeKind = 'zalo-mini-app' | 'browser-development';

export type ZaloRuntimeState =
  | { readonly phase: 'initializing' }
  | { readonly phase: 'ready'; readonly runtime: ZaloRuntimeKind }
  | { readonly phase: 'unsupported' }
  | { readonly phase: 'configuration-error' };

export interface ZaloRuntimeConfig {
  readonly miniAppId?: string;
  readonly browserDevelopmentEnabled: boolean;
  readonly systemInfoTimeoutMs?: number;
}

export type SystemInfoReader = () => unknown | Promise<unknown>;

const DEFAULT_SYSTEM_INFO_TIMEOUT_MS = 1_500;

export function isBrowserDevelopmentEnabled(
  isDevelopment: boolean,
  configuredValue: string | undefined,
): boolean {
  return isDevelopment && configuredValue === 'true';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isZaloSystemInfo(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    (value.platform === 'android' || value.platform === 'iOS' || value.platform === 'wp') &&
    typeof value.apiVersion === 'string' &&
    value.apiVersion.trim().length > 0
  );
}

function hasConfiguredMiniAppId(value: string | undefined): boolean {
  return (
    value !== undefined && value.trim().length > 0 && value !== 'replace-with-zalo-mini-app-id'
  );
}

export async function initializeZaloRuntime(
  config: ZaloRuntimeConfig,
  readSystemInfo: SystemInfoReader = getSystemInfo,
): Promise<ZaloRuntimeState> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutMs = config.systemInfoTimeoutMs ?? DEFAULT_SYSTEM_INFO_TIMEOUT_MS;
    const systemInfo = await Promise.race([
      Promise.resolve().then(readSystemInfo),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Zalo runtime detection timed out')),
          timeoutMs,
        );
      }),
    ]);
    if (isZaloSystemInfo(systemInfo)) {
      return hasConfiguredMiniAppId(config.miniAppId)
        ? { phase: 'ready', runtime: 'zalo-mini-app' }
        : { phase: 'configuration-error' };
    }
  } catch {
    // The official SDK can be unavailable outside the Zalo container. Browser development
    // remains explicit and does not fall through to any identity or permission API.
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }

  return config.browserDevelopmentEnabled
    ? { phase: 'ready', runtime: 'browser-development' }
    : { phase: 'unsupported' };
}

export function getRuntimeConfig(): ZaloRuntimeConfig {
  const miniAppId = import.meta.env.VITE_ZALO_MINI_APP_ID;
  return {
    ...(miniAppId === undefined ? {} : { miniAppId }),
    browserDevelopmentEnabled: isBrowserDevelopmentEnabled(
      import.meta.env.DEV,
      import.meta.env.VITE_ZALO_BROWSER_DEVELOPMENT,
    ),
  };
}
