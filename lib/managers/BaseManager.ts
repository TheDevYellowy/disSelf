import type Client from "../client/Client.ts";

export default abstract class BaseManager {
  client: Client;
  constructor(client: Client) {
    this.client = client;
  }
}
