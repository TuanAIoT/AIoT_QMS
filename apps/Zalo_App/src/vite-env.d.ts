/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ZALO_MINI_APP_ID?: string;
  readonly VITE_ZALO_BROWSER_DEVELOPMENT?: string;
  readonly VITE_QMS_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
