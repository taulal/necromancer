interface ImportMetaEnv {
  readonly SANITY_APP_PROJECT_ID?: string
  readonly SANITY_APP_HQ_DATASET?: string
  readonly SANITY_APP_VESSEL_URL?: string
  /** Low-privilege kick passphrase (mirrors Vessel DRAIN_KICK). Not a write token. */
  readonly SANITY_APP_DRAIN_KICK?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
