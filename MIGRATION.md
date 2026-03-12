# Lektra Cloud Lead Intelligence — Railway Migration Guide

This guide covers everything required to move the app from Manus hosting to Railway with a custom `lektra.com` domain and Auth0 multi-user authentication. Estimated time: **2–3 hours** for a first-time deployment.

---

## Overview

The migration has five stages:

| Stage | What happens | Time |
|---|---|---|
| 1. Export code to GitHub | Push the project to your GitHub account | 5 min |
| 2. Provision Railway services | Create the Node.js app + MySQL database on Railway | 15 min |
| 3. Configure environment variables | Wire all secrets into Railway | 20 min |
| 4. Set up Auth0 | Replace Manus OAuth with Auth0 multi-user login | 30 min |
| 5. Connect Lektra.com domain | Point DNS to Railway | 15 min |

---

## Prerequisites

- Railway account connected to GitHub (already done)
- Auth0 account — free tier at [auth0.com](https://auth0.com) (7,500 active users free)
- Access to the Lektra.com DNS settings (your domain registrar)
- AWS account or Cloudflare account for S3 file storage (card scan images)
- OpenAI API key for AI features (lead enrichment, email drafts, card OCR)

---

## Stage 1 — Export Code to GitHub

1. In the Manus Management UI, open **Settings → GitHub**.
2. Click **Export to GitHub** and choose a repository name (e.g. `lektra-leads`). Set it to **Private**.
3. Once exported, confirm the repo appears at `github.com/your-org/lektra-leads`.

> The exported repo will contain all source files including `railway.toml` and this `MIGRATION.md`.

---

## Stage 2 — Provision Railway Services

### 2a. Create a new Railway project

1. Go to [railway.app](https://railway.app) and click **New Project**.
2. Select **Deploy from GitHub repo** and choose `lektra-leads`.
3. Railway will detect the `railway.toml` and begin a build automatically. Let it run — it will fail on first deploy because the environment variables are not yet set. That is expected.

### 2b. Add a MySQL database

1. Inside your Railway project, click **+ New Service → Database → MySQL**.
2. Railway provisions a managed MySQL 8 instance. Click on it and go to the **Variables** tab.
3. Copy the `DATABASE_URL` connection string — you will need it in Stage 3.

### 2c. Run database migrations

Once the app is deployed and env vars are set (after Stage 3), open the Railway service shell:

```bash
# In Railway → your app service → Shell tab
pnpm db:push
```

This runs Drizzle migrations against the new Railway MySQL database, creating all tables.

---

## Stage 3 — Configure Environment Variables

In Railway, go to your **app service → Variables** tab and add the following. Do **not** commit these to Git.

### Required variables

| Variable | Value | Where to get it |
|---|---|---|
| `NODE_ENV` | `production` | Set literally |
| `DATABASE_URL` | `mysql://...` | Copied from Railway MySQL service (Stage 2b) |
| `JWT_SECRET` | Random 64-char string | Run: `openssl rand -hex 32` |
| `PORT` | `3000` | Set literally (Railway also injects this automatically) |

### Auth0 variables (set up in Stage 4, add here)

| Variable | Value | Where to get it |
|---|---|---|
| `AUTH0_DOMAIN` | `your-tenant.auth0.com` | Auth0 Dashboard → Application settings |
| `AUTH0_AUDIENCE` | `https://api.lektra.com` | Auth0 Dashboard → API settings |
| `VITE_AUTH0_DOMAIN` | Same as `AUTH0_DOMAIN` | Same |
| `VITE_AUTH0_CLIENT_ID` | Your Auth0 SPA client ID | Auth0 Dashboard → Application settings |
| `VITE_AUTH0_AUDIENCE` | Same as `AUTH0_AUDIENCE` | Same |

### File storage (AWS S3 or Cloudflare R2)

| Variable | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | Your AWS/R2 access key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS/R2 secret key |
| `AWS_REGION` | e.g. `us-east-1` (or `auto` for R2) |
| `AWS_S3_BUCKET` | Your bucket name |
| `AWS_S3_ENDPOINT` | Only needed for R2: `https://<account>.r2.cloudflarestorage.com` |

### AI features (OpenAI)

| Variable | Value |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI API key from [platform.openai.com](https://platform.openai.com) |

### Email digest (Resend — recommended)

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | Your Resend API key from [resend.com](https://resend.com) |
| `DIGEST_FROM_EMAIL` | e.g. `digest@lektra.com` |
| `OWNER_EMAIL` | The email address to receive weekly digests |

---

## Stage 4 — Set Up Auth0

Auth0 replaces the Manus OAuth system. The code changes required are minimal — only the auth layer files need updating.

### 4a. Create an Auth0 Application

1. Log in to [manage.auth0.com](https://manage.auth0.com).
2. Go to **Applications → Create Application**.
3. Name it `Lektra Cloud` and select **Single Page Application**.
4. In the application settings, configure:
   - **Allowed Callback URLs**: `https://app.lektra.com, http://localhost:3000`
   - **Allowed Logout URLs**: `https://app.lektra.com, http://localhost:3000`
   - **Allowed Web Origins**: `https://app.lektra.com, http://localhost:3000`
5. Copy the **Domain** and **Client ID** — add them to Railway env vars (Stage 3).

### 4b. Create an Auth0 API

1. Go to **Applications → APIs → Create API**.
2. Name: `Lektra API`, Identifier: `https://api.lektra.com`.
3. Copy the identifier — this becomes `AUTH0_AUDIENCE` in Railway.

### 4c. Enable social connections (optional)

In Auth0 → **Authentication → Social**, enable Google, GitHub, or LinkedIn login. No code changes required — Auth0 handles the OAuth flows.

### 4d. Code changes required

The following four files need to be updated to use Auth0 instead of Manus OAuth. These changes can be made in the exported GitHub repo before deploying:

**`server/_core/env.ts`** — add Auth0 variables:
```ts
export const ENV = {
  // ... existing fields ...
  auth0Domain: process.env.AUTH0_DOMAIN ?? "",
  auth0Audience: process.env.AUTH0_AUDIENCE ?? "",
  // Remove: oAuthServerUrl, appId (Manus-specific)
};
```

**`server/_core/context.ts`** — replace Manus JWT verification with Auth0 JWKS verification using `jose`:
```ts
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(
  new URL(`https://${ENV.auth0Domain}/.well-known/jwks.json`)
);

export async function createContext({ req }: { req: Request }) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return { user: null };
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      audience: ENV.auth0Audience,
    });
    // Upsert user in DB on first login
    const user = await upsertUserFromAuth0(payload);
    return { user };
  } catch {
    return { user: null };
  }
}
```

**`client/src/main.tsx`** — wrap the app with `Auth0Provider`:
```tsx
import { Auth0Provider } from "@auth0/auth0-react";

<Auth0Provider
  domain={import.meta.env.VITE_AUTH0_DOMAIN}
  clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
  authorizationParams={{
    redirect_uri: window.location.origin,
    audience: import.meta.env.VITE_AUTH0_AUDIENCE,
  }}
>
  <App />
</Auth0Provider>
```

**`client/src/hooks/useAuth.ts`** — replace `useAuth` with a wrapper around `useAuth0`:
```ts
import { useAuth0 } from "@auth0/auth0-react";

export function useAuth() {
  const { user, isAuthenticated, isLoading, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();
  return {
    user: isAuthenticated ? { name: user?.name, email: user?.email, openId: user?.sub } : null,
    isLoading,
    login: () => loginWithRedirect(),
    logout: () => logout({ logoutParams: { returnTo: window.location.origin } }),
    getToken: getAccessTokenSilently,
  };
}
```

Install the Auth0 React SDK:
```bash
pnpm add @auth0/auth0-react
```

> **Note:** The tRPC client also needs to attach the Auth0 access token as a `Bearer` header. Update `client/src/lib/trpc.ts` to call `getAccessTokenSilently()` and include it in the `Authorization` header on each request.

---

## Stage 5 — Connect Lektra.com Domain

### 5a. Get the Railway domain

In Railway → your app service → **Settings → Networking**, click **Generate Domain** to get a Railway-assigned domain (e.g. `lektra-leads-production.up.railway.app`).

### 5b. Add a custom domain

1. In the same **Networking** section, click **Custom Domain** and enter `app.lektra.com`.
2. Railway will show you a **CNAME record** to add.

### 5c. Update your DNS

In your domain registrar (wherever Lektra.com is registered), add:

| Type | Name | Value |
|---|---|---|
| `CNAME` | `app` | `lektra-leads-production.up.railway.app` |

DNS propagation takes 5–30 minutes. Railway provisions an SSL certificate automatically via Let's Encrypt.

### 5d. Update Auth0 callback URLs

Once `app.lektra.com` is live, go back to Auth0 → your application settings and confirm `https://app.lektra.com` is in all callback/logout/origin URL lists.

---

## Post-Migration Checklist

- [ ] `pnpm db:push` run against Railway MySQL (all tables created)
- [ ] `/api/health` returns `{"status":"ok"}`
- [ ] Auth0 login redirects correctly and creates a user record in the DB
- [ ] Business card upload works (S3/R2 credentials correct)
- [ ] AI lead enrichment works (OpenAI key correct)
- [ ] Weekly digest cron fires (check Railway logs on Monday 07:00 UTC)
- [ ] `app.lektra.com` resolves with valid SSL certificate
- [ ] Old Manus URL redirects or is decommissioned

---

## Estimated Monthly Costs at Launch

| Service | Cost |
|---|---|
| Railway (app + MySQL) | ~$5–10/month |
| Auth0 (up to 7,500 users) | Free |
| Cloudflare R2 (file storage) | Free (up to 10GB) |
| Resend (email digest) | Free (up to 3,000 emails/month) |
| OpenAI API (AI features) | ~$1–5/month at current scale |
| **Total** | **~$6–15/month** |

---

## Support

For Railway-specific issues: [docs.railway.app](https://docs.railway.app)  
For Auth0 issues: [auth0.com/docs](https://auth0.com/docs)  
For Drizzle ORM migrations: [orm.drizzle.team/docs](https://orm.drizzle.team/docs/migrations)
