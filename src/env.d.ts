interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly PUBLIC_VERSION: string;
  readonly PUBLIC_NAME: string;
}