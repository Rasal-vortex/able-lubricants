/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly API_BASE_URL: string;
  readonly DEV_LOGIN_CREDENTIALS: {
    ADMIN: { email: string; password: string };
    STAFF: { email: string; password: string };
  } | null;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
