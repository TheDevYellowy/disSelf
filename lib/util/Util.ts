import * as path from "https://deno.land/std@0.182.0/path/mod.ts";
import { Collection } from "./Collection.ts";

const has = (o: any, k: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(o, k);
const isObject = (d: any) => typeof d == "object" && d !== null;

export class Util extends null {
  static flatten(
    obj: Record<string | number | symbol, unknown>,
    props: Record<string | number | symbol, boolean | string>,
  ) {
    if (!isObject(obj)) return obj;

    const objProps = Object.keys(obj)
      .filter((k) => !k.startsWith("_"))
      .map((k) => ({ [k]: true }));

    props = objProps.length ? { ...objProps, ...props } : { ...props };

    const out = {};

    for (let [prop, newProp] of Object.entries(props)) {
      if (!newProp) continue;
      newProp = newProp === true ? prop : newProp;

      const element = obj[prop];
      const elemIsObj = isObject(element);
      const valueOf = elemIsObj && typeof element.valueOf === "function"
        ? element.valueOf()
        : null;
      const hasToJSON = elemIsObj && typeof element.toJSON === "function";

      // If it's a Collection, make the array of keys
      if (element instanceof Collection) {
        out[newProp] = Array.from(element.keys());
      } // If the valueOf is a Collection, use its array of keys
      else if (valueOf instanceof Collection) {
        out[newProp] = Array.from(valueOf.keys());
      } // If it's an array, call toJSON function on each element if present, otherwise flatten each element
      else if (Array.isArray(element)) {
        out[newProp] = element.map((e) => e.toJSON?.() ?? Util.flatten(e));
      } // If it's an object with a primitive `valueOf`, use that value
      else if (typeof valueOf !== "object") out[newProp] = valueOf;
      // If it's an object with a toJSON function, use the return value of it
      else if (hasToJSON) out[newProp] = element.toJSON();
      // If element is an object, use the flattened version of it
      else if (typeof element === "object") {
        out[newProp] = Util.flatten(element);
      } // If it's a primitive
      else if (!elemIsObj) out[newProp] = element;
    }

    return out;
  }

  static mergeDefault(def: { [x: string]: any }, given: { [x: string]: any }) {
    if (!given) return def;
    for (const key in def) {
      if (!has(given, key) || given[key] === undefined) given[key] = def[key];
      else if (given[key] === Object(given[key])) {
        given[key] = Util.mergeDefault(def[key], given[key]);
      }
    }

    return given;
  }
}
