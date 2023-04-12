import { Buffer } from "https://deno.land/std@0.177.0/node/buffer.ts";
import { isArrayBuffer } from "https://deno.land/std@0.177.0/node/internal_binding/types.ts";

const ab = new TextDecoder();

const create = (gateway: string | null, query: any = {}, ...args: any[]) => {
  if (typeof gateway !== "string") return;
  const [g, q] = gateway.split("?");
  query.encoding = "json";
  query = new URLSearchParams(query);
  if (q) new URLSearchParams(q).forEach((v, k) => query.set(k, v));
  const ws = new WebSocket(`${g}?${query}`, ...args);
  return ws;
};

const unpack = (data: any) => {
  if (typeof data !== "string") {
    data = ab.decode(data);
  }
  return JSON.parse(data);
};

export { create, unpack };
