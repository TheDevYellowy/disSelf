import { BaseClient } from "./BaseClient.ts";
import { Collection } from "../util/Collection.ts";

// Managers
import WebSocketManager from "./WebSocket/WebSocketManager.ts";
import { RESTManager } from "../rest/RESTManager.ts";

// Misc
import type { ClientOptions } from "../interfaces/interfaces.ts";
import { Events } from "../util/Constants.ts";
import { version } from "../../mod.ts";

class Client extends BaseClient {
  readyAt: Date | null;
  token: string | null;
  _interactionCache: unknown;
  user: null;
  application: null;
  password: string | boolean;
  usedCodes: never[];
  session_id: null | string;
  sweepMessageInterval: number;

  rest: RESTManager;
  ws: WebSocketManager;
  channels: any;
  users: any;
  guilds: any;

  constructor(options: ClientOptions) {
    super(options);
    this.token = null;
    this._interactionCache = new Collection();
    this.user = null;
    this.application = null;
    this.readyAt = null;
    this.password = this.options.password;
    this.usedCodes = [];
    this.session_id = null;

    this.rest = new RESTManager(this);
    this.ws = new WebSocketManager(this);

    const typeofShards = typeof this.options.shards;
    if (typeofShards === "undefined" && typeof this.options.shardCount) {
      this.options.shards = Array.from(
        { length: this.options.shardCount },
        (_, i) => i,
      );
    }

    if (typeofShards === "number") {
      this.options.shards = [Number(this.options.shards)];
    }

    if (Array.isArray(this.options.shards)) {
      this.options.shards = [
        ...new Set(
          this.options.shards.filter((item) =>
            !isNaN(item) && item >= 0 && item < Infinity && item === (item | 0)
          ),
        ),
      ];
    }
    this.sweepMessageInterval = setInterval(
      this.sweepMessages.bind(this),
      this.options.messageSweepInterval * 1_000,
    );
  }

  get sessionId() {
    return this.session_id;
  }

  get readyTimestamp() {
    return this.readyAt?.getTime() ?? null;
  }

  get uptime() {
    return this.readyAt ? Date.now() - this.readyTimestamp! : null;
  }

  get api() {
    return this.rest.api;
  }

  async login(token = this.token) {
    if (!token || typeof token !== "string") throw new Error("TOKEN_INVALID");
    this.token = token = token.replace(/^(Bot|Bearer)\s*/i, "");
    this.emit(
      Events.DEBUG,
      `
      Logging on with a user token is unfortunately against the Discord
      \`Terms of Service\` <https://support.discord.com/hc/en-us/articles/115002192352>
      and doing so might potentially get your account banned.
      Use this at your own risk.
      `,
    );
    this.emit(
      Events.DEBUG,
      `Provided token: ${
        token
          .split(".")
          .map((val, i) => (i > 1 ? val.replace(/./g, "*") : val))
          .join(".")
      }`,
    );

    // if(this.options.presence) {}

    try {
      await this.ws.connect();
      return this.token;
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  /**
   * Login to the API with Username and Password
   * @param username Email or Phone number
   * @param password The password
   * @param mfaCode 2FA Code / Backup Code
   */
  async normalLogin(
    username: string,
    password = this.password,
    mfaCode: string | null | undefined,
  ) {
    if (
      !username || !password || typeof username !== "string" ||
      typeof password !== "string"
    ) {
      throw new Error("NORMAL_LOGIN");
    }

    this.emit(
      Events.DEBUG,
      `Connecting to Discord with: 
      username: ${username}
      password: ${password.replace(/./g, "*")}`,
    );

    const data = await this.api.auth.login.post({
      data: {
        login: username,
        password: password,
        undelete: false,
        captcha_key: null,
        login_source: null,
        gift_code_sku_id: null,
      },
      auth: false,
    });

    this.password = password;

    if (!data.token && data.ticket && data.mfa) {
      this.emit(Events.DEBUG, `Using 2FA Code: ${mfaCode}`);

      const normal2fa = /(\d{6})/g;
      const backupCode = /([a-z0-9]{4})-([a-z0-9]{4})/g;

      if (!mfaCode || typeof mfaCode !== "string") {
        throw new Error("LOGIN_FAILED_2FA");
      }

      if (normal2fa.test(mfaCode) || backupCode.test(mfaCode)) {
        const data2 = await this.api.auth.mfa.totp.post({
          data: {
            code: mfaCode,
            ticket: data.ticket,
            login_source: null,
            gift_code_sku_id: null,
          },
          auth: false,
        });
        return this.login(data2.token);
      } else {
        throw new Error("LOGIN_FAILED_2FA");
      }
    } else if (data.token) {
      return this.login(data.token);
    } else {
      throw new Error("LOGIN_FAILED_UNKNOWN");
    }
  }

  destroy() {}
}

export default Client;
