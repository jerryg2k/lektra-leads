/**
 * OAuth route registration — Auth0 migration stub.
 *
 * The original Manus OAuth callback (/api/oauth/callback) is no longer used.
 * Authentication is now handled entirely by Auth0 on the frontend (PKCE flow)
 * and verified server-side via JWKS JWT validation in server/_core/auth0.ts.
 *
 * This file is kept as a stub so that existing imports in server/_core/index.ts
 * continue to compile without changes. The registered route returns 410 Gone
 * to clearly signal that the old Manus OAuth endpoint is retired.
 */
import type { Express } from "express";

export function registerOAuthRoutes(app: Express) {
  // Legacy Manus OAuth callback — no longer active.
  // Auth0 handles authentication via the frontend PKCE flow.
  app.get("/api/oauth/callback", (_req, res) => {
    res.status(410).json({
      error: "This OAuth endpoint has been retired.",
      message:
        "Authentication is now handled by Auth0. Please use the app login flow.",
    });
  });
}
