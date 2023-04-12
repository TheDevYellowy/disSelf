import { SweeperKey } from "../interfaces/interfaces.ts";

export const defaultUA =
  "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9012 Chrome/108.0.5359.215 Electron/22.3.2 Safari/537.36";

export const WSCodes: { [key: number]: string } = {
  1000: "WS_CLOSE_REQUESTED",
  1011: "INTERNAL_ERROR",
  4004: "TOKEN_INVALID",
  4010: "SHARDING_INVALID",
  4011: "SHARDING_REQUIRED",
  4013: "INVALID_INTENTS",
  4014: "DISALLOWED_INTENTS",
};

const AllowedImageFormats = ["webp", "png", "jpg", "jpeg", "gif"];

const AllowedImageSizes = [
  16,
  32,
  56,
  64,
  96,
  128,
  256,
  300,
  512,
  600,
  1024,
  2048,
  4096,
];

export function makeImageUrl(
  root: string,
  { format = "webp", size = 512 } = {},
) {
  if (!["undefined", "number"].includes(typeof size)) {
    throw new TypeError("INVALID_TYPE", "size", "number");
  }
  if (format && !AllowedImageFormats.includes(format)) {
    throw new Error("IMAGE_FORMAT", format);
  }
  if (size && !AllowedImageSizes.includes(size)) {
    throw new RangeError("IMAGE_SIZE", size);
  }
  return `${root}.${format}${size ? `?size=${size}` : ""}`;
}

export const Endpoints = {
  CDN(root: any) {
    return {
      Emoji: (emojiId: any, format = "webp") =>
        `${root}/emojis/${emojiId}.${format}`,
      Asset: (name: any) => `${root}/assets/${name}`,
      DefaultAvatar: (discriminator: any) =>
        `${root}/embed/avatars/${discriminator}.png`,
      Avatar: (
        userId: any,
        hash: string,
        format: string,
        size: any,
        dynamic = false,
      ) => {
        if (dynamic && hash.startsWith("a_")) format = "gif";
        return makeImageUrl(`${root}/avatars/${userId}/${hash}`, {
          format,
          size,
        });
      },
      AvatarDecoration: (userId: any, hash: any, format = "png", size: any) =>
        makeImageUrl(`${root}/avatar-decorations/${userId}/${hash}`, {
          format,
          size,
        }),
      GuildMemberAvatar: (
        guildId: any,
        memberId: any,
        hash: string,
        format = "webp",
        size: any,
        dynamic = false,
      ) => {
        if (dynamic && hash.startsWith("a_")) format = "gif";
        return makeImageUrl(
          `${root}/guilds/${guildId}/users/${memberId}/avatars/${hash}`,
          { format, size },
        );
      },
      GuildMemberBanner: (
        guildId: any,
        memberId: any,
        hash: string,
        format = "webp",
        size: any,
        dynamic = false,
      ) => {
        if (dynamic && hash.startsWith("a_")) format = "gif";
        return makeImageUrl(
          `${root}/guilds/${guildId}/users/${memberId}/banners/${hash}`,
          { format, size },
        );
      },
      Banner: (
        id: any,
        hash: string,
        format: string,
        size: any,
        dynamic = false,
      ) => {
        if (dynamic && hash.startsWith("a_")) format = "gif";
        return makeImageUrl(`${root}/banners/${id}/${hash}`, { format, size });
      },
      Icon: (
        guildId: any,
        hash: string,
        format: string,
        size: any,
        dynamic = false,
      ) => {
        if (dynamic && hash.startsWith("a_")) format = "gif";
        return makeImageUrl(`${root}/icons/${guildId}/${hash}`, {
          format,
          size,
        });
      },
      AppIcon: (
        appId: any,
        hash: any,
        options: { format?: string | undefined; size: any } | undefined,
      ) => makeImageUrl(`${root}/app-icons/${appId}/${hash}`, options),
      AppAsset: (
        appId: any,
        hash: any,
        options: { format?: string | undefined; size: any } | undefined,
      ) => makeImageUrl(`${root}/app-assets/${appId}/${hash}`, options),
      StickerPackBanner: (bannerId: any, format: any, size: any) =>
        makeImageUrl(
          `${root}/app-assets/710982414301790216/store/${bannerId}`,
          { size, format },
        ),
      GDMIcon: (channelId: any, hash: any, format: any, size: any) =>
        makeImageUrl(`${root}/channel-icons/${channelId}/${hash}`, {
          size,
          format,
        }),
      Splash: (guildId: any, hash: any, format: any, size: any) =>
        makeImageUrl(`${root}/splashes/${guildId}/${hash}`, { size, format }),
      DiscoverySplash: (guildId: any, hash: any, format: any, size: any) =>
        makeImageUrl(`${root}/discovery-splashes/${guildId}/${hash}`, {
          size,
          format,
        }),
      TeamIcon: (
        teamId: any,
        hash: any,
        options: { format?: string | undefined; size: any } | undefined,
      ) => makeImageUrl(`${root}/team-icons/${teamId}/${hash}`, options),
      Sticker: (stickerId: any, stickerFormat: string) =>
        `${root}/stickers/${stickerId}.${
          stickerFormat === "LOTTIE"
            ? "json"
            : stickerFormat === "GIF"
            ? "gif"
            : "png"
        }`,
      RoleIcon: (roleId: any, hash: any, format = "webp", size: any) =>
        makeImageUrl(`${root}/role-icons/${roleId}/${hash}`, { size, format }),
      guildScheduledEventCover: (
        scheduledEventId: any,
        coverHash: any,
        format: any,
        size: any,
      ) =>
        makeImageUrl(`${root}/guild-events/${scheduledEventId}/${coverHash}`, {
          size,
          format,
        }),
    };
  },
  invite: (
    root: any,
    code: any,
    eventId: any,
  ) => (eventId ? `${root}/${code}?event=${eventId}` : `${root}/${code}`),
  scheduledEvent: (root: any, guildId: any, eventId: any) =>
    `${root}/${guildId}/${eventId}`,
  botGateway: "/gateway/bot",
  userGateway: "/gateway",
};

export const Status = {
  READY: 0,
  CONNECTING: 1,
  RECONNECTING: 2,
  IDLE: 3,
  NEARLY: 4,
  DISCONNECTED: 5,
  WAITING_FOR_GUILDS: 6,
  IDENTIFYING: 7,
  RESUMING: 8,
};

export const Opcodes = {
  DISPATCH: 0, // #  Receive => dispatches an event
  HEARTBEAT: 1, // #  Send/Receive => used for ping checking
  IDENTIFY: 2, // #  Send => used for client handshake
  STATUS_UPDATE: 3, // #  Send => used to update the client status
  VOICE_STATE_UPDATE: 4, // #  Send => used to join/move/leave voice channels
  VOICE_GUILD_PING: 5, // #  Send => used for voice ping checking
  RESUME: 6, //  #  Send => used to resume a closed connection
  RECONNECT: 7, // #  Receive => used to tell when to reconnect (sometimes...)
  REQUEST_GUILD_MEMBERS: 8, // #  Send => used to request guild members (when searching for members in the search bar of a guild)
  INVALID_SESSION: 9, // #  Receive => used to notify client they have an invalid session id
  HELLO: 10, // #  Receive => sent immediately after connecting, contains heartbeat and server debug information
  HEARTBEAT_ACK: 11, // #  Sent  => immediately following a client heartbeat that was received
  GUILD_SYNC: 12, // #  Receive => guild_sync but not used anymore
  DM_UPDATE: 13, // #  Send => used to get dm features
  GUILD_SUBSCRIPTIONS: 14, // #  Send => discord responds back with GUILD_MEMBER_LIST_UPDATE type SYNC...
  LOBBY_CONNECT: 15,
  LOBBY_DISCONNECT: 16,
  LOBBY_VOICE_STATE_UPDATE: 17, // #  Receive
  STREAM_CREATE: 18,
  STREAM_DELETE: 19,
  STREAM_WATCH: 20,
  STREAM_PING: 21, // #  Send
  STREAM_SET_PAUSED: 22,
  REQUEST_APPLICATION_COMMANDS: 24, // #  Send => request application/bot cmds (user, message, and slash cmds)
  EMBEDDED_ACTIVITY_LAUNCH: 25,
  EMBEDDED_ACTIVITY_CLOSE: 26,
  EMBEDDED_ACTIVITY_UPDATE: 27,
  REQUEST_FORUM_UNREADS: 28,
  REMOTE_COMMAND: 29,
};

export const Events = {
  RATE_LIMIT: "rateLimit",
  INVALID_REQUEST_WARNING: "invalidRequestWarning",
  API_RESPONSE: "apiResponse",
  API_REQUEST: "apiRequest",
  CLIENT_READY: "ready",
  APPLICATION_COMMAND_AUTOCOMPLETE_RESPONSE:
    "applicationCommandAutocompleteResponse",
  APPLICATION_COMMAND_CREATE: "applicationCommandCreate",
  APPLICATION_COMMAND_DELETE: "applicationCommandDelete",
  APPLICATION_COMMAND_UPDATE: "applicationCommandUpdate",
  APPLICATION_COMMAND_PERMISSIONS_UPDATE: "applicationCommandPermissionsUpdate",
  AUTO_MODERATION_ACTION_EXECUTION: "autoModerationActionExecution",
  AUTO_MODERATION_RULE_CREATE: "autoModerationRuleCreate",
  AUTO_MODERATION_RULE_DELETE: "autoModerationRuleDelete",
  AUTO_MODERATION_RULE_UPDATE: "autoModerationRuleUpdate",
  CALL_CREATE: "callCreate",
  CALL_DELETE: "callDelete",
  CALL_UPDATE: "callUpdate",
  GUILD_CREATE: "guildCreate",
  GUILD_DELETE: "guildDelete",
  GUILD_UPDATE: "guildUpdate",
  GUILD_APPLICATION_COMMANDS_UPDATE: "guildApplicationCommandUpdate",
  GUILD_UNAVAILABLE: "guildUnavailable",
  GUILD_MEMBER_ADD: "guildMemberAdd",
  GUILD_MEMBER_REMOVE: "guildMemberRemove",
  GUILD_MEMBER_UPDATE: "guildMemberUpdate",
  GUILD_MEMBER_AVAILABLE: "guildMemberAvailable",
  GUILD_MEMBERS_CHUNK: "guildMembersChunk",
  GUILD_MEMBER_LIST_UPDATE: "guildMemberListUpdate",
  GUILD_INTEGRATIONS_UPDATE: "guildIntegrationsUpdate",
  GUILD_ROLE_CREATE: "roleCreate",
  GUILD_ROLE_DELETE: "roleDelete",
  INVITE_CREATE: "inviteCreate",
  INVITE_DELETE: "inviteDelete",
  GUILD_ROLE_UPDATE: "roleUpdate",
  GUILD_EMOJI_CREATE: "emojiCreate",
  GUILD_EMOJI_DELETE: "emojiDelete",
  GUILD_EMOJI_UPDATE: "emojiUpdate",
  GUILD_BAN_ADD: "guildBanAdd",
  GUILD_BAN_REMOVE: "guildBanRemove",
  CHANNEL_CREATE: "channelCreate",
  CHANNEL_DELETE: "channelDelete",
  CHANNEL_UPDATE: "channelUpdate",
  CHANNEL_PINS_UPDATE: "channelPinsUpdate",
  CHANNEL_RECIPIENT_REMOVE: "channelRecipientRemove",
  CHANNEL_RECIPIENT_ADD: "channelRecipientAdd",
  MESSAGE_ACK: "messageAck",
  MESSAGE_CREATE: "messageCreate",
  MESSAGE_DELETE: "messageDelete",
  MESSAGE_UPDATE: "messageUpdate",
  MESSAGE_BULK_DELETE: "messageDeleteBulk",
  MESSAGE_REACTION_ADD: "messageReactionAdd",
  MESSAGE_REACTION_REMOVE: "messageReactionRemove",
  MESSAGE_REACTION_REMOVE_ALL: "messageReactionRemoveAll",
  MESSAGE_REACTION_REMOVE_EMOJI: "messageReactionRemoveEmoji",
  THREAD_CREATE: "threadCreate",
  THREAD_DELETE: "threadDelete",
  THREAD_UPDATE: "threadUpdate",
  THREAD_LIST_SYNC: "threadListSync",
  THREAD_MEMBER_UPDATE: "threadMemberUpdate",
  THREAD_MEMBERS_UPDATE: "threadMembersUpdate",
  USER_UPDATE: "userUpdate",
  USER_SETTINGS_UPDATE: "userSettingsUpdate",
  USER_GUILD_SETTINGS_UPDATE: "userGuildSettingsUpdate",
  PRESENCE_UPDATE: "presenceUpdate",
  VOICE_SERVER_UPDATE: "voiceServerUpdate",
  VOICE_STATE_UPDATE: "voiceStateUpdate",
  TYPING_START: "typingStart",
  WEBHOOKS_UPDATE: "webhookUpdate",
  INTERACTION_CREATE: "interactionCreate",
  INTERACTION_SUCCESS: "interactionSuccess",
  INTERACTION_FAILURE: "interactionFailure",
  INTERACTION_MODAL_CREATE: "interactionModalCreate",
  ERROR: "error",
  WARN: "warn",
  DEBUG: "debug",
  CACHE_SWEEP: "cacheSweep",
  SHARD_DISCONNECT: "shardDisconnect",
  SHARD_ERROR: "shardError",
  SHARD_RECONNECTING: "shardReconnecting",
  SHARD_READY: "shardReady",
  SHARD_RESUME: "shardResume",
  INVALIDATED: "invalidated",
  RAW: "raw",
  STAGE_INSTANCE_CREATE: "stageInstanceCreate",
  STAGE_INSTANCE_UPDATE: "stageInstanceUpdate",
  STAGE_INSTANCE_DELETE: "stageInstanceDelete",
  GUILD_STICKER_CREATE: "stickerCreate",
  GUILD_STICKER_DELETE: "stickerDelete",
  GUILD_STICKER_UPDATE: "stickerUpdate",
  GUILD_SCHEDULED_EVENT_CREATE: "guildScheduledEventCreate",
  GUILD_SCHEDULED_EVENT_UPDATE: "guildScheduledEventUpdate",
  GUILD_SCHEDULED_EVENT_DELETE: "guildScheduledEventDelete",
  GUILD_SCHEDULED_EVENT_USER_ADD: "guildScheduledEventUserAdd",
  GUILD_SCHEDULED_EVENT_USER_REMOVE: "guildScheduledEventUserRemove",
  GUILD_AUDIT_LOG_ENTRY_CREATE: "guildAuditLogEntryCreate",
  RELATIONSHIP_ADD: "relationshipAdd",
  RELATIONSHIP_REMOVE: "relationshipRemove",
  RELATIONSHIP_UPDATE: "relationshipUpdate",
  UNHANDLED_PACKET: "unhandledPacket",
  CAPTCHA_REQUIRED: "captchaRequired",
};

export const ShardEvents = {
  CLOSE: "close",
  DESTROYED: "destroyed",
  INVALID_SESSION: "invalidSession",
  READY: "ready",
  RESUMED: "resumed",
  ALL_READY: "allReady",
};

export const WSEvents = keyMirror([
  "READY",
  "RESUMED",
  "APPLICATION_COMMAND_AUTOCOMPLETE_RESPONSE",
  "APPLICATION_COMMAND_CREATE",
  "APPLICATION_COMMAND_DELETE",
  "APPLICATION_COMMAND_UPDATE",
  "APPLICATION_COMMAND_PERMISSIONS_UPDATE",
  "AUTO_MODERATION_ACTION_EXECUTION",
  "AUTO_MODERATION_RULE_CREATE",
  "AUTO_MODERATION_RULE_DELETE",
  "AUTO_MODERATION_RULE_UPDATE",
  "GUILD_CREATE",
  "GUILD_DELETE",
  "GUILD_UPDATE",
  "INVITE_CREATE",
  "INVITE_DELETE",
  "GUILD_MEMBER_ADD",
  "GUILD_MEMBER_REMOVE",
  "GUILD_MEMBER_UPDATE",
  "GUILD_MEMBERS_CHUNK",
  "GUILD_INTEGRATIONS_UPDATE",
  "GUILD_ROLE_CREATE",
  "GUILD_ROLE_DELETE",
  "GUILD_ROLE_UPDATE",
  "GUILD_BAN_ADD",
  "GUILD_BAN_REMOVE",
  "GUILD_EMOJIS_UPDATE",
  "CHANNEL_CREATE",
  "CHANNEL_DELETE",
  "CHANNEL_UPDATE",
  "CHANNEL_PINS_UPDATE",
  "MESSAGE_CREATE",
  "MESSAGE_DELETE",
  "MESSAGE_UPDATE",
  "MESSAGE_DELETE_BULK",
  "MESSAGE_REACTION_ADD",
  "MESSAGE_REACTION_REMOVE",
  "MESSAGE_REACTION_REMOVE_ALL",
  "MESSAGE_REACTION_REMOVE_EMOJI",
  "THREAD_CREATE",
  "THREAD_UPDATE",
  "THREAD_DELETE",
  "THREAD_LIST_SYNC",
  "THREAD_MEMBER_UPDATE",
  "THREAD_MEMBERS_UPDATE",
  "USER_UPDATE",
  "PRESENCE_UPDATE",
  "TYPING_START",
  "VOICE_STATE_UPDATE",
  "VOICE_SERVER_UPDATE",
  "WEBHOOKS_UPDATE",
  "INTERACTION_CREATE",
  "STAGE_INSTANCE_CREATE",
  "STAGE_INSTANCE_UPDATE",
  "STAGE_INSTANCE_DELETE",
  "GUILD_STICKERS_UPDATE",
  "GUILD_SCHEDULED_EVENT_CREATE",
  "GUILD_SCHEDULED_EVENT_UPDATE",
  "GUILD_SCHEDULED_EVENT_DELETE",
  "GUILD_SCHEDULED_EVENT_USER_ADD",
  "GUILD_SCHEDULED_EVENT_USER_REMOVE",
  "GUILD_AUDIT_LOG_ENTRY_CREATE",
]);

function keyMirror(arr: Array<string>) {
  const tmp: { [key: string]: string } = Object.create(null);
  for (const value of arr) tmp[value] = value;
  return tmp;
}

type EnumObj = {
  [key: number | string]: string | number;
};
function createEnum(keys: Array<string>) {
  const obj: EnumObj = {};
  for (const [index, key] of keys.entries()) {
    if (key === null) continue;
    obj[key] = index;
    obj[index] = key;
  }
  return obj;
}

export function Sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const _cleanupSymbol = Symbol("djsCleanup");
export const ThreadChannelTypes = [
  "GUILD_NEWS_THREAD",
  "GUILD_PUBLIC_THREAD",
  "GUILD_PRIVATE_THREAD",
];
export const SweeperKeys: SweeperKey[] = [
  "applicationCommands",
  "autoModerationRules",
  "bans",
  "emojis",
  "invites",
  "guildMembers",
  "messages",
  "presences",
  "reactions",
  "stageInstances",
  "stickers",
  "threadMembers",
  "threads",
  "users",
  "voiceStates",
];
