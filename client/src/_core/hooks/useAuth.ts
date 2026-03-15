/**
 * useAuth — unified authentication hook.
 *
 * In production (Railway + Auth0), delegates to the @auth0/auth0-react SDK.
 * In the Manus dev environment (no VITE_AUTH0_DOMAIN set), falls back to the
 * legacy trpc.auth.me query so the Manus preview keeps working unchanged.
 */
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useAuth0 as _useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useMemo } from "react";

// Detect whether Auth0 is configured
const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
const IS_AUTH0 = Boolean(AUTH0_DOMAIN);

// ─── Auth0 path ───────────────────────────────────────────────────────────────

function useAuth0Mode(options?: UseAuthOptions) {
  const {
    user: auth0User,
    isLoading,
    isAuthenticated,
    loginWithRedirect,
    logout: auth0Logout,
  } = _useAuth0();

  const { redirectOnUnauthenticated = false } = options ?? {};

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (isLoading) return;
    if (isAuthenticated) return;
    loginWithRedirect({
      appState: { returnTo: window.location.pathname },
    });
  }, [redirectOnUnauthenticated, isLoading, isAuthenticated, loginWithRedirect]);

  const logout = useCallback(async () => {
    auth0Logout({ logoutParams: { returnTo: window.location.origin } });
  }, [auth0Logout]);

  const user = useMemo(() => {
    if (!auth0User) return null;
    return {
      id: 0,                                   // placeholder — real id from DB via trpc.auth.me
      openId: auth0User.sub ?? "",
      name: auth0User.name ?? auth0User.nickname ?? null,
      email: auth0User.email ?? null,
      picture: auth0User.picture ?? null,      // profile photo from Google/GitHub via Auth0
      loginMethod: auth0User.sub?.split("|")[0] ?? "auth0",
      role: "user" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSignedIn: new Date().toISOString(),
    };
  }, [auth0User]);

  return {
    user,
    loading: isLoading,
    error: null,
    isAuthenticated,
    refresh: () => {},
    logout,
  };
}

// ─── Manus legacy path ────────────────────────────────────────────────────────

function useManusMode(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;
    window.location.href = redirectPath;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

/**
 * Unified auth hook — automatically selects Auth0 or Manus mode based on env.
 *
 * IS_AUTH0 is a build-time constant (Vite replaces it at compile time), so
 * only one branch of code is ever included in the bundle. Both hooks are
 * defined as separate top-level functions and called unconditionally here,
 * satisfying React's Rules of Hooks.
 */
export function useAuth(options?: UseAuthOptions) {
  // Both hooks are always called unconditionally. IS_AUTH0 is a build-time
  // constant so only one of these will ever be active in a given build.
  const auth0Result = useAuth0Mode(options);
  const manusResult = useManusMode(options);
  return IS_AUTH0 ? auth0Result : manusResult;
}
