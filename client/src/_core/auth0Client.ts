/**
 * Auth0 client singleton.
 *
 * The Auth0Provider initialises the client and stores it here so that the
 * tRPC fetch interceptor in main.tsx can call getTokenSilently() without
 * needing access to React context.
 *
 * Usage:
 *   import { setAuth0Client, getAuth0Client } from "./_core/auth0Client";
 *
 *   // In a component inside Auth0Provider:
 *   const { getAccessTokenSilently } = useAuth0();
 *   useEffect(() => { setAuth0Client({ getTokenSilently: getAccessTokenSilently }); }, []);
 *
 *   // In the tRPC fetch interceptor (outside React):
 *   const client = getAuth0Client();
 *   const token = await client?.getTokenSilently();
 */

type Auth0ClientLike = {
  getTokenSilently: () => Promise<string>;
};

let _client: Auth0ClientLike | null = null;

export function setAuth0Client(client: Auth0ClientLike) {
  _client = client;
}

export function getAuth0Client(): Auth0ClientLike | null {
  return _client;
}
