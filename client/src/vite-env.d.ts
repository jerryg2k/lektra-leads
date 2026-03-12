/// <reference types="vite/client" />

interface ImportMetaEnv {
  // ─── Manus platform (dev environment) ────────────────────────────────────────
  readonly VITE_APP_ID: string;
  readonly VITE_OAUTH_PORTAL_URL: string;
  readonly VITE_FRONTEND_FORGE_API_KEY: string;
  readonly VITE_FRONTEND_FORGE_API_URL: string;
  readonly VITE_ANALYTICS_ENDPOINT: string;
  readonly VITE_ANALYTICS_WEBSITE_ID: string;

  // ─── Auth0 (production / Railway deployment) ──────────────────────────────────
  /** Auth0 tenant domain, e.g. "lektra.auth0.com" */
  readonly VITE_AUTH0_DOMAIN: string | undefined;
  /** Auth0 SPA client ID */
  readonly VITE_AUTH0_CLIENT_ID: string | undefined;
  /** Auth0 API audience, e.g. "https://api.lektra.com" */
  readonly VITE_AUTH0_AUDIENCE: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
