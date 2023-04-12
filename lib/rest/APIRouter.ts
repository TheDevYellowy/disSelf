import type { RESTManager } from "./RESTManager.ts";

const noop = () => {};
const methods = ["get", "post", "delete", "patch", "put"];
const reflectors = [
  "toString",
  "valueOf",
  "inspect",
  "constructor",
  Symbol.toPrimitive,
  Symbol.for("nodejs.util.inspect.custom"),
];

function buildRoute(
  manager: RESTManager,
) {
  const route = [""];
  const handler = {
    get(_target: any, name: string): any {
      if (reflectors.includes(name)) return () => route.join("/");
      if (methods.includes(name)) {
        const routeBucket: string[] = [];
        for (let i = 0; i < route.length; i++) {
          if (route[i - 1] === "reactions") break;
          if (
            /\d{16,19}/g.test(route[i]) && !/channels|guilds/.test(route[i - 1])
          ) routeBucket.push(":id");
          else routeBucket.push(route[i]);
        }
        return (options: any) =>
          manager.request(
            name,
            route.join("/"),
            Object.assign(
              {
                versioned: manager.versioned,
                route: routeBucket.join("/"),
              },
              options,
            ),
          );
      }
      route.push(name);
      return new Proxy(noop, handler);
    },
    apply(_target: any, _: any, args: any[]): any {
      route.push(...args.filter((x: null) => x != null));
      return new Proxy(noop, handler);
    },
  };
  return new Proxy(noop, handler);
}

export default buildRoute;
