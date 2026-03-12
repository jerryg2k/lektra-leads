/**
 * Auth0TokenBridge
 *
 * A tiny invisible component that must be rendered inside Auth0Provider.
 * It registers the `getAccessTokenSilently` function into the auth0Client
 * singleton so that the tRPC fetch interceptor (outside React) can retrieve
 * tokens without needing React context.
 */
import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { setAuth0Client } from "./auth0Client";

export function Auth0TokenBridge() {
  const { getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    setAuth0Client({ getTokenSilently: getAccessTokenSilently });
  }, [getAccessTokenSilently]);

  return null;
}
