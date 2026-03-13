import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { authenticateAuth0Request, extractBearerToken } from "./auth0";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const hasBearerToken = Boolean(extractBearerToken(opts.req));

    if (hasBearerToken) {
      // Auth0 mode (Railway production): verify RS256 JWT from Authorization header
      user = await authenticateAuth0Request(opts.req);
    } else {
      // Manus dev preview mode: fall back to session-cookie authentication
      const { sdk } = await import("./sdk");
      const sdkUser = await sdk.authenticateRequest(opts.req);
      if (sdkUser) {
        const { getUserByOpenId, upsertUser } = await import("../db");
        await upsertUser({
          openId: sdkUser.openId,
          name: sdkUser.name ?? null,
          email: sdkUser.email ?? null,
          loginMethod: "manus",
          lastSignedIn: new Date(),
        });
        user = (await getUserByOpenId(sdkUser.openId)) ?? null;
      }
    }
  } catch {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
