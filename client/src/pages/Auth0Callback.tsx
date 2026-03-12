/**
 * Auth0Callback
 *
 * This page is the redirect target after Auth0 Universal Login completes.
 * Auth0Provider's onRedirectCallback handles the actual token exchange and
 * navigation — this component just shows a loading state while that happens.
 */
import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useLocation } from "wouter";

export default function Auth0Callback() {
  const { isLoading, error, isAuthenticated } = useAuth0();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/");
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4 max-w-md px-4">
          <h1 className="text-2xl font-bold text-destructive">Login Failed</h1>
          <p className="text-muted-foreground">{error.message}</p>
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
