/**
 * @internal
 */
export interface CollectionConstructor {
  new (): Collection<unknown, unknown>;
  new <K, V>(entries?: readonly (readonly [K, V])[] | null): Collection<K, V>;
  new <K, V>(iterable: Iterable<readonly [K, V]>): Collection<K, V>;
  readonly prototype: Collection<unknown, unknown>;
  readonly [Symbol.species]: CollectionConstructor;
}

export type ReadonlyCollection<K, V> =
  & Omit<
    Collection<K, V>,
    | "delete"
    | "ensure"
    | "forEach"
    | "get"
    | "reverse"
    | "set"
    | "sort"
    | "sweep"
  >
  & ReadonlyMap<K, V>;

export interface Collection<K, V> extends Map<K, V> {
  constructor: CollectionConstructor;
}

export class Collection<K, V> extends Map<K, V> {
  public ensure(
    key: K,
    defaultValueGenerator: (key: K, collection: this) => V,
  ): V {
    if (this.has(key)) return this.get(key)!;
    if (typeof defaultValueGenerator !== "function") {
      throw new TypeError(`${defaultValueGenerator} is not a function`);
    }
    const defaultValue = defaultValueGenerator(key, this);
    this.set(key, defaultValue);
    return defaultValue;
  }
  public hasAll(...keys: K[]) {
    return keys.every((key) => super.has(key));
  }
  public hasAny(...keys: K[]) {
    return keys.some((key) => super.has(key));
  }
  public first(): V | undefined;
  public first(amount: number): V[];
  public first(amount?: number): V | V[] | undefined {
    if (amount === undefined) return this.values().next().value;
    if (amount < 0) return this.last(amount * -1);
    amount = Math.min(this.size, amount);
    const iter = this.values();
    return Array.from({ length: amount }, (): V => iter.next().value);
  }
  public firstKey(): K | undefined;
  public firstKey(amount: number): K[];
  public firstKey(amount?: number): K | K[] | undefined {
    if (amount === undefined) return this.keys().next().value;
    if (amount < 0) return this.lastKey(amount * -1);
    amount = Math.min(this.size, amount);
    const iter = this.keys();
    return Array.from({ length: amount }, (): K => iter.next().value);
  }
  public last(): V | undefined;
  public last(amount: number): V[];
  public last(amount?: number): V | V[] | undefined {
    const arr = [...this.values()];
    if (amount === undefined) return arr[arr.length - 1];
    if (amount < 0) return this.first(amount * -1);
    if (!amount) return [];
    return arr.slice(-amount);
  }
  public lastKey(): K | undefined;
  public lastKey(amount: number): K[];
  public lastKey(amount?: number): K | K[] | undefined {
    const arr = [...this.keys()];
    if (amount === undefined) return arr[arr.length - 1];
    if (amount < 0) return this.firstKey(amount * -1);
    if (!amount) return [];
    return arr.slice(-amount);
  }
  public at(index: number) {
    index = Math.floor(index);
    const arr = [...this.values()];
    return arr.at(index);
  }
  public random(): V | undefined;
  public random(amount: number): V[];
  public random(amount?: number): V | V[] | undefined {
    const arr = [...this.values()];
    if (amount === undefined) {
      return arr[Math.floor(Math.random() * arr.length)];
    }
    if (!arr.length || !amount) return [];
    return Array.from(
      { length: Math.min(amount, arr.length) },
      (): V => arr.splice(Math.floor(Math.random() * arr.length), 1)[0]!,
    );
  }
  public randomKey(): K | undefined;
  public randomKey(amount: number): K[];
  public randomKey(amount?: number): K | K[] | undefined {
    const arr = [...this.keys()];
    if (amount === undefined) {
      return arr[Math.floor(Math.random() * arr.length)];
    }
    if (!arr.length || !amount) return [];
    return Array.from(
      { length: Math.min(amount, arr.length) },
      (): K => arr.splice(Math.floor(Math.random() * arr.length), 1)[0]!,
    );
  }
  public reverse() {
    const entries = [...this.entries()].reverse();
    this.clear();
    for (const [key, value] of entries) this.set(key, value);
    return this;
  }
  public find<V2 extends V>(
    fn: (value: V, key: K, collection: this) => value is V2,
  ): V2 | undefined;
  public find(
    fn: (value: V, key: K, collection: this) => unknown,
  ): V | undefined;
  public find<This, V2 extends V>(
    fn: (this: This, value: V, key: K, collection: this) => value is V2,
    thisArg: This,
  ): V2 | undefined;
  public find<This>(
    fn: (this: This, value: V, key: K, collection: this) => unknown,
    thisArg: This,
  ): V | undefined;
  public find(
    fn: (value: V, key: K, collection: this) => unknown,
    thisArg?: unknown,
  ): V | undefined {
    if (typeof fn !== "function") {
      throw new TypeError(`${fn} is not a function`);
    }
    if (thisArg !== undefined) fn = fn.bind(thisArg);
    for (const [key, val] of this) {
      if (fn(val, key, this)) return val;
    }

    return undefined;
  }
  public findKey<K2 extends K>(
    fn: (value: V, key: K, collection: this) => key is K2,
  ): K2 | undefined;
  public findKey(
    fn: (value: V, key: K, collection: this) => unknown,
  ): K | undefined;
  public findKey<This, K2 extends K>(
    fn: (this: This, value: V, key: K, collection: this) => key is K2,
    thisArg: This,
  ): K2 | undefined;
  public findKey<This>(
    fn: (this: This, value: V, key: K, collection: this) => unknown,
    thisArg: This,
  ): K | undefined;
  public findKey(
    fn: (value: V, key: K, collection: this) => unknown,
    thisArg?: unknown,
  ): K | undefined {
    if (typeof fn !== "function") {
      throw new TypeError(`${fn} is not a function`);
    }
    if (thisArg !== undefined) fn = fn.bind(thisArg);
    for (const [key, val] of this) {
      if (fn(val, key, this)) return key;
    }

    return undefined;
  }
  public sweep(fn: (value: V, key: K, collection: this) => unknown): number;
  public sweep<T>(
    fn: (this: T, value: V, key: K, collection: this) => unknown,
    thisArg: T,
  ): number;
  public sweep(
    fn: (value: V, key: K, collection: this) => unknown,
    thisArg?: unknown,
  ): number {
    if (typeof fn !== "function") {
      throw new TypeError(`${fn} is not a function`);
    }
    if (thisArg !== undefined) fn = fn.bind(thisArg);
    const previousSize = this.size;
    for (const [key, val] of this) {
      if (fn(val, key, this)) this.delete(key);
    }

    return previousSize - this.size;
  }
  public filter<K2 extends K>(
    fn: (value: V, key: K, collection: this) => key is K2,
  ): Collection<K2, V>;
  public filter<V2 extends V>(
    fn: (value: V, key: K, collection: this) => value is V2,
  ): Collection<K, V2>;
  public filter(
    fn: (value: V, key: K, collection: this) => unknown,
  ): Collection<K, V>;
  public filter<This, K2 extends K>(
    fn: (this: This, value: V, key: K, collection: this) => key is K2,
    thisArg: This,
  ): Collection<K2, V>;
  public filter<This, V2 extends V>(
    fn: (this: This, value: V, key: K, collection: this) => value is V2,
    thisArg: This,
  ): Collection<K, V2>;
  public filter<This>(
    fn: (this: This, value: V, key: K, collection: this) => unknown,
    thisArg: This,
  ): Collection<K, V>;
  public filter(
    fn: (value: V, key: K, collection: this) => unknown,
    thisArg?: unknown,
  ): Collection<K, V> {
    if (typeof fn !== "function") {
      throw new TypeError(`${fn} is not a function`);
    }
    if (thisArg !== undefined) fn = fn.bind(thisArg);
    const results = new this.constructor[Symbol.species]<K, V>();
    for (const [key, val] of this) {
      if (fn(val, key, this)) results.set(key, val);
    }

    return results;
  }
  public partition<K2 extends K>(
    fn: (value: V, key: K, collection: this) => key is K2,
  ): [Collection<K2, V>, Collection<Exclude<K, K2>, V>];
  public partition<V2 extends V>(
    fn: (value: V, key: K, collection: this) => value is V2,
  ): [Collection<K, V2>, Collection<K, Exclude<V, V2>>];
  public partition(
    fn: (value: V, key: K, collection: this) => unknown,
  ): [Collection<K, V>, Collection<K, V>];
  public partition<This, K2 extends K>(
    fn: (this: This, value: V, key: K, collection: this) => key is K2,
    thisArg: This,
  ): [Collection<K2, V>, Collection<Exclude<K, K2>, V>];
  public partition<This, V2 extends V>(
    fn: (this: This, value: V, key: K, collection: this) => value is V2,
    thisArg: This,
  ): [Collection<K, V2>, Collection<K, Exclude<V, V2>>];
  public partition<This>(
    fn: (this: This, value: V, key: K, collection: this) => unknown,
    thisArg: This,
  ): [Collection<K, V>, Collection<K, V>];
  public partition(
    fn: (value: V, key: K, collection: this) => unknown,
    thisArg?: unknown,
  ): [Collection<K, V>, Collection<K, V>] {
    if (typeof fn !== "function") {
      throw new TypeError(`${fn} is not a function`);
    }
    if (thisArg !== undefined) fn = fn.bind(thisArg);
    const results: [Collection<K, V>, Collection<K, V>] = [
      new this.constructor[Symbol.species]<K, V>(),
      new this.constructor[Symbol.species]<K, V>(),
    ];
    for (const [key, val] of this) {
      if (fn(val, key, this)) {
        results[0].set(key, val);
      } else {
        results[1].set(key, val);
      }
    }

    return results;
  }
  public flatMap<T>(
    fn: (value: V, key: K, collection: this) => Collection<K, T>,
  ): Collection<K, T>;
  public flatMap<T, This>(
    fn: (this: This, value: V, key: K, collection: this) => Collection<K, T>,
    thisArg: This,
  ): Collection<K, T>;
  public flatMap<T>(
    fn: (value: V, key: K, collection: this) => Collection<K, T>,
    thisArg?: unknown,
  ): Collection<K, T> {
    // eslint-disable-next-line unicorn/no-array-method-this-argument
    const collections = this.map(fn, thisArg);
    return new this.constructor[Symbol.species]<K, T>().concat(...collections);
  }
  public map<T>(fn: (value: V, key: K, collection: this) => T): T[];
  public map<This, T>(
    fn: (this: This, value: V, key: K, collection: this) => T,
    thisArg: This,
  ): T[];
  public map<T>(
    fn: (value: V, key: K, collection: this) => T,
    thisArg?: unknown,
  ): T[] {
    if (typeof fn !== "function") {
      throw new TypeError(`${fn} is not a function`);
    }
    if (thisArg !== undefined) fn = fn.bind(thisArg);
    const iter = this.entries();
    return Array.from({ length: this.size }, (): T => {
      const [key, value] = iter.next().value;
      return fn(value, key, this);
    });
  }
  public mapValues<T>(
    fn: (value: V, key: K, collection: this) => T,
  ): Collection<K, T>;
  public mapValues<This, T>(
    fn: (this: This, value: V, key: K, collection: this) => T,
    thisArg: This,
  ): Collection<K, T>;
  public mapValues<T>(
    fn: (value: V, key: K, collection: this) => T,
    thisArg?: unknown,
  ): Collection<K, T> {
    if (typeof fn !== "function") {
      throw new TypeError(`${fn} is not a function`);
    }
    if (thisArg !== undefined) fn = fn.bind(thisArg);
    const coll = new this.constructor[Symbol.species]<K, T>();
    for (const [key, val] of this) coll.set(key, fn(val, key, this));
    return coll;
  }
  public some(fn: (value: V, key: K, collection: this) => unknown): boolean;
  public some<T>(
    fn: (this: T, value: V, key: K, collection: this) => unknown,
    thisArg: T,
  ): boolean;
  public some(
    fn: (value: V, key: K, collection: this) => unknown,
    thisArg?: unknown,
  ): boolean {
    if (typeof fn !== "function") {
      throw new TypeError(`${fn} is not a function`);
    }
    if (thisArg !== undefined) fn = fn.bind(thisArg);
    for (const [key, val] of this) {
      if (fn(val, key, this)) return true;
    }

    return false;
  }
  public every<K2 extends K>(
    fn: (value: V, key: K, collection: this) => key is K2,
  ): this is Collection<K2, V>;
  public every<V2 extends V>(
    fn: (value: V, key: K, collection: this) => value is V2,
  ): this is Collection<K, V2>;
  public every(fn: (value: V, key: K, collection: this) => unknown): boolean;
  public every<This, K2 extends K>(
    fn: (this: This, value: V, key: K, collection: this) => key is K2,
    thisArg: This,
  ): this is Collection<K2, V>;
  public every<This, V2 extends V>(
    fn: (this: This, value: V, key: K, collection: this) => value is V2,
    thisArg: This,
  ): this is Collection<K, V2>;
  public every<This>(
    fn: (this: This, value: V, key: K, collection: this) => unknown,
    thisArg: This,
  ): boolean;
  public every(
    fn: (value: V, key: K, collection: this) => unknown,
    thisArg?: unknown,
  ): boolean {
    if (typeof fn !== "function") {
      throw new TypeError(`${fn} is not a function`);
    }
    if (thisArg !== undefined) fn = fn.bind(thisArg);
    for (const [key, val] of this) {
      if (!fn(val, key, this)) return false;
    }

    return true;
  }
  public reduce<T>(
    fn: (accumulator: T, value: V, key: K, collection: this) => T,
    initialValue?: T,
  ): T {
    if (typeof fn !== "function") {
      throw new TypeError(`${fn} is not a function`);
    }
    let accumulator!: T;

    if (initialValue !== undefined) {
      accumulator = initialValue;
      for (const [key, val] of this) {
        accumulator = fn(accumulator, val, key, this);
      }
      return accumulator;
    }

    let first = true;
    for (const [key, val] of this) {
      if (first) {
        accumulator = val as unknown as T;
        first = false;
        continue;
      }

      accumulator = fn(accumulator, val, key, this);
    }

    // No items iterated.
    if (first) {
      throw new TypeError("Reduce of empty collection with no initial value");
    }

    return accumulator;
  }
  public each(fn: (value: V, key: K, collection: this) => void): this;
  public each<T>(
    fn: (this: T, value: V, key: K, collection: this) => void,
    thisArg: T,
  ): this;
  public each(
    fn: (value: V, key: K, collection: this) => void,
    thisArg?: unknown,
  ): this {
    if (typeof fn !== "function") {
      throw new TypeError(`${fn} is not a function`);
    }
    if (thisArg !== undefined) fn = fn.bind(thisArg);

    for (const [key, value] of this) {
      fn(value, key, this);
    }

    return this;
  }
  public tap(fn: (collection: this) => void): this;
  public tap<T>(fn: (this: T, collection: this) => void, thisArg: T): this;
  public tap(fn: (collection: this) => void, thisArg?: unknown): this {
    if (typeof fn !== "function") {
      throw new TypeError(`${fn} is not a function`);
    }
    if (thisArg !== undefined) fn = fn.bind(thisArg);
    fn(this);
    return this;
  }
  public clone(): Collection<K, V> {
    return new this.constructor[Symbol.species](this);
  }
  public concat(...collections: ReadonlyCollection<K, V>[]) {
    const newColl = this.clone();
    for (const coll of collections) {
      for (const [key, val] of coll) newColl.set(key, val);
    }

    return newColl;
  }
  public equals(collection: ReadonlyCollection<K, V>) {
    if (!collection) return false; // runtime check
    if (this === collection) return true;
    if (this.size !== collection.size) return false;
    for (const [key, value] of this) {
      if (!collection.has(key) || value !== collection.get(key)) {
        return false;
      }
    }

    return true;
  }
  public sort(compareFunction: Comparator<K, V> = Collection.defaultSort) {
    const entries = [...this.entries()];
    entries.sort((a, b): number => compareFunction(a[1], b[1], a[0], b[0]));

    // Perform clean-up
    super.clear();

    // Set the new entries
    for (const [key, value] of entries) {
      super.set(key, value);
    }

    return this;
  }
  public intersect<T>(other: ReadonlyCollection<K, T>): Collection<K, T> {
    const coll = new this.constructor[Symbol.species]<K, T>();
    for (const [key, value] of other) {
      if (this.has(key) && Object.is(value, this.get(key))) {
        coll.set(key, value);
      }
    }

    return coll;
  }
  public subtract<T>(other: ReadonlyCollection<K, T>): Collection<K, V> {
    const coll = new this.constructor[Symbol.species]<K, V>();
    for (const [key, value] of this) {
      if (!other.has(key) || !Object.is(value, other.get(key))) {
        coll.set(key, value);
      }
    }

    return coll;
  }
  public difference<T>(other: ReadonlyCollection<K, T>): Collection<K, T | V> {
    const coll = new this.constructor[Symbol.species]<K, T | V>();
    for (const [key, value] of other) {
      if (!this.has(key)) coll.set(key, value);
    }

    for (const [key, value] of this) {
      if (!other.has(key)) coll.set(key, value);
    }

    return coll;
  }
  public merge<T, R>(
    other: ReadonlyCollection<K, T>,
    whenInSelf: (value: V, key: K) => Keep<R>,
    whenInOther: (valueOther: T, key: K) => Keep<R>,
    whenInBoth: (value: V, valueOther: T, key: K) => Keep<R>,
  ): Collection<K, R> {
    const coll = new this.constructor[Symbol.species]<K, R>();
    const keys = new Set([...this.keys(), ...other.keys()]);

    for (const key of keys) {
      const hasInSelf = this.has(key);
      const hasInOther = other.has(key);

      if (hasInSelf && hasInOther) {
        const result = whenInBoth(this.get(key)!, other.get(key)!, key);
        if (result.keep) coll.set(key, result.value);
      } else if (hasInSelf) {
        const result = whenInSelf(this.get(key)!, key);
        if (result.keep) coll.set(key, result.value);
      } else if (hasInOther) {
        const result = whenInOther(other.get(key)!, key);
        if (result.keep) coll.set(key, result.value);
      }
    }

    return coll;
  }
  public sorted(compareFunction: Comparator<K, V> = Collection.defaultSort) {
    return new this.constructor[Symbol.species](this).sort((av, bv, ak, bk) =>
      compareFunction(av, bv, ak, bk)
    );
  }

  public toJSON() {
    return [...this.values()];
  }

  private static defaultSort<V>(firstValue: V, secondValue: V): number {
    return Number(firstValue > secondValue) ||
      Number(firstValue === secondValue) - 1;
  }
  public static combineEntries<K, V>(
    entries: Iterable<[K, V]>,
    combine: (firstValue: V, secondValue: V, key: K) => V,
  ): Collection<K, V> {
    const coll = new Collection<K, V>();
    for (const [key, value] of entries) {
      if (coll.has(key)) {
        coll.set(key, combine(coll.get(key)!, value, key));
      } else {
        coll.set(key, value);
      }
    }

    return coll;
  }
}

export type Keep<V> = { keep: false } | { keep: true; value: V };
export type Comparator<K, V> = (
  firstValue: V,
  secondValue: V,
  firstKey: K,
  secondKey: K,
) => number;
