import DataManager from "./DataManager.ts";

import type Client from "../client/Client.ts";
import { _cleanupSymbol } from "../util/Constants.ts";
import { Collection } from "../util/Collection.ts";

export default class CachedManager extends DataManager {
  [x: string]: any;
  constructor(
    client: Client,
    holds: Iterable<[K: any, V: any]>,
    iterable: any,
  ) {
    super(client, holds);
    this._cache = this.client.options.makeCache(this.constructor, this.holds);

    let cleanup = this._cache[_cleanupSymbol]?.();
    if (cleanup) {
      cleanup = cleanup.bind(this._cache);
      client._cleanups.add(cleanup);
      client._finalizers.register(this, {
        cleanup,
        message: `Garbage collection completed on ${this.constructor.name}, ` +
          `wich had a ${this._cache.constructor.name} of ${this.holds.name}.`,
        name: this.constructor.name,
      });
    }

    if (iterable) {
      for (const item of iterable) {
        this._add(item);
      }
    }
  }

  get cache(): Collection<any, any> {
    return this._cache;
  }

  _add(data: any, cache = true, { id = "", extras = [] } = {}) {
    const existing = this.cache.get(id ?? data.id);
    if (existing) {
      if (cache) {
        existing._patch(data);
        return existing;
      }
      const clone = existing._clone();
      clone._patch(data);
      return clone;
    }

    const entry = this.holds
      ? new this.holds(this.client, data, ...extras)
      : data;
    if (cache) this.cache.set(id ?? data.id, entry);
    return entry;
  }
}
