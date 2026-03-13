/**
 * Auth0 client singleton.
 *
 * The Auth0Provider initialises the client and stores it here so that the
 * tRPC fetch interceptor in main.tsx can call getTokenSilently() without
 * needing access to React context.
 *
 * waitForToken() blocks until the bridge is registered (max 10s) so that
 * the first batch of tRPC queries never fires without a Bearer token.
 */

type Auth0ClientLike = {
  getTokenSilently: () => Promise<string>;
};

let _client: Auth0ClientLike | null = null;
let _resolvers: Array<(client: Auth0ClientLike) => void> = [];

export function setAuth0Client(client: Auth0ClientLike) {
  _client = client;
  // Resolve all pending waiters
  _resolvers.forEach((resolve) => resolve(client));
  _resolvers = [];
}

export function getAuth0Client(): Auth0ClientLike | null {
  return _client;
}

/**
 * Returns a promise that resolves with the Auth0 client once the bridge
 * has been registered. Rejects after `timeoutMs` milliseconds.
 */
export function waitForAuth0Client(timeoutMs = 10_000): Promise<Auth0ClientLike> {
  if (_client) return Promise.resolve(_client);
  return new Promise<Auth0ClientLike>((resolve, reject) => {
    const timer = setTimeout(() => {
      _resolvers = _resolvers.filter((r) => r !== resolve);
      reject(new Error("[Auth0] Token bridge not ready within timeout"));
    }, timeoutMs);
    _resolvers.push((client) => {
      clearTimeout(timer);
      resolve(client);
    });
  });
}
