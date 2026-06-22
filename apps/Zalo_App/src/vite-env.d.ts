/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ZALO_MINI_APP_ID?: string;
  readonly VITE_ZALO_BROWSER_DEVELOPMENT?: string;
  readonly VITE_CENTRAL_API_BASE_URL?: string;
  readonly VITE_CENTRAL_AUTH_MODE?: string;
  readonly VITE_MOCK_ZALO_ACCESS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
