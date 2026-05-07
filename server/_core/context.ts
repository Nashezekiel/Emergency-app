import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { FirestoreUser } from "./sdk";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: FirestoreUser | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: FirestoreUser | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
