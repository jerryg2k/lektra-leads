/**
 * Auth0Callback
 *
 * Handles the redirect from Auth0 Universal Login.
 * Calls handleRedirectCallback() directly to complete the PKCE code exchange,
 * then navigates to the dashboard (or the original page if appState.returnTo is set).
 */
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

export default function Auth0Callback() {
  const { handleRedirectCallback, error: auth0Error } = useAuth0();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      window.location.replace("/");
      return;
    }

    handleRedirectCallback()
      .then((result) => {
        const returnTo = result?.appState?.returnTo ?? "/";
        window.location.replace(returnTo);
      })
      .catch((err) => {
        console.error("[Auth0Callback] handleRedirectCallback failed:", err);
        setError(err?.message ?? "Authentication failed. Please try again.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error || auth0Error) {
    const msg = error ?? auth0Error?.message ?? "Unknown error";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4 max-w-md px-4">
          <h1 className="text-2xl font-bold text-destructive">Login Failed</h1>
          <p className="text-muted-foreground text-sm font-mono break-all">{msg}</p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">Completing sign-in…</p>
      </div>
    </div>
  );
}
