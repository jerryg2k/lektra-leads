/**
 * Auth0Callback
 *
 * Auth0Provider automatically calls handleRedirectCallback() when it detects
 * a ?code= param in the URL. onRedirectCallback in main.tsx handles navigation
 * via window.location.replace. This component shows a spinner while that
 * completes, and falls back to a manual redirect if isLoading resolves without
 * a navigation (safety net for edge cases).
 */
import { useAuth0 } from "@auth0/auth0-react";

export default function Auth0Callback() {
  const { error } = useAuth0();
  // onRedirectCallback in main.tsx handles navigation via window.location.replace.
  // No safety-net redirect here — it caused reload loops when isAuthenticated
  // briefly became true during the normal dashboard load cycle.

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4 max-w-md px-4">
          <h1 className="text-2xl font-bold text-destructive">Login Failed</h1>
          <p className="text-muted-foreground text-sm font-mono break-all">{error.message}</p>
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
