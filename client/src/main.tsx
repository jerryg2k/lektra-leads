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

// Register service worker for GTC 2026 offline support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW registration failure is non-fatal
    });
  });
}

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
    const { getAuth0Client } = await import("./_core/auth0Client");
    const client = getAuth0Client();
    if (!client) return null;
    return await client.getTokenSilently();
  } catch {
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
          // After Auth0 redirects back, navigate to the original page
          window.location.replace(appState?.returnTo ?? "/");
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
