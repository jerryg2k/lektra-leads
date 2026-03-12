export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Auth0 — required for self-hosted Railway deployment
  auth0Domain: process.env.AUTH0_DOMAIN ?? "",       // e.g. "lektra.auth0.com"
  auth0Audience: process.env.AUTH0_AUDIENCE ?? "",   // e.g. "https://api.lektra.com"
  auth0ClientId: process.env.AUTH0_CLIENT_ID ?? "",  // SPA client ID from Auth0 dashboard
};
