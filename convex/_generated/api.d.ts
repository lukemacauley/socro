/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as attachments from "../attachments.js";
import type * as demo from "../demo.js";
import type * as http from "../http.js";
import type * as lib_utils from "../lib/utils.js";
import type * as lib_validators from "../lib/validators.js";
import type * as messages from "../messages.js";
import type * as organisations from "../organisations.js";
import type * as router from "../router.js";
import type * as seedUserStats from "../seedUserStats.js";
import type * as streamingHttp from "../streamingHttp.js";
import type * as threads from "../threads.js";
import type * as users from "../users.js";
import type * as workflows from "../workflows.js";
import type * as workos from "../workos.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  attachments: typeof attachments;
  demo: typeof demo;
  http: typeof http;
  "lib/utils": typeof lib_utils;
  "lib/validators": typeof lib_validators;
  messages: typeof messages;
  organisations: typeof organisations;
  router: typeof router;
  seedUserStats: typeof seedUserStats;
  streamingHttp: typeof streamingHttp;
  threads: typeof threads;
  users: typeof users;
  workflows: typeof workflows;
  workos: typeof workos;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
