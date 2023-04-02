import { EventEmitter } from 'https://deno.land/std@0.177.0/node/events.ts';
import WebSocketManager from './WebSocketManager.ts';
import { ShardEvents, Status } from '../../util/Constants.ts';

type Events = {
    [key: string]: any;
}

export class WebSocketShard extends EventEmitter {
    manager: WebSocketManager;
    id: number;
    status: number;
    ping: number;

    private sequence: number;
    private closeSequence: number;
    private sessionId: string|null|undefined;
    private resumeURL: string|null|undefined;
    private lastPingTimestamp: number;
    private lastHeartbeatAcked: boolean;
    private closeEmitted: boolean
    private ratelimit: { queue: never[]; total: number; remaining: number; time: number; timer: null; };
    private connection: WebSocket|null|undefined;
    private helloTimeout: any;
    private wsCloseTimeout: any;
    private eventsAttached: boolean;
    private expectedGuilds: Set<string>|null|undefined;
    private readyTimeout: any;
    private connectedAt: number;
    
    constructor(manager: WebSocketManager, id: number){
        super()

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
            timer: null
        }

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

    private connect(): Promise<void> {
        const { client } = this.manager;
        const gaetway = this.resumeURL ?? this.manager.gateway;

        if(this.connection?.readyState === WebSocket.OPEN && this.status === Status.READY) {
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
                // eslint-disable-next-line prefer-promise-reject-errors
                reject();
            };

            this.once(ShardEvents.READY, onReady);
            this.once(ShardEvents.RESUMED, onResumed);
            this.once(ShardEvents.CLOSE, onClose);
            this.once(ShardEvents.INVALID_SESSION, onInvalidOrDestroyed);
            this.once(ShardEvents.DESTROYED, onInvalidOrDestroyed);

            if (this.connection?.readyState === WebSocket.OPEN) {
                this.debug('An open connection was found, attempting an immediate identify.');
                this.identify();
                return;
            }

            if (this.connection) {
                this.debug(`A connection object was found. Cleaning up before continuing.
            State: ${CONNECTION_STATE[this.connection.readyState]}`);
                this.destroy({ emit: false });
            }

            const wsQuery = { v: client.options.ws.version }

            this.debug(
                `[CONNECT]
            Gateway    : ${gaetway}
            Version    : ${client.options.ws.version}
            Encoding   : null
            Compression: none
            Proxy      : ${client.options.proxy || 'none'}`
            );

            this.status = this.status === Status.DISCONNECTED ? Status.RECONNECTING : Status.CONNECTING;
            this.setHelloTimeout();
            this.setWsCloseTimeout(-1);
            this.connectedAt = Date.now();

            let args = { handshakeTimeout: 30_000 };
            if (client.options.proxy.length > 0) {
                
            }
        })
    }
}