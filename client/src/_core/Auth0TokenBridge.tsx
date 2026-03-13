/**
 * Auth0TokenBridge
 *
 * A tiny invisible component that must be rendered inside Auth0Provider.
 * It registers the `getAccessTokenSilently` function into the auth0Client
 * singleton so that the tRPC fetch interceptor (outside React) can retrieve
 * tokens without needing React context.
 *
 * IMPORTANT: getAccessTokenSilently MUST be called with the audience parameter
 * to receive a JWT access token (not an opaque token). Without the audience,
 * Auth0 returns an opaque token that the server's JWKS RS256 verifier rejects.
 */
import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { setAuth0Client } from "./auth0Client";

const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined;

export function Auth0TokenBridge() {
  const { getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    // Wrap getAccessTokenSilently to always include the audience.
    // IMPORTANT: Only pass audience when it is a non-empty string.
    // Passing `audience: undefined` explicitly causes Auth0 to return an
    // opaque token (not a JWT), which the server's JWKS RS256 verifier rejects.
    const getTokenWithAudience = () => {
      const authorizationParams: {
        scope: string;
        audience?: string;
      } = { scope: "openid profile email" };
      if (AUTH0_AUDIENCE) {
        authorizationParams.audience = AUTH0_AUDIENCE;
      }
      return getAccessTokenSilently({ authorizationParams });
    };

    setAuth0Client({ getTokenSilently: getTokenWithAudience });
  }, [getAccessTokenSilently]);

  return null;
}
