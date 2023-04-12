import { Snowflake } from "https://deno.land/x/discord_api_types@0.37.38/v9.ts";
import { Collection } from "../util/Collection.ts";

type RateLimitData = {
  timeout: number;
  limit: number;
  method: string;
  path: string;
  route: string;
  global: boolean;
};

type RateLimitQueueFilter = (
  rateLimitData: RateLimitData,
) => boolean | Promise<boolean>;

export interface ClientOptions {
  jsonTransformer: (
    object: Record<string | number | symbol, unknown>,
  ) => string;
  shards: number | number[] | string;
  closeTimeout: number;
  checkUpdate: boolean;
  syncStatus: boolean;
  autoRedeemNitro: boolean;
  captchaService: string;
  captchaKey: string;
  captchaRetryLimit: number;
  captchaSolver: (captcha: string, userAgent: string) => Promise<string>;
  DMSync: boolean;
  patchVoice: boolean;
  password: boolean | string;
  usingNewAttachmentAPI: boolean;
  interactionTimeout: number;
  waitGuildTimeout: number;
  messageCreateEventGuildTimeout: number;
  shardCount: number;
  makeCache: (
    manager: Function,
    iteration: Iterable<[K: any, V: any]>,
  ) => LimitedCollection<any, any> | Collection<any, any>;
  messageCacheLifetime: number;
  messageSweepInterval: number;
  invalidRequestWarningInterval: number;
  intents: number | string[];
  partials: string[];
  restWsBridgeTimeout: number;
  restRequestTimeout: number;
  restGlobalRateLimit: number;
  retryLimit: number;
  restTimeOffset: number;
  restSweepInterval: number;
  failIfNotExists: boolean;
  rejectOnRateLimit: string[] | RateLimitQueueFilter;
  userAgentSuffix: string[];
  presence: {
    status: string;
    since: number;
    activities: string[];
    afk: boolean;
  };
  sweepers: Record<string, unknown>;
  proxy: string;
  ws: {
    compress: boolean;
    properties: {
      os: string;
      browser: string;
      release_channel: string;
      client_version: string;
      os_version: string;
      os_arch: string;
      system_locale: string;
      client_build_number: number;
      native_build_number: number;
      client_event_source: null;
      design_id: number;
    };
    version: 6 | 7 | 8 | 9 | 10;
    client_state: {
      guildVersions: Record<string, unknown>;
      highest_last_message_id: string;
      read_state_version: number;
      user_guild_settings_version: number;
      user_settings_version: number;
      api_code_version: number;
    };
  };
  http: {
    agent: Record<string, unknown>;
    headers: {
      "User-Agent": string;
      [key: string]: string | undefined;
    };
    version: number;
    api: string;
    cdn: string;
    invite: string;
    template: string;
    scheduledEvent: string;
  };
}

export class LimitedCollection<K, V> extends Collection<K, V> {
  public maxSize: number | undefined;
  public keepOverLimit:
    | ((value: V, key: K, collection: this) => boolean)
    | null
    | undefined;
  /** @deprecated Use Global Sweepers instead */
  public interval: number | null | undefined;
  /** @deprecated Use Global Sweepers instead */
  public sweepFilter: SweepFilter<K, V> | null | undefined;
}

export type SweeperKey = keyof SweeperDefinitions;

export type CollectionSweepFilter<K, V> = (
  value: V,
  key: K,
  collection: Collection<K, V>,
) => boolean;

export type SweepFilter<K, V> = (
  collection: LimitedCollection<K, V>,
) =>
  | ((value: V, key: K, collection: LimitedCollection<K, V>) => boolean)
  | null;

export interface SweepOptions<K, V> {
  interval: number;
  filter: GlobalSweepFilter<K, V>;
}

export interface LifetimeSweepOptions {
  interval: number | null | undefined;
  lifetime: number | null | undefined;
  getComparisonTimestamp: (e: any) => number | null | undefined;
  excludeFromSweep: (e: any) => boolean | null | undefined;
  filter?: never | null | undefined;
}

export interface SweeperDefinitions {
  applicationCommands: [Snowflake, ApplicationCommand];
  autoModerationRules: [Snowflake, AutoModerationRule];
  bans: [Snowflake, GuildBan];
  emojis: [Snowflake, GuildEmoji];
  invites: [string, Invite, true];
  guildMembers: [Snowflake, GuildMember];
  messages: [Snowflake, Message, true];
  presences: [Snowflake, Presence];
  reactions: [string | Snowflake, MessageReaction];
  stageInstances: [Snowflake, StageInstance];
  stickers: [Snowflake, Sticker];
  threadMembers: [Snowflake, ThreadMember];
  threads: [Snowflake, ThreadChannel, true];
  users: [Snowflake, User];
  voiceStates: [Snowflake, VoiceState];
}

export type SweeperOptions = {
  [K in keyof SweeperDefinitions]?: SweeperDefinitions[K][2] extends true ? 
      | SweepOptions<SweeperDefinitions[K][0], SweeperDefinitions[K][1]>
      | LifetimeSweepOptions
    : SweepOptions<SweeperDefinitions[K][0], SweeperDefinitions[K][1]>;
};

export interface LimitedCollectionOptions<K, V> {
  maxSize?: number;
  keepOverLimit?: (
    value: V,
    key: K,
    collection: LimitedCollection<K, V>,
  ) => boolean;
  /** @deprecated Use Global Sweepers instead */
  sweepFilter?: SweepFilter<K, V>;
  /** @deprecated Use Global Sweepers instead */
  sweepInterval?: number;
}

export type GlobalSweepFilter<K, V> = () =>
  | ((value: V, key: K, collection: Collection<K, V>) => boolean)
  | null;
