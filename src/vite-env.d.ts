/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The multiplayer server's address (see server/ and README). Unset: no multiplayer in this build. */
  readonly VITE_MULTIPLAYER_URL?: string;
}
