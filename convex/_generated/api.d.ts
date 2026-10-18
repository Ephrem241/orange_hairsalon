/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appointments from "../appointments.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as booking from "../booking.js";
import type * as catalog from "../catalog.js";
import type * as content from "../content.js";
import type * as crons from "../crons.js";
import type * as customers from "../customers.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_availability from "../lib/availability.js";
import type * as lib_engine from "../lib/engine.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_media from "../lib/media.js";
import type * as lib_records from "../lib/records.js";
import type * as lib_schedule from "../lib/schedule.js";
import type * as lib_slugs from "../lib/slugs.js";
import type * as lib_time from "../lib/time.js";
import type * as lib_validate from "../lib/validate.js";
import type * as lib_validators from "../lib/validators.js";
import type * as media from "../media.js";
import type * as notifications from "../notifications.js";
import type * as public_ from "../public.js";
import type * as rateLimit from "../rateLimit.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as staff from "../staff.js";
import type * as stylists from "../stylists.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  appointments: typeof appointments;
  audit: typeof audit;
  auth: typeof auth;
  booking: typeof booking;
  catalog: typeof catalog;
  content: typeof content;
  crons: typeof crons;
  customers: typeof customers;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/availability": typeof lib_availability;
  "lib/engine": typeof lib_engine;
  "lib/errors": typeof lib_errors;
  "lib/media": typeof lib_media;
  "lib/records": typeof lib_records;
  "lib/schedule": typeof lib_schedule;
  "lib/slugs": typeof lib_slugs;
  "lib/time": typeof lib_time;
  "lib/validate": typeof lib_validate;
  "lib/validators": typeof lib_validators;
  media: typeof media;
  notifications: typeof notifications;
  public: typeof public_;
  rateLimit: typeof rateLimit;
  seed: typeof seed;
  settings: typeof settings;
  staff: typeof staff;
  stylists: typeof stylists;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
