import APIRequest from "./APIRequest.ts";
import routeBuilder from "./APIRouter.ts";
import { CaptchaSolver } from "./CaptchaSolver.ts";
import { RequestHandler } from "./RequestHandler.ts";
import { Collection } from "../util/Collection.ts";
import { Endpoints } from "../util/Constants.ts";

import type Client from "../client/Client.ts";

export class RESTManager {
  client: Client;
  handlers: Collection<string, RequestHandler>;
  versioned: boolean;
  globalLimit: number;
  globalRemaining: number;
  globalReset: number | null;
  globalDelay: number | Promise<number> | null;
  sweepInterval: number | null;
  captchaService: CaptchaSolver | null;

  constructor(client: Client) {
    this.client = client;
    this.handlers = new Collection();
    this.versioned = true;
    this.globalLimit = client.options.restGlobalRateLimit > 0
      ? client.options.restGlobalRateLimit
      : Infinity;
    this.globalRemaining = this.globalLimit;
    this.globalReset = null;
    this.globalDelay = null;
    this.sweepInterval = null;

    if (client.options.restSweepInterval > 0) {
      this.sweepInterval = setInterval(() => {
        this.handlers.sweep((handler) => handler._inactive);
      }, client.options.restSweepInterval * 1_000);
    }

    this.captchaService = null;
    this.setup();
  }

  setup() {
    this.captchaService = new CaptchaSolver(
      this.client.options.captchaService,
      this.client.options.captchaKey,
      this.client.options.captchaSolver,
    );
  }

  get api() {
    return routeBuilder(this);
  }

  getAuth() {
    if (
      (this.client.token && this.client.user && this.client.user.bot) ||
      this.client.accessToken
    ) {
      return `Bot ${this.client.token}`;
    } else if (this.client.token) return this.client.token;

    throw new Error("TOKEN_MISSING");
  }

  get cdn() {
    return Endpoints.CDN(this.client.options.http.cdn);
  }

  request(
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    url: string,
    options = {},
  ) {
    const apiRequest = new APIRequest(this, method, url, options);
    let handler = this.handlers.get(apiRequest.route);

    if (!handler) {
      handler = new RequestHandler(this);
      this.handlers.set(apiRequest.route, handler);
    }

    return handler.push(apiRequest);
  }

  get endpoint() {
    return this.client.options.http.api;
  }

  set endpoint(endpoint) {
    this.client.options.http.api = endpoint;
  }
}
