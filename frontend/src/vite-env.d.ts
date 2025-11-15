/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SMART_CONTRACT: string;
  readonly VITE_LIQ_MANAGER_CONTRACT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}