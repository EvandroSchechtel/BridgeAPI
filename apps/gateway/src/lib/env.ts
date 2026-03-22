/**
 * Hono Environment Type — defines context variables available to all routes.
 */

import type { ClientContext } from "./types.js";

export type AppEnv = {
  Variables: {
    client: ClientContext;
    requestId: string;
    startTime: number;
  };
};
