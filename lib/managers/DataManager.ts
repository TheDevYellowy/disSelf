import BaseManager from "./BaseManager.ts";
import type Client from "../client/Client.ts";

export default class DataManager extends BaseManager {
  holds: any;

  constructor(client: Client, holds: any) {
    super(client);

    this.holds = holds;
  }

  // get cache() {
  //   throw new Error("NOT_IMPLEMENTED", "get cache", this.constructor.name);
  // }

  resolve(idOrInstance: string | Record<string, any>) {
    if (idOrInstance instanceof this.holds) return idOrInstance;
    if (typeof idOrInstance === "string") {
      return this.cache.get(idOrInstance) ?? null;
    }
    return null;
  }

  resolveId(idOrInstance: string | Record<string, any>) {
    if (idOrInstance instanceof this.holds) return idOrInstance.id;
    if (typeof idOrInstance === "string") return idOrInstance;
    return null;
  }

  valueOf() {
    return this.cache;
  }
}
