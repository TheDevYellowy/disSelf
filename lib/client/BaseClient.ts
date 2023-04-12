import { EventEmitter } from "https://deno.land/std@0.177.0/node/events.ts";
import { ClientOptions } from "../interfaces/interfaces.ts";

import Options from "../util/Options.ts";

export class BaseClient extends EventEmitter {
  options: ClientOptions;
  constructor(options: ClientOptions) {
    super();
    if (typeof options.captchaSolver === "function") {
      options.captchaService = "custom";
    }

    this.options = { ...Options.createDefault(), ...options };
  }

  incrementMaxListeners() {
    const maxListeners = this.getMaxListeners();
    if (maxListeners !== 0) {
      this.setMaxListeners(maxListeners + 1);
    }
  }

  decrementMaxListeners() {
    const maxListeners = this.getMaxListeners();
    if (maxListeners !== 0) {
      this.setMaxListeners(maxListeners - 1);
    }
  }
}
