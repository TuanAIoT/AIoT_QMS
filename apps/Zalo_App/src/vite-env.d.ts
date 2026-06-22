/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ZALO_MINI_APP_ID?: string;
  readonly VITE_ZALO_BROWSER_DEVELOPMENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
