/**
 * Auth0Callback
 *
 * Auth0Provider automatically calls handleRedirectCallback() when it detects
 * a ?code= param in the URL. However, the Auth0 SDK's internal cleanup relies
 * on the `unload` event which Chrome blocks via Permissions-Policy, meaning
 * onRedirectCallback in main.tsx may never fire.
 *
 * This component handles navigation itself: once isLoading resolves and
 * isAuthenticated is true, it redirects to "/". The guard on
 * window.location.pathname ensures this effect only fires on the actual
 * /callback page and never causes a reload loop on other pages.
 */
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";

export default function Auth0Callback() {
  const { error, isLoading, isAuthenticated } = useAuth0();

  useEffect(() => {
    // Only act when we are actually on the /callback route
    if (window.location.pathname !== "/callback") return;
    // Wait for Auth0 to finish processing the code exchange
    if (isLoading) return;
    // If authenticated, navigate to the dashboard
    if (isAuthenticated) {
      window.location.replace("/");
      return;
    }
    // If not authenticated and not loading and no error, give Auth0 a 3s
    // grace period before giving up and redirecting home
    if (!error) {
      const timer = setTimeout(() => {
        if (window.location.pathname === "/callback") {
          window.location.replace("/");
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, error]);

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
