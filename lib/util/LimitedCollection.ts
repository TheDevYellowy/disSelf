import { LimitedCollectionOptions } from "../interfaces/interfaces.ts";
import { Collection } from "./Collection.ts";
import { _cleanupSymbol } from "./Constants.ts";
import Sweepers from "./Sweepers.ts";

export default class LimitedCollection extends Collection<any, any> {
  [x: string | number | symbol]: any;
  constructor(
    options: LimitedCollectionOptions<any, any>,
    iterable: Iterable<readonly [K: string, V: any]> | null | undefined,
  ) {
    if (typeof options !== "object" || options === null) {
      throw new TypeError("INVALID_TYPE", "options", "object", true);
    }
    const {
      maxSize = Infinity,
      keepOverLimit = null,
      sweepInterval = 0,
      sweepFilter = null,
    } = options;

    if (typeof maxSize !== "number") {
      throw new TypeError("INVALID_TYPE", "maxSize", "number");
    }
    if (keepOverLimit !== null && typeof keepOverLimit !== "function") {
      throw new TypeError("INVALID_TYPE", "keepOverLimit", "function");
    }
    if (typeof sweepInterval !== "number") {
      throw new TypeError("INVALID_TYPE", "sweepInterval", "number");
    }
    if (sweepFilter !== null && typeof sweepFilter !== "function") {
      throw new TypeError("INVALID_TYPE", "sweepFilter", "function");
    }

    super(iterable);

    this.maxSize = maxSize;
    this.keepOverLimit = keepOverLimit;
    this.sweepFilter = sweepFilter;

    this.interval =
      sweepInterval > 0 && sweepInterval !== Infinity && sweepFilter
        ? setInterval(() => {
          const sweepFn = this.sweepFilter(this);
          if (sweepFn === null) return;
          if (typeof sweepFn !== "function") {
            throw new TypeError("SWEEP_FILTER_RETURN");
          }
          this.sweep(sweepFn);
        }, sweepInterval * 1_000)
        : null;
  }

  static filterByLifetime({
    lifetime = 14400,
    getComparisonTimestamp = (e: any) => e?.createdTimestamp,
    excludeFromSweep = () => false,
  } = {}) {
    return Sweepers.filterByLifetime({
      lifetime,
      getComparisonTimestamp,
      excludeFromSweep,
    });
  }

  [_cleanupSymbol]() {
    return this.interval ? () => clearInterval(this.interval) : null;
  }

  static get [Symbol.species]() {
    return Collection;
  }
}
