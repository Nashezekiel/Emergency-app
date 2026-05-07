import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { incidentsRouter } from "./routes/incidents";
import { authRouter } from "./routes/auth";


export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: authRouter,
  incidents: incidentsRouter,
});

export type AppRouter = typeof appRouter;
