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
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_validators from "../lib/validators.js";
import type * as messages from "../messages.js";
import type * as router from "../router.js";
import type * as streamingHttp from "../streamingHttp.js";
import type * as threads from "../threads.js";
import type * as users from "../users.js";
import type * as webhooks from "../webhooks.js";
import type * as workflows from "../workflows.js";

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
  auth: typeof auth;
  crons: typeof crons;
  http: typeof http;
  "lib/email": typeof lib_email;
  "lib/validators": typeof lib_validators;
  messages: typeof messages;
  router: typeof router;
  streamingHttp: typeof streamingHttp;
  threads: typeof threads;
  users: typeof users;
  webhooks: typeof webhooks;
  workflows: typeof workflows;
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
