export { ONE_YEAR_MS } from "@shared/const";

/**
 * Build the Auth0 Universal Login URL.
 *
 * In production (Railway), this redirects to Auth0 for authentication.
 * The Auth0Provider in main.tsx handles the full PKCE flow automatically,
 * so direct calls to getLoginUrl() are only used as a fallback redirect target
 * when the Auth0 SDK is not yet initialised (e.g. in error boundaries).
 *
 * Required Vite env vars:
 *   VITE_AUTH0_DOMAIN    — e.g. "lektra.auth0.com"
 *   VITE_AUTH0_CLIENT_ID — SPA client ID from Auth0 dashboard
 */
export const getLoginUrl = (returnPath?: string): string => {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

  // Fallback: if Auth0 env vars are not set (Manus dev environment),
  // use the legacy Manus OAuth portal URL so the app still works in preview.
  if (!domain || !clientId) {
    const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
    const appId = import.meta.env.VITE_APP_ID;
    if (oauthPortalUrl && appId) {
      const redirectUri = `${window.location.origin}/api/oauth/callback`;
      const state = btoa(redirectUri);
      const url = new URL(`${oauthPortalUrl}/app-auth`);
      url.searchParams.set("appId", appId);
      url.searchParams.set("redirectUri", redirectUri);
      url.searchParams.set("state", state);
      url.searchParams.set("type", "signIn");
      return url.toString();
    }
    return "/";
  }

  const redirectUri = `${window.location.origin}/callback`;
  const url = new URL(`https://${domain}/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile email");
  if (returnPath) {
    url.searchParams.set("state", btoa(returnPath));
  }
  return url.toString();
};
