import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { Auth0Provider } from "@auth0/auth0-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { Auth0TokenBridge } from "./_core/Auth0TokenBridge";
import { getLoginUrl } from "./const";
import "./index.css";

// Service worker disabled — was causing stale cache issues with Auth0 login flow

// ─── Auth0 configuration ──────────────────────────────────────────────────────
const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined;
const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined;
const IS_AUTH0 = Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID);

// ─── tRPC + React Query setup ─────────────────────────────────────────────────
const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;
  if (error.message === UNAUTHED_ERR_MSG) {
    window.location.href = getLoginUrl();
  }
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(event.query.state.error);
    console.error("[API Query Error]", event.query.state.error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(event.mutation.state.error);
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

/**
 * Retrieve the Auth0 access token for the current user.
 * Returns null when Auth0 is not configured (Manus dev environment).
 */
async function getAuth0AccessToken(): Promise<string | null> {
  if (!IS_AUTH0) return null;
  try {
    const { waitForAuth0Client } = await import("./_core/auth0Client");
    // Wait up to 10s for the Auth0TokenBridge to register getTokenSilently.
    // This prevents the first batch of tRPC queries from firing without a token.
    const client = await waitForAuth0Client(10_000);
    const token = await client.getTokenSilently();
    if (!token) {
      console.warn("[Auth0] getTokenSilently returned empty token");
    }
    return token;
  } catch (err) {
    // Log the real error so it appears in browser DevTools console
    console.error("[Auth0] getTokenSilently failed:", err);
    return null;
  }
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async fetch(input, init) {
        const headers: Record<string, string> = {};

        if (IS_AUTH0) {
          // Inject Bearer token for Auth0-authenticated requests
          const token = await getAuth0AccessToken();
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }
        }

        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: IS_AUTH0 ? "omit" : "include",
          headers: {
            ...(init?.headers as Record<string, string> | undefined),
            ...headers,
          },
        });
      },
    }),
  ],
});

// ─── Root rendering ───────────────────────────────────────────────────────────

function renderApp() {
  const root = createRoot(document.getElementById("root")!);

  const AppTree = (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  );

  if (IS_AUTH0) {
    // Auth0Provider is statically imported so it is present when the /callback
    // page loads and Auth0 can complete the PKCE code exchange immediately.
    root.render(
      <Auth0Provider
        domain={AUTH0_DOMAIN!}
        clientId={AUTH0_CLIENT_ID!}
        authorizationParams={{
          redirect_uri: `${window.location.origin}/callback`,
          audience: AUTH0_AUDIENCE,
          scope: "openid profile email",
        }}
        onRedirectCallback={(appState) => {
          // Use history.pushState + popstate dispatch so wouter re-renders
          // after the URL changes. window.location.replace causes a full reload
          // which re-initializes Auth0Provider and triggers an infinite loop.
          const returnTo = appState?.returnTo ?? "/";
          window.history.pushState({}, document.title, returnTo);
          // Notify wouter (and any other history listeners) of the URL change
          window.dispatchEvent(new PopStateEvent("popstate"));
        }}
        cacheLocation="localstorage"
        useRefreshTokens={false}
      >
        <Auth0TokenBridge />
        {AppTree}
      </Auth0Provider>
    );
  } else {
    root.render(AppTree);
  }
}

renderApp();
