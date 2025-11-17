/**
 * ChatRoom Durable Object
 *
 * A chat room that demonstrates:
 * - WebSocket connections
 * - Broadcasting messages to multiple clients
 * - Message history storage
 * - Connection state management
 */

import { DurableObject } from "cloudflare:workers";

interface Message {
  id: string;
  text: string;
  timestamp: number;
  username: string;
}

export class ChatRoom extends DurableObject<Record<string, never>> {
  private sessions: Set<WebSocket>;

  constructor(ctx: DurableObjectState, env: Record<string, never>) {
    super(ctx, env);
    this.sessions = new Set();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (url.pathname === "/chat/ws") {
      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      this.handleSession(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // Get message history
    if (url.pathname === "/chat/messages" && request.method === "GET") {
      const messages =
        (await this.ctx.storage.get<Message[]>("messages")) ?? [];
      return new Response(JSON.stringify({ messages }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Send message (HTTP API)
    if (url.pathname === "/chat/send" && request.method === "POST") {
      const { text, username } = (await request.json()) as {
        text: string;
        username: string;
      };

      if (!text || !username) {
        return new Response(
          JSON.stringify({ error: "text and username required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const message: Message = {
        id: crypto.randomUUID(),
        text,
        username,
        timestamp: Date.now(),
      };

      await this.addMessage(message);
      this.broadcast(JSON.stringify({ type: "message", message }));

      return new Response(JSON.stringify({ success: true, message }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      "Chat Room endpoint. Try /chat/ws for WebSocket or /chat/messages",
      {
        status: 404,
      }
    );
  }

  private handleSession(webSocket: WebSocket) {
    webSocket.accept();
    this.sessions.add(webSocket);

    webSocket.addEventListener("message", async (event) => {
      try {
        const data = JSON.parse(event.data as string);

        if (data.type === "message") {
          const message: Message = {
            id: crypto.randomUUID(),
            text: data.text,
            username: data.username || "Anonymous",
            timestamp: Date.now(),
          };

          await this.addMessage(message);
          this.broadcast(JSON.stringify({ type: "message", message }));
        }
      } catch (error) {
        webSocket.send(
          JSON.stringify({
            type: "error",
            message: "Invalid message format",
          })
        );
      }
    });

    webSocket.addEventListener("close", () => {
      this.sessions.delete(webSocket);
    });

    webSocket.addEventListener("error", () => {
      this.sessions.delete(webSocket);
    });

    // Send connection confirmation
    webSocket.send(
      JSON.stringify({
        type: "connected",
        message: "Connected to chat room",
        sessionCount: this.sessions.size,
      })
    );

    // Broadcast new connection to other clients
    this.broadcast(
      JSON.stringify({
        type: "user-joined",
        sessionCount: this.sessions.size,
      }),
      webSocket
    );
  }

  private async addMessage(message: Message) {
    const messages = (await this.ctx.storage.get<Message[]>("messages")) ?? [];
    messages.push(message);

    // Keep only last 100 messages
    if (messages.length > 100) {
      messages.shift();
    }

    await this.ctx.storage.put("messages", messages);
  }

  private broadcast(message: string, exclude?: WebSocket) {
    this.sessions.forEach((session) => {
      if (session !== exclude) {
        try {
          session.send(message);
        } catch (error) {
          // Remove broken connections
          this.sessions.delete(session);
        }
      }
    });
  }
}
