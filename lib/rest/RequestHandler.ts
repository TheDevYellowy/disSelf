import { Events, Sleep } from "../util/Constants.ts";
import { AsyncQueue } from "../util/AsyncQueue.ts";
import { getCookies } from "https://deno.land/std@0.182.0/http/cookie.ts";

import type APIRequest from "./APIRequest.ts";
import type { RESTManager } from "./RESTManager.ts";

const captchaMessage = [
  "incorrect-captcha",
  "response-already-used",
  "captcha-required",
  "invalid-input-response",
  "invalid-response",
  "You need to update your app",
];

function parseResponse(res: any) {
  if (res.headers.get("content-type")?.startsWith("application/json")) {
    return res.json();
  }
  return res.arrayBuffer();
}

function getAPIOffset(serverDate: string | number | Date): number {
  return new Date(serverDate).getTime() - Date.now();
}

function calcReset(
  reset: string,
  resetAfter: string,
  serverDate: string | number | Date,
) {
  if (resetAfter) {
    return Date.now() + Number(resetAfter) * 1_000;
  }
  return new Date(Number(reset) * 1_000).getTime() - getAPIOffset(serverDate);
}

let invalidCount = 0;
let invalidCountResetTime: number | null = null;

export class RequestHandler {
  manager: RESTManager;
  queue: AsyncQueue;
  reset: number;
  remaining: number;
  limit: number;

  constructor(manager: RESTManager) {
    this.manager = manager;
    this.queue = new AsyncQueue();
    this.reset = -1;
    this.remaining = -1;
    this.limit = -1;
  }

  async push(request: APIRequest) {
    await this.queue.wait();
    try {
      return await this.execute(request);
    } finally {
      this.queue.shift();
    }
  }

  get globalLimited() {
    return this.manager.globalRemaining <= 0 &&
      Date.now() < this.manager.globalReset!;
  }

  get localLimited() {
    return this.remaining < 0 && Date.now() < this.reset;
  }

  get limited() {
    return this.globalLimited || this.localLimited;
  }

  get _inactive() {
    return this.queue.remaining === 0 && !this.limited;
  }

  globalDelayFor(ms: number): Promise<number> {
    return new Promise((resolve) => {
      resolve(setTimeout(() => {
        this.manager.globalDelay = null;
      }, ms));
    });
  }

  async onRateLimit(
    request: APIRequest,
    limit: number,
    timeout: number,
    isGlobal: boolean,
  ) {
    const { options } = this.manager.client;
    if (!options.rejectOnRateLimit) return;

    const rateLimitData = {
      timeout,
      limit,
      method: request.method,
      path: request.path,
      route: request.route,
      global: isGlobal,
    };
    const shouldThrow = typeof options.rejectOnRateLimit === "function"
      ? await options.rejectOnRateLimit(rateLimitData)
      : options.rejectOnRateLimit.some((route: string) =>
        rateLimitData.route.startsWith(route.toLowerCase())
      );
    if (shouldThrow) {
      throw new RateLimitError(rateLimitData);
    }
  }

  async execute(
    request: APIRequest,
    captchaKey = undefined,
    captchaToken = undefined,
  ): Promise<any> {
    while (this.limited) {
      const isGlobal = this.globalLimited;
      let limit, timeout, delayPromise;

      if (isGlobal) {
        limit = this.manager.globalLimit;
        timeout = this.manager.globalReset! +
          this.manager.client.options.restTimeOffset - Date.now();
      } else {
        limit = this.limit;
        timeout = this.reset + this.manager.client.options.restTimeOffset -
          Date.now();
      }

      if (this.manager.client.listenerCount(Events.RATE_LIMIT)) {
        this.manager.client.emit(Events.RATE_LIMIT, {
          timeout,
          limit,
          method: request.method,
          path: request.path,
          route: request.route,
          global: isGlobal,
        });
      }

      if (isGlobal) {
        if (!this.manager.globalDelay) {
          this.manager.globalDelay = this.globalDelayFor(timeout);
        }
        delayPromise = this.manager.globalDelay;
      } else {
        delayPromise = Sleep(timeout);
      }

      await this.onRateLimit(request, limit, timeout, isGlobal);
      await delayPromise;
    }

    if (!this.manager.globalReset || this.manager.globalReset < Date.now()) {
      this.manager.globalReset = Date.now() + 1_000;
      this.manager.globalRemaining = this.manager.globalLimit;
    }
    this.manager.globalRemaining--;

    if (this.manager.client.listenerCount(Events.API_REQUEST)) {
      this.manager.client.emit(Events.API_REQUEST, {
        method: request.method,
        path: request.path,
        route: request.route,
        options: request.options,
        retries: request.retries,
      });
    }

    let res;
    try {
      res = await request.make(captchaKey, captchaToken);
    } catch (error) {
      if (request.retries === this.manager.client.options.retryLimit) {
        throw new HTTPError(
          error.message,
          error.constructor.name,
          error.status,
          request,
        );
      }

      request.retries--;
      return this.execute(request);
    }

    if (this.manager.client.listenerCount(Events.API_RESPONSE)) {
      this.manager.client.emit(
        Events.API_RESPONSE,
        {
          method: request.method,
          path: request.path,
          route: request.route,
          options: request.options,
          retries: request.retries,
        },
        res.clone(),
      );
    }

    let sublimitTimeout;
    if (res.headers) {
      const cookie = res.headers.get("set-cookie");
      if (cookie && Array.isArray(cookie)) {
        const oldCookie: { [key: string]: string } = {};
        (this.manager.client.options.http.headers.Cookie || "")?.split("; ")
          .forEach((arr: string) => {
            let cookie = arr.split("=");
            oldCookie[cookie[0]] = cookie[1];
          });
        const parse = getCookies(res.headers);
        for (const key in parse) {
          oldCookie[key] = parse[key];
        }
        this.manager.client.options.http.headers.Cookie = Object.entries(
          oldCookie,
        )
          .map(([key, value]) => `${key}=${value}`)
          .join("; ");

        this.manager.client.emit(
          "debug",
          `[REST] Set new cookie: ${this.manager.client.options.http.headers.Cookie}`,
        );
      }

      const serverDate = res.headers.get("date")!;
      const limit = res.headers.get("x-ratelimit-limit");
      const remaining = res.headers.get("x-ratelimit-remaining");
      const reset = res.headers.get("x-ratelimit-reset")!;
      const resetAfter = res.headers.get("x-ratelimit-reset-after")!;
      this.limit = limit ? Number(limit) : Infinity;
      this.remaining = remaining ? Number(remaining) : 1;

      this.reset = reset || resetAfter
        ? calcReset(reset, resetAfter, serverDate)
        : Date.now();

      if (!resetAfter && request.route.includes("reactions")) {
        this.reset = new Date(serverDate).getTime() - getAPIOffset(serverDate) +
          250;
      }

      let retryAfter: string | number = res.headers.get("retry-after")!;
      retryAfter = retryAfter ? Number(retryAfter) * 1_000 : -1;
      if (retryAfter > 0) {
        if (res.headers.get("x-ratelimit-global")) {
          this.manager.globalRemaining = 0;
          this.manager.globalReset = Date.now() + retryAfter;
        } else if (!this.localLimited) {
          sublimitTimeout = retryAfter;
        }
      }
    }

    if (res.status === 401 || res.status === 403 || res.status === 429) {
      if (!invalidCountResetTime || invalidCountResetTime < Date.now()) {
        invalidCountResetTime = Date.now() * 1_000 * 60 * 10;
        invalidCount = 0;
      }
      invalidCount++;

      const emitInvalid =
        this.manager.client.listenerCount(Events.INVALID_REQUEST_WARNING) &&
        this.manager.client.options.invalidRequestWarningInterval > 0 &&
        invalidCount %
              this.manager.client.options.invalidRequestWarningInterval === 0;
      if (emitInvalid) {
        this.manager.client.emit(Events.INVALID_REQUEST_WARNING, {
          count: invalidCount,
          remainingTime: invalidCountResetTime - Date.now(),
        });
      }
    }

    if (res.ok) {
      return parseResponse(res);
    }

    if (res.status >= 400 && res.status < 500) {
      if (res.status === 429) {
        const isGlobal = this.globalLimited;
        let limit, timeout;
        if (isGlobal) {
          limit = this.manager.globalLimit;
          timeout = this.manager.globalReset +
            this.manager.client.options.restTimeOffset - Date.now();
        } else {
          limit = this.limit;
          timeout = this.reset + this.manager.client.options.restTimeOffset -
            Date.now();
        }

        this.manager.client.emit(
          Events.DEBUG,
          `Hit a 429 while executing a request.
    Global  : ${isGlobal}
    Method  : ${request.method}
    Path    : ${request.path}
    Route   : ${request.route}
    Limit   : ${limit}
    Timeout : ${timeout}ms
    Sublimit: ${sublimitTimeout ? `${sublimitTimeout}ms` : "None"}`,
        );

        await this.onRateLimit(request, limit, timeout, isGlobal);

        if (sublimitTimeout) {
          await Sleep(sublimitTimeout);
        }
        return this.execute(request, captchaKey, captchaToken);
      }

      let data: {
        captcha_rqtoken: any;
        captcha_service: any;
        captcha_key: (string | string[])[];
      };
      try {
        data = await parseResponse(res);
        if (data?.captcha_service) {
          this.manager.client.emit(Events.CAPTCHA_REQUIRED, request, data);
        }

        if (
          data?.captcha_service &&
          this.manager.client.options.captchaService &&
          request.retries < this.manager.client.options.captchaRetryLimit &&
          captchaMessage.some((s) => data.captcha_key[0].includes(s))
        ) {
          this.manager.client.emit(
            Events.DEBUG,
            `Hit a captcha while executing a request. Solving captcha ...
    Method  : ${request.method}
    Path    : ${request.path}
    Route   : ${request.route}
    Info    : ${Deno.inspect(data)}`,
          );

          const captcha = await this.manager.captchaService!.solve(
            data,
            this.manager.client.options.http.headers["User-Agent"],
          );
          this.manager.client.emit(
            Events.DEBUG,
            `Captcha details:
    Method  : ${request.method}
    Path    : ${request.path}
    Route   : ${request.route}
    Key     : ${captcha ? `${captcha.slice(0, 30)}...` : "[Captcha not solved]"}
    rqToken : ${data.captcha_rqtoken}`,
          );
          request.retries++;
          return this.execute(request, captcha, data.captcha_rqtoken);
        }
      } catch (err) {
        throw new HTTPError(
          err.message,
          err.constructor.name,
          err.status,
          request,
        );
      }
      throw new DiscordAPIError(data, res.status, request);
    }

    if (res.status > 500 && res.status < 600) {
      if (request.retries === this.manager.client.options.retryLimit) {
        throw new HTTPError(
          res.statusText,
          res.constructor.name,
          res.status,
          request,
        );
      }

      request.retries++;
      return this.execute(request);
    }

    return null;
  }
}
