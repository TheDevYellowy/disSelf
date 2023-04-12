import { EventEmitter } from "https://deno.land/std@0.177.0/node/events.ts";
import WebSocketManager from "./WebSocketManager.ts";
import {
  Events,
  Opcodes,
  ShardEvents,
  Status,
  WSCodes,
  WSEvents,
} from "../../util/Constants.ts";
import { create, unpack } from "../../util/ws.ts";

const STATUS_KEYS = Object.keys(Status);
const CONNECTION_STATE = Object.keys(WebSocket);

type Events = {
  [key: string]: any;
};

/**
 * @external Test
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/ErrorEvent}
 */

export class WebSocketShard extends EventEmitter {
  manager: WebSocketManager;
  id: number;
  status: number;
  eventsAttached: boolean;
  sessionId: string | null | undefined;
  ping: number;

  private sequence: number;
  private closeSequence: number;
  private resumeURL: string | null | undefined;
  private lastPingTimestamp: number;
  private lastHeartbeatAcked: boolean;
  private closeEmitted: boolean;
  private ratelimit: {
    queue: any[];
    total: number;
    remaining: number;
    time: number;
    timer: null | number;
  };
  private connection: WebSocket | null | undefined;
  private helloTimeout: any;
  private wsCloseTimeout: any;
  private expectedGuilds: Set<string> | null | undefined;
  private readyTimeout: any;
  private connectedAt: number;
  private heartbeatInterval: number | null | undefined;

  constructor(manager: WebSocketManager, id: number) {
    super();

    this.manager = manager;
    this.id = id;
    this.status = Status.IDLE;

    this.lastHeartbeatAcked = true;
    this.closeEmitted = false;
    this.eventsAttached = false;

    this.ratelimit = {
      queue: [],
      total: 120,
      remaining: 120,
      time: 60e3,
      timer: null,
    };

    this.connection = null;
    this.helloTimeout = null;
    this.wsCloseTimeout = null;
    this.expectedGuilds = null;
    this.readyTimeout = null;
    this.sessionId = null;
    this.resumeURL = null;

    this.connectedAt = 0;
    this.ping = -1;
    this.lastPingTimestamp = -1;
    this.sequence = -1;
    this.closeSequence = 0;
  }

  private debug(message: string) {
    this.manager.debug(message, this);
  }

  connect(): Promise<void> {
    const { client } = this.manager;
    const gateway = this.resumeURL ?? this.manager.gateway;

    if (
      this.connection?.readyState === WebSocket.OPEN &&
      this.status === Status.READY
    ) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.removeListener(ShardEvents.CLOSE, onClose);
        this.removeListener(ShardEvents.READY, onReady);
        this.removeListener(ShardEvents.RESUMED, onResumed);
        this.removeListener(ShardEvents.INVALID_SESSION, onInvalidOrDestroyed);
        this.removeListener(ShardEvents.DESTROYED, onInvalidOrDestroyed);
      };

      const onReady = () => {
        cleanup();
        resolve();
      };

      const onResumed = () => {
        cleanup();
        resolve();
      };

      const onClose = (event: any) => {
        cleanup();
        reject(event);
      };

      const onInvalidOrDestroyed = () => {
        cleanup();
        reject();
      };

      this.once(ShardEvents.READY, onReady);
      this.once(ShardEvents.RESUMED, onResumed);
      this.once(ShardEvents.CLOSE, onClose);
      this.once(ShardEvents.INVALID_SESSION, onInvalidOrDestroyed);
      this.once(ShardEvents.DESTROYED, onInvalidOrDestroyed);

      if (this.connection?.readyState === WebSocket.OPEN) {
        this.debug(
          "An open connection was found, attempting an immediate identify.",
        );
        this.identify();
        return;
      }

      if (this.connection) {
        this.debug(
          `A connection object was found. Cleaning up before continuing.
            State: ${CONNECTION_STATE[this.connection.readyState]}`,
        );
        this.destroy({ emit: false });
      }

      const wsQuery = { v: client.options.ws.version };

      this.debug(
        `[CONNECT]
            Gateway    : ${gateway}
            Version    : ${client.options.ws.version}
            Encoding   : null
            Compression: none
            Proxy      : ${client.options.proxy || "none"}`,
      );

      this.status = this.status === Status.DISCONNECTED
        ? Status.RECONNECTING
        : Status.CONNECTING;
      this.setHelloTimeout(null);
      this.setWsCloseTimeout(-1);
      this.connectedAt = Date.now();

      let args = { handshakeTimeout: 30_000 };
      const ws = (this.connection = create(gateway, wsQuery, args));
      if (ws == undefined) return;
      ws.onopen = this.onOpen.bind(this);
      ws.onmessage = this.onMessage.bind(this);
      ws.onerror = this.onError.bind(this);
      ws.onclose = this.onClose.bind(this);
    });
  }

  private onOpen() {
    this.debug(`[CONNECTED] Took ${Date.now() - this.connectedAt}ms`);
    this.status = Status.NEARLY;
  }

  private onMessage({ data }: any) {
    let raw;
    let packet;

    if (data instanceof ArrayBuffer) data = new Uint8Array(data);
    raw = data;

    try {
      packet = unpack(raw);
    } catch (err) {
      this.manager.client.emit(Events.SHARD_ERROR, err, this.id);
      return;
    }

    this.manager.client.emit(Events.RAW, packet, this.id);
    if (packet.op == Opcodes.DISPATCH) {
      this.manager.emit(packet.t, packet.d, this.id);
    }
    this.onPacket(packet);
  }

  private onError(this: WebSocketShard, event: ErrorEvent | Event): any {
    if (event instanceof ErrorEvent) {
      const error = event?.error ?? event;
      if (!error) return;

      this.manager.client.emit(Events.SHARD_ERROR, error, this.id);
    }
  }

  private onClose(event: CloseEvent) {
    this.closeEmitted = true;
    if (this.sequence !== -1) this.closeSequence = this.sequence;
    this.sequence = -1;
    this.setHeartbeatTimer(-1);
    this.setHelloTimeout(-1);
    this.setWsCloseTimeout(-1);

    if (this.connection) {
      this._cleanupConnection();
      this.destroy({ reset: !this.sessionId, emit: false, log: false });
    }
    this.status = Status.DISCONNECTED;
    this.emitClose(event);
  }

  emitClose(
    event = {
      code: 1011,
      reason: WSCodes[1011],
      wasClean: false,
    },
  ) {
    this.debug(`[CLOSE]
        Event Code: ${event.code}
        Clean     : ${event.wasClean}
        Reason    : ${event.reason ?? "No reason provided"}`);

    this.emit(ShardEvents.CLOSE, event);
  }

  private onPacket(packet: any) {
    if (!packet) {
      this.debug(`Recieved broken packet: ${packet}`);
      return;
    }

    switch (packet.t) {
      case WSEvents.READY:
        this.emit(ShardEvents.READY);

        this.sessionId = packet.d.session_id;
        this.resumeURL = packet.d.resume_gateway_url;
        this.expectedGuilds = new Set(
          packet.d.guilds.filter((d: { unavailable: boolean }) =>
            d?.unavailable == true
          ).map((d: { id: any }) => d.id),
        );
        this.status = Status.WAITING_FOR_GUILDS;
        this.debug(
          `[READY] Session ${this.sessionId} | ResumeURL ${this.resumeURL}`,
        );
        this.lastHeartbeatAcked = true;
        this.sendHeartbeat("ReadyHeartbeat");
        break;
      case WSEvents.RESUMED: {
        this.emit(ShardEvents.RESUMED);

        this.status = Status.READY;
        const replayed = packet.s - this.closeSequence;
        this.debug(
          `[RESUMED] Session ${this.sessionId} | Replayed ${replayed} events.`,
        );
        this.lastHeartbeatAcked = true;
        this.sendHeartbeat("ResumeHeartbeat");
        break;
      }
    }

    if (packet.s > this.sequence) this.sequence = packet.s;
    switch (packet.op) {
      case Opcodes.HELLO:
        this.setHelloTimeout(-1);
        this.setHeartbeatTimer(packet.d.heartbeat_interval);
        this.identify();
        break;
      case Opcodes.RECONNECT:
        this.debug(`[RECONNECT] Discord asked us to reconnect`);
        this.destroy({ closeCode: 4_000 });
        break;
      case Opcodes.INVALID_SESSION:
        this.debug(`[INVALID SESSION] Resumable: ${packet.d}.`);

        if (packet.d) {
          this.identifyResume();
          return;
        }

        this.sequence = -1;
        this.sessionId = null;
        this.status = Status.RECONNECTING;
        this.emit(ShardEvents.INVALID_SESSION);
        break;
      case Opcodes.HEARTBEAT_ACK:
        this.sendHeartbeat("HeartbeatRequested", true);
        break;
      default:
        this.manager.handlePacket(packet, this);
        if (
          this.status === Status.WAITING_FOR_GUILDS &&
          packet.t === WSEvents.GUILD_CREATE
        ) {
          this.expectedGuilds?.delete(packet.d.id);
          this.checkReady();
        }
    }
  }

  private checkReady() {
    if (this.readyTimeout) {
      clearTimeout(this.readyTimeout);
      this.readyTimeout = null;
    }

    if (!this.expectedGuilds?.size) {
      this.debug(`Shard recieved all its guilds. Marking as fully ready.`);
      this.status = Status.READY;

      this.emit(ShardEvents.ALL_READY);
      return;
    }

    this.readyTimeout = setTimeout(() => {
      this.debug(
        `Shard will not recieve any more guild packets\nUnavailable guild count: ${this.expectedGuilds?.size}`,
      );

      this.readyTimeout = null;
      this.status = Status.READY;
      this.emit(ShardEvents.ALL_READY, this.expectedGuilds);
    }, 0);
  }

  private setHelloTimeout(time: number | null | undefined) {
    if (time === -1) {
      if (this.helloTimeout) {
        this.debug(`Clearing the HELLO timeout.`);
        clearTimeout(this.helloTimeout);
        this.helloTimeout = null;
      }
      return;
    }

    this.debug(`Setting a HELLO timeout for 20s.`);
    this.helloTimeout = setTimeout(() => {
      this.debug(
        `Did not recieve HELLO in time. Destroying and connecting again.`,
      );
      this.destroy({ reset: true, closeCode: 4009 });
    }, 20_000);
  }

  private setWsCloseTimeout(time: number) {
    if (this.wsCloseTimeout) {
      this.debug(`[WebSocket] Clearing the close timeout.`);
      clearTimeout(this.wsCloseTimeout);
    }

    if (time === -1) {
      this.wsCloseTimeout = null;
      return;
    }

    this.wsCloseTimeout = setTimeout(() => {
      this.setWsCloseTimeout(-1);

      if (this.closeEmitted) {
        this.debug(
          `[WebSocket] close was already emitted, assuming the connection was closed properly`,
        );
        this.closeEmitted = false;
        return;
      }

      this.debug(
        `[WebSocket] Close Emitted: ${this.closeEmitted} | did not close properly, assuming a zombie connection.\nEmitting close and reconnecting again`,
      );

      if (this.connection) this._cleanupConnection();

      this.emitClose({
        code: 4009,
        reason: "Session time out.",
        wasClean: false,
      });
    }, time);
  }

  private setHeartbeatTimer(time: number) {
    if (time == -1) {
      if (this.heartbeatInterval) {
        this.debug(`Clearing the heartbeat interval.`);
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
      return;
    }
    this.debug(`Setting a heartbeat inverval for ${time}ms`);

    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), time);
  }

  private sendHeartbeat(
    tag = "HeartbeatTimer",
    ignoreHeartbeatAck = [
      Status.WAITING_FOR_GUILDS,
      Status.IDENTIFYING,
      Status.RESUMING,
    ].includes(this.status),
  ) {
    if (ignoreHeartbeatAck && !this.lastHeartbeatAcked) {
      this.debug(
        `[${tag}] Didn't process heartbeat ack yet but we are still connected. Sending one now.`,
      );
    } else if (!this.lastHeartbeatAcked) {
      this.debug(
        `[${tag}] Didn't recieve a heartbeat ack last time, assuming zombte connection. Destroying and reconnecting.
                Status          : ${STATUS_KEYS[this.status]}
                Sequence        : $${this.sequence}
                Connection State: ${
          this.connection
            ? CONNECTION_STATE[this.connection.readyState]
            : "No Connection??"
        }`,
      );

      this.destroy({ reset: true, closeCode: 4009 });
    }

    this.debug(`[${tag}] Sending a heartbeat.`);
    this.lastHeartbeatAcked = false;
    this.lastPingTimestamp = Date.now();
    this.send({ op: Opcodes.HEARTBEAT, d: this.sequence }, true);
  }

  private ackHeartbeat() {
    this.lastHeartbeatAcked = true;
    const latency = Date.now() - this.lastPingTimestamp;
    this.debug(`Heartbeat acknowledged, latency of ${latency}ms`);
    this.ping = latency;
  }

  private identify(): void {
    return this.sessionId ? this.identifyResume() : this.identifyNew();
  }

  private identifyNew() {
    const { client } = this.manager;
    if (!client.token) {
      this.debug(`[IDENTIFY] No token available to identify a new session.`);
      return;
    }

    this.status = Status.IDENTIFYING;

    client.options.ws.properties = Object.assign(client.options.ws.properties, {
      browser_user_agent: client.options.https.headers["User-Agent"],
    });

    Object.keys(client.options.ws.properties)
      .filter((k) => k.startsWith("$"))
      .forEach((k) => {
        client.options.ws.properties[k.slice(1)] =
          client.options.ws.properties[k];
        delete client.options.ws.properties[k];
      });
    const d = {
      ...client.options.ws,
      token: client.token,
    };

    this.debug(
      `[IDENTIFY] Shard ${this.id}/${client.options.shardCount} wiht intents: none`,
    );

    this.send({ op: Opcodes.IDENTIFY, d }, true);
  }

  private identifyResume() {
    if (!this.sessionId) {
      this.debug(
        `[RESUME] No session id was present; identifying as a new session`,
      );
      this.identifyNew();
      return;
    }

    this.status = Status.RECONNECTING;
    this.debug(`[RESUME] Sesion ${this.sessionId}, sequence ${this.sequence}`);
    const d = {
      token: this.manager.client.token,
      session_id: this.sessionId,
      seq: this.closeSequence,
    };

    this.send({ op: Opcodes.RESUME, d }, true);
  }

  send(data: any, important = false) {
    this.ratelimit.queue[important ? "unshift" : "push"](data);
    this.processQueue();
  }

  private _send(data: any): void {
    if (this.connection?.readyState !== WebSocket.OPEN) {
      this.debug(
        `Tried to send packet '${
          JSON.stringify(data)
        }' but no WebSocket is available!`,
      );
      this.destroy({ closeCode: 4_000 });
      return;
    }

    try {
      this.connection.send(JSON.stringify(data));
    } catch (error) {
      this.manager.client.emit(Events.SHARD_ERROR, error, this.id);
    }
  }

  private processQueue(): void {
    if (this.ratelimit.remaining == 0) return;
    if (this.ratelimit.queue.length == 0) return;
    if (this.ratelimit.remaining == this.ratelimit.total) {
      this.ratelimit.timer = setTimeout(() => {
        this.ratelimit.remaining = this.ratelimit.total;
        this.processQueue();
      }, this.ratelimit.time);
    }

    while (this.ratelimit.remaining > 0) {
      const item = this.ratelimit.queue.shift();
      if (!item) return;
      this._send(item);
      this.ratelimit.remaining--;
    }
  }

  destroy({ closeCode = 1_000, reset = false, emit = true, log = true } = {}) {
    if (log) {
      this.debug(`[DESTROY]
            Close Code    : ${closeCode}
            Reset         : ${reset}
            Emit Destroyed: ${emit}`);
    }

    this.setHeartbeatTimer(-1);
    this.setHelloTimeout(-1);
    this.debug(
      `[WebSocket] Destroy: Attemping to close the WebSocket. | WS State: ${
        CONNECTION_STATE[this.connection?.readyState ?? WebSocket.CLOSED]
      }`,
    );

    if (this.connection) {
      if (this.connection.readyState === WebSocket.OPEN) {
        this.connection.close(closeCode);
        this.debug(
          `[WebSocket] Close: Tried closing. | WS State: ${
            CONNECTION_STATE[this.connection.readyState]
          }`,
        );
      } else {
        this.debug(`WS State: ${CONNECTION_STATE[this.connection.readyState]}`);
        try {
          this.connection.close(closeCode);
        } catch (err) {
          this.debug(
            `[WebSocket] Something went wrong while closing the WebSocket: ${
              err.message || err
            } | WS State: ${CONNECTION_STATE[this.connection.readyState]}`,
          );
        }

        if (emit) this._emitDestroyed();
      }
    } else if (emit) {
      this._emitDestroyed();
    }

    this.debug(
      `[WebSocket] Adding a WebSocket close timeout to ensure a correct WS reconnect.
            Timeout: ${this.manager.client.options.closeTimeout}ms`,
    );
    this.setWsCloseTimeout(this.manager.client.options.closeTimeout);

    this.connection = null;
    this.status = Status.DISCONNECTED;

    if (this.sequence !== -1) this.closeSequence = this.sequence;

    if (reset) {
      this.resumeURL = null;
      this.sequence = -1;
      this.sessionId = null;
    }

    this.ratelimit.remaining = this.ratelimit.total;
    this.ratelimit.queue.length = 0;
    if (this.ratelimit.timer) {
      clearTimeout(this.ratelimit.timer);
      this.ratelimit.timer = null;
    }
  }

  private _cleanupConnection() {
    if (this.connection == null) return;
    this.connection.onopen = this.connection.onclose = this.connection
      .onmessage = null;
    this.connection.onerror = () => null;
  }

  private _emitDestroyed() {
    this.emit(ShardEvents.DESTROYED);
  }
}

export default WebSocketShard;
