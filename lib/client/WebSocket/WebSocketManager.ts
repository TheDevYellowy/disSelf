import { EventEmitter } from 'https://deno.land/std@0.177.0/node/events.ts';
import { setImmediate } from 'https://deno.land/std@0.177.0/node/timers.ts';

import Client from '../Client.ts';
import { Collection } from '../../util/Collection.ts';
import { WebSocketShard } from './WebSocketShard.ts';
import { handlers } from './handlers/index.ts'
import { Events, ShardEvents, Status, WSCodes, WSEvents, Sleep } from '../../util/Constants.ts';

const BeforeReadyWhitelist = [
    WSEvents.READY,
    WSEvents.RESUMED,
    WSEvents.GUILD_CREATE,
    WSEvents.GUILD_DELETE,
    WSEvents.GUILD_MEMBERS_CHUNK,
    WSEvents.GUILD_MEMBER_ADD,
    WSEvents.GUILD_MEMBER_REMOVE,
];
  
const UNRECOVERABLE_CLOSE_CODES = Object.keys(WSCodes).slice(2).map(Number);
const UNRESUMABLE_CLOSE_CODES = [
    RPCErrorCodes.UnknownError,
    RPCErrorCodes.InvalidPermissions,
    RPCErrorCodes.InvalidClientId,
];

class WebSocketManager extends EventEmitter {
    client: Client;
    gateway: null | string;
    shards: Collection<number, WebSocketShard>;
    status: number;

    private totalShards: number;
    private shardQueue: Set<WebSocketShard>;
    // deno-lint-ignore ban-types
    private packetQueue: Object[];
    private destroyed: boolean;
    private reconnecting: boolean;

    constructor(client: Client) {
        super()

        this.client = client;
        this.gateway = null;
        this.totalShards = this.client.options.shards.length;
        this.status = Status.IDLE;

        this.shards = new Collection();
        this.shardQueue = new Set();
        this.packetQueue = [];
        this.destroyed = false;
        this.reconnecting = false;
    }
     /** @readonly */
    get ping() {
        const sum = this.shards.reduce((a, b) => a + b.ping, 0);
        return sum / this.shards.size;
    }

    debug(message: string, shard?: WebSocketShard) {
        this.client.emit('debug', `[WS => ${shard ? `Shard ${shard.id}` : 'Manager'}] ${message}`)
    }

    private async connect() {
        const invalidToken = new Error(WSCodes[4004]);

        let gatewayURL = 'wss://gateway.discord.gg';
        const { url } = await this.client.api.gateway
            .get({auth: false})
            .catch((_err: any) => {})
        if(url) gatewayURL = url;
        const recommendedShards = 1;
        const sessionStartLimit = {
            total: Infinity,
            remaining: Infinity,
        };

        const { total, remaining } = sessionStartLimit;
        
        this.debug(`
        URL: ${gatewayURL}
        Recommended Shards: ${recommendedShards}`);

        this.debug(`Session Limit Information
        Total: ${total}
        Remaining: ${remaining}`);

        this.gateway = gatewayURL;
        let { shards } = this.client.options;
        if(shards == 'auto') {
            this.debug(`Using the recommended shard count provided by Discord: ${recommendedShards}`);
            this.totalShards = this.client.options.shardCount = recommendedShards;
            shards = this.client.options.shards = Array.from({ length: recommendedShards }, (_, i) => i);
        }

        this.totalShards = shards.length;
        this.debug(`Spawning shards: ${shards.join(', ')}`);
        this.shardQueue = new Set(shards.map((id: number) => new WebSocketShard(this, id)));

        return this.createShards()
    }

    private async createShards(): Promise<boolean> {
        if(!this.shardQueue.size) return false;
        const [shard] = this.shardQueue;

        this.shardQueue.delete(shard);
        if(!shard.eventsAttached) {
            shard.on(ShardEvents.ALL_READY, unavailableGuilds => {
                this.client.emit(Events.SHARD_READY, shard.id, unavailableGuilds);
                if(!this.shardQueue.size) this.reconnecting = false;
                this.checkShardsReady()
            });

            shard.on(ShardEvents.CLOSE, event => {
                if (event.code === 1_000 ? this.destroyed : UNRECOVERABLE_CLOSE_CODES.includes(event.code)) {
                    /**
                     * Emitted when a shard's WebSocket disconnects and will no longer reconnect.
                     * @event Client#shardDisconnect
                     * @param {CloseEvent} event The WebSocket close event
                     * @param {number} id The shard id that disconnected
                     */
                    this.client.emit(Events.SHARD_DISCONNECT, event, shard.id);
                    this.debug(WSCodes[event.code], shard);
                    return;
                }

                if (UNRESUMABLE_CLOSE_CODES.includes(event.code)) {
                    // These event codes cannot be resumed
                    shard.sessionId = null;
                }

                /**
                 * Emitted when a shard is attempting to reconnect or re-identify.
                 * @event Client#shardReconnecting
                 * @param {number} id The shard id that is attempting to reconnect
                 */
                this.client.emit(Events.SHARD_RECONNECTING, shard.id);

                this.shardQueue.add(shard);

                if (shard.sessionId) this.debug(`Session id is present, attempting an immediate reconnect...`, shard);
                this.reconnect();
            });

            shard.on(ShardEvents.INVALID_SESSION, () => {
                this.client.emit(Events.SHARD_RECONNECTING, shard.id);
            });

            shard.on(ShardEvents.DESTROYED, () => {
                this.debug('Shard was destroyed but no WebSocket connection was present! Reconnecting...', shard);

                this.client.emit(Events.SHARD_RECONNECTING, shard.id);

                this.shardQueue.add(shard);
                this.reconnect();
            });

            shard.eventsAttached = true;
        }

        this.shards.set(shard.id, shard);

        try {
            await shard.connect();
        } catch (error) {
            if(error?.code && UNRECOVERABLE_CLOSE_CODES.includes(error.code)) {
                throw new Error(WSCodes[error.code])
            } else if(!error || error.code) {
                this.debug('Failed to connect to the gateway, requeueing...', shard);
                this.shardQueue.add(shard);
            } else {
                throw error;
            }
        }

        if(this.shardQueue.size) {
            this.debug(`Shard Queue Size: ${this.shardQueue.size}; continuing in 5 seconds...`);
            await Sleep(5_000);
            return this.createShards();
        }

        return true;
    }

    private async reconnect(): Promise<boolean> {
        if (this.reconnecting || this.status !== Status.READY) return false;
        this.reconnecting = true;
        try {
            await this.createShards();
        } catch (error) {
            this.debug(`Couldn't connect or fetch information about the gateway. ${error}`);
            if(error.httpStatus !== 401) {
                this.debug(`Possible network error occured. Retrying in 5s...`);
                await Sleep(5_000);
                this.reconnecting = false;
                return this.reconnect();
            }

            if(this.client.listenerCount(Events.INVALIDATED)) {
                this.client.emit(Events.INVALIDATED);
                this.destroy();
            } else {
                this.cleint.destroy()
            }
        } finally {
            this.reconnecting = false;
        }

        return true;
    }

    private broadcast(packet: any) {
        for (const shard of this.shards.values()) shard.send(packet);
    }

    private destroy() {
        if (this.destroyed) return;
        this.debug(`Manager was destroyed. Called by:\n${new Error('MANAGER_DESTROYED').stack}`);
        this.destroyed = true;
        this.shardQueue.clear();
        for (const shard of this.shards.values()) shard.destroy({ closeCode: 1_000, reset: true, emit: false, log: false });
    }

    private async handlePacket(packet?: any, shard?: WebSocketShard): boolean {
        if(packet && this.status !== Status.READY) {
            if(!BeforeReadyWhitelist.includes(packet.t)) {
                this.packetQueue.push({ packet, shard });
                return false;
            }
        }

        if(this.packetQueue.length) {
            const item: any = this.packetQueue.shift();
            setImmediate(() => {
                this.handlePacket(item.packet, item.shard);
            }).unref();
        }

        if(packet && await handlers[packet.t]) {
            await (await handlers[packet.t]).default(this.client, packet, shard);
        } else if(packet) {
            this.client.emit(Events.UNHANDLED_PACKET, packet, shard);
        }
        return true;
    }

    private checkShardsReady() {
        if (this.status === Status.READY) return;
        if(this.shards.size !== this.totalShards || this.shards.some(s => s.status !== Status.READY)) return;

        this.triggerClientReady();
    }

    private triggerClientReady() {
        this.status = Status.READY;
        this.client.readyAt = new Date();

        this.client.emit(Events.CLIENT_READY, this.client);

        this.handlePacket();
    }
}

export default WebSocketManager