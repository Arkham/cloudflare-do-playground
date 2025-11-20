import { DurableObject, RpcTarget } from "cloudflare:workers";

/**
 * Create an RpcDO class that extends RpcTarget
 * Use this class to set the Durable Object metadata
 * Pass the metadata in the Durable Object methods
 * @param mainDo - The main Durable Object class
 * @param doIdentifier - The identifier of the Durable Object
 */
export class RpcDO extends RpcTarget {
  constructor(private mainDo: MyDurableObject, private doIdentifier: string) {
    super();
  }

  /**
   * Pass the user's name to the Durable Object method
   * @param userName - The user's name to pass to the Durable Object method
   */
  async computeMessage(userName: string) {
    // Call the Durable Object method and pass the user's name and the Durable Object identifier
    return this.mainDo.computeMessage(userName, this.doIdentifier);
  }

  /**
   * Call the Durable Object method without using the Durable Object identifier
   * @param userName - The user's name to pass to the Durable Object method
   */
  async simpleGreeting(userName: string) {
    return this.mainDo.simpleGreeting(userName);
  }

  /**
   * Get the initialization timestamp
   */
  async getInitializedAt() {
    return this.mainDo.getInitializedAt();
  }
}

/**
 * Create a Durable Object class
 * You can use the RpcDO class to set the Durable Object metadata
 */
export class MyDurableObject extends DurableObject {
  private initializedAt: string;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    // Store the timestamp when this Durable Object was initialized
    this.initializedAt = new Date().toISOString();
    console.log(`Durable Object initialized at: ${this.initializedAt}`);
  }

  /**
   * Initialize the RpcDO class
   * You can set the Durable Object metadata here
   * It returns an instance of the RpcDO class
   * @param doIdentifier - The identifier of the Durable Object
   */
  async setMetaData(doIdentifier: string) {
    // Use DO storage to store the Durable Object identifier
    await this.ctx.storage.put("doIdentifier", doIdentifier);
    return new RpcDO(this, doIdentifier);
  }

  /**
   * Function that computes a greeting message using the user's name and DO identifier
   * @param userName - The user's name to include in the greeting
   * @param doIdentifier - The identifier of the Durable Object
   */
  async computeMessage(userName: string, doIdentifier: string) {
    // Get the DO identifier from storage
    const storedIdentifier = await this.ctx.storage.get<string>("doIdentifier");
    console.log({
      userName: userName,
      durableObjectIdentifier: storedIdentifier,
      initializedAt: this.initializedAt,
    });
    return `Hello, ${userName}! The identifier of this DO is ${doIdentifier}`;
  }

  /**
   * Function that is not in the RpcTarget
   * Not every function has to be in the RpcTarget
   */
  private async notInRpcTarget() {
    return "This is not in the RpcTarget";
  }

  /**
   * Function that takes the user's name and does not use the Durable Object identifier
   * @param userName - The user's name to include in the greeting
   */
  async simpleGreeting(userName: string) {
    // Call the private function that is not in the RpcTarget
    console.log(await this.notInRpcTarget());

    return `Hello, ${userName}! This doesn't use the DO identifier.`;
  }

  /**
   * Get the initialization timestamp
   */
  async getInitializedAt() {
    return this.initializedAt;
  }
}
