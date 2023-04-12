import { Collection } from "./Collection.ts";
import { defaultUA } from "./Constants.ts";
import LimitedCollection from "./LimitedCollection.ts";

class Options extends null {
  static defaultSweeperSettings: {
    threads: { interval: number; lifetime: number };
  };
  static createDefault() {
    return {
      jsonTransformer: (object: any) => JSON.stringify(object),
      closeTimeout: 5_000,
      checkUpdate: true,
      syncStatus: true,
      autoRedeemNitro: false,
      captchaService: "",
      captchaKey: null,
      captchaRetryLimit: 3,
      DMSync: false,
      patchVoice: false,
      password: false,
      usingNewAttachemntAPI: true,
      interactionTimeout: 15_000,
      waitGuildTimeout: 15_000,
      messageCreateEventGuildTimeout: 100,
      shardCount: 1,
      makeCache: this.cacheWithLimits(this.defaultMakeCacheSettings),
      messageCacheLifetime: 0,
      messageSweepInterval: 0,
      invalidRequestWarningInterval: 0,
      intents: Intents.ALL,
      partials: [
        "USER",
        "CHANNEL",
        "GUILD_MEMBER",
        "MESSAGE",
        "REACTION",
        "GUILD_SCHEDULED_EVENT",
      ],
      restWsBridgeTimeout: 5_000,
      restRequestTimeout: 15_000,
      restGlobalRateLimit: 0,
      retryLimit: 1,
      restTimeOffset: 500,
      restSweepInterval: 60,
      failIfNotExists: false,
      userAgentSuffix: [],
      presence: { status: "online", since: 0, activities: [], afk: false },
      sweepers: {},
      proxy: "",
      ws: {
        compress: false,
        properties: {
          os: "Windows",
          browser: "Discord Client",
          release_channel: "stable",
          client_version: "1.0.9011",
          os_version: "10.0.22621",
          os_arch: "x64",
          system_locale: "en-US",
          client_build_number: 185832,
          native_build_number: 30306,
          client_event_source: null,
          design_id: 0,
        },
        version: 9,
        client_state: {
          guild_versions: {},
          highest_last_message_id: "0",
          read_state_version: 0,
          user_guild_settings_version: -1,
          user_settings_version: -1,
          private_channels_versions: "0",
          api_code_version: 0,
        },
      },
      http: {
        agent: {},
        headers: {
          "User-Agent": defaultUA,
        },
        version: 9,
        api: "https://discord.com/api",
        cdn: "https://cdn.discordapp.com",
        invite: "https://discord.gg",
        template: "https://discord.new",
        scheduledEvent: "https://discord.com/events",
      },
    };
  }

  static cacheWithLimits(
    settings: Record<any, any>,
  ) {
    return (
      manager: Record<any, any>,
      iterable: Iterable<[K: any, V: any]>,
    ) => {
      const setting = settings[manager.name];
      if (setting === null) return new Collection();
      if (typeof setting === "number") {
        if (setting === Infinity) return new Collection();
        return new LimitedCollection({ maxSize: setting }, iterable);
      }

      const noSweeping = setting.sweepFilter == null ||
        setting.sweepInterval == null ||
        setting.sweepInterval <= 0 ||
        setting.sweepInterval === Infinity;
      const noLimit = settings.maxSize == null || settings.maxSize === Infinity;
      if (noSweeping && noLimit) return new Collection();
      return new LimitedCollection(setting, iterable);
    };
  }

  static get defaultMakeCacheSettings() {
    return {
      MessageManager: 200,
    };
  }
}

Options.defaultSweeperSettings = {
  threads: {
    interval: 3600,
    lifetime: 14400,
  },
};

export default Options;
