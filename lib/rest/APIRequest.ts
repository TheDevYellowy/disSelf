import { Buffer } from "https://deno.land/std@0.177.0/node/buffer.ts";

import type { RESTManager } from "./RESTManager.ts";
import type Client from "../client/Client.ts";

let httpClient: Deno.HttpClient | null = null;

class APIRequest {
  rest: RESTManager;
  client: Client;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  route: string;
  options: any;
  retries: number;
  path: string;

  constructor(
    rest: RESTManager,
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    path: string,
    options: { [key: string]: string } = {},
  ) {
    this.rest = rest;
    this.client = rest.client;
    this.method = method;
    this.route = options.route;
    this.options = options;
    this.retries = 0;

    let queryString = "";
    if (options.query) {
      const query = Object.entries(options.query)
        .filter(([, value]) => value !== null && typeof value !== "undefined")
        .flatMap((
          [key, value],
        ) => (Array.isArray(value)
          ? value.map((v) => [key, v])
          : [[key, value]])
        );
      queryString = new URLSearchParams(query).toString();
    }
    this.path = `${path}${queryString && `?${queryString}`}`;
  }

  make(captchaKey = undefined, captchaRqtoken = undefined) {
    if (httpClient === null) {
      if (
        typeof this.client.options.proxy === "string" &&
        this.client.options.proxy.length > 0
      ) {
        httpClient = Deno.createHttpClient({
          proxy: {
            url: this.client.options.proxy,
          },
        });
      } else {
        httpClient = Deno.createHttpClient({});
      }
    }

    const API = this.options.versioned === false
      ? this.client.options.http.api
      : `${this.client.options.http.api}/v${this.client.options.http.version}`;
    const url = API + this.path;

    let headers = new Headers({
      ...this.client.options.http.headers,
      Accept: "*/*",
      origin: "https://discord.com",
      "Accept-Language": "en-US",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "X-Debug-Options": "bugReporterEnabled",
      "X-Super-Properties": `${
        Buffer.from(
          this.client.options.jsonTransformer(
            this.client.options.ws.properties,
          ),
          "ascii",
        ).toString("base64")
      }`,
      "X-Discord-Locale": "en-US",
      "User-Agent": this.client.options.http.headers["User-Agent"],
      Referer: "https://discord.com/channels/@me",
      Connection: "keep-alive",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "Windows",
      "sec-ch-ua": `"Not?A_Brand";v="8", "Chromium";v="108.0.5359.215"`,
    });

    if (this.options.auth !== false) {
      headers.append("Authorization", this.rest.getAuth());
    }
    if (this.options.reason) {
      headers.append(
        "X-Audit-Log-Reason",
        encodeURIComponent(this.options.reason),
      );
    }
    if (this.options.headers) {
      headers = Object.assign(headers, this.options.headers);
    }

    for (const [key, value] of Object.entries(headers)) {
      if (value === undefined) headers.delete(key);
    }
    if (this.options.webhook == true) {
      headers = new Headers({
        "User-Agent": this.client.options.http.headers["User-Agent"],
      });
    }

    let body;
    if (this.options.files?.length) {
      body = new FormData();
      for (const [index, file] of this.options.files.entries()) {
        if (file?.file) {
          body.append(file.key ?? `files[${index}]`, file.file, file.name);
        }
      }
      if (typeof this.options.data !== "undefined") {
        if (this.options.dontUsePayloadJSON) {
          for (const [key, value] of Object.entries(this.options.data)) {
            if (typeof value == "string") body.append(key, value);
          }
        } else {
          body.append("payload_json", JSON.stringify(this.options.data));
        }
      } else if (typeof this.options.body !== "undefined") {
        if (this.options.dontUsePayloadJSON) {
          for (const [key, value] of Object.entries(this.options.body)) {
            if (typeof value == "string") body.append(key, value);
          }
        } else {
          body.append("payload_json", JSON.stringify(this.options.body));
        }
      }
    } else if (this.options.data != null) {
      headers.append("Content-Type", "application/json");
      if (captchaKey && typeof captchaKey == "string") {
        if (!this.options.data) this.options.data = {};
        headers.set(
          "Cookie",
          "",
        );
        this.options.data.captcha_key = captchaKey;
        if (captchaRqtoken) this.options.data.captcha_rqtoken = captchaRqtoken;
      }
      body = this.options.data ? JSON.stringify(this.options.data) : undefined;
    } else if (this.options.body != null) {
      body = new FormData();
      body.append("payload_json", JSON.stringify(this.options.body));
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.client.options.restRequestTimeout,
    );

    return fetch(url, {
      client: httpClient,
      method: this.method,
      headers,
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
  }
}

export default APIRequest;
