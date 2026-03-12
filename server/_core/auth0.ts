/**
 * Auth0 JWT verification for self-hosted Railway deployment.
 *
 * Replaces the Manus OAuth session-cookie flow with Auth0 RS256 JWT verification.
 * The frontend sends `Authorization: Bearer <access_token>` on every tRPC request.
 * This module verifies the token against Auth0's JWKS endpoint and returns the
 * Auth0 `sub` claim (e.g. "google-oauth2|123456") used as the user's openId.
 *
 * Required environment variables:
 *   AUTH0_DOMAIN   — e.g. "lektra.auth0.com"
 *   AUTH0_AUDIENCE — e.g. "https://api.lektra.com"
 */

import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Request } from "express";
import * as db from "../db";
import { ENV } from "./env";

// Lazily initialised JWKS fetcher — cached by jose automatically.
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!_jwks) {
    if (!ENV.auth0Domain) {
      throw new Error(
        "[Auth0] AUTH0_DOMAIN is not set. Add it to your environment variables."
      );
    }
    _jwks = createRemoteJWKSet(
      new URL(`https://${ENV.auth0Domain}/.well-known/jwks.json`)
    );
  }
  return _jwks;
}

/**
 * Extract the Bearer token from the Authorization header.
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

/**
 * Verify an Auth0 access token and return the decoded payload.
 * Throws if the token is invalid or expired.
 */
export async function verifyAuth0Token(token: string) {
  const jwks = getJwks();

  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://${ENV.auth0Domain}/`,
    audience: ENV.auth0Audience || undefined,
    algorithms: ["RS256"],
  });

  return payload;
}

/**
 * Authenticate an incoming Express request using Auth0 Bearer JWT.
 * Returns the local DB User record (creating it on first sign-in).
 * Throws a ForbiddenError if authentication fails.
 */
export async function authenticateAuth0Request(req: Request) {
  const { ForbiddenError } = await import("@shared/_core/errors");

  const token = extractBearerToken(req);
  if (!token) {
    throw ForbiddenError("Missing Authorization Bearer token");
  }

  let payload: Awaited<ReturnType<typeof verifyAuth0Token>>;
  try {
    payload = await verifyAuth0Token(token);
  } catch (err) {
    throw ForbiddenError(`Invalid or expired Auth0 token: ${String(err)}`);
  }

  // Auth0 `sub` is the stable unique identifier, e.g. "google-oauth2|123456"
  const sub = payload.sub;
  if (!sub) {
    throw ForbiddenError("Auth0 token missing `sub` claim");
  }

  // Derive human-readable fields from standard OIDC claims
  const email =
    typeof payload.email === "string" ? payload.email : null;
  const name =
    typeof payload.name === "string"
      ? payload.name
      : typeof payload.nickname === "string"
        ? payload.nickname
        : null;

  // Derive login method from the `sub` prefix (e.g. "google-oauth2", "auth0", "github")
  const loginMethod = sub.includes("|") ? sub.split("|")[0] : "auth0";

  const now = new Date();

  // Upsert the user — creates on first login, updates lastSignedIn on subsequent logins.
  await db.upsertUser({
    openId: sub,
    name,
    email,
    loginMethod,
    lastSignedIn: now,
  });

  const user = await db.getUserByOpenId(sub);
  if (!user) {
    throw ForbiddenError("Failed to retrieve user after upsert");
  }

  return user;
}
