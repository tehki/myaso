// Localhost-only, acceptance-only M325: low-latency genuine Firefox wheel receipt.
// WebSocket is established before the W3C scroll command; neither socket packets
// nor this endpoint can inject browser inputs or mutate game/server state.
import { createHash } from "node:crypto";

export function attachM325TrustedWheelSocket(server, registry, cueRegistry = null) {
  const sockets = new Set();
  server.on("upgrade", (request, socket, head) => {
    try {
      const origin = request.headers.origin;
      const key = request.headers["sec-websocket-key"];
      const local = socket.remoteAddress === "127.0.0.1"
        || socket.remoteAddress === "::1" || socket.remoteAddress === "::ffff:127.0.0.1";
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const receiver = url.pathname === "/__myaso_m325_trusted_wheel" ? registry
        : url.pathname === "/__myaso_m35_rendered_windup" ? cueRegistry : null;
      if (!receiver
        || !local || origin !== "http://" + request.headers.host
        || request.headers.upgrade?.toLowerCase() !== "websocket"
        || request.headers["sec-websocket-version"] !== "13"
        || typeof key !== "string" || !/^[A-Za-z0-9+/]{22}==$/.test(key)) {
        socket.destroy();
        return;
      }
      const accept = createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
      let buffer = Buffer.alloc(0);
      const consume = chunk => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length > 2048) return socket.destroy();
        while (buffer.length >= 6) {
          const first = buffer[0], second = buffer[1];
          // Accept only masked, final text frames containing small JSON objects.
          if (first === 0x88) return socket.end();
          if (first !== 0x81 || (second & 0x80) === 0) return socket.destroy();
          let length = second & 127, offset = 2;
          if (length === 127) return socket.destroy();
          if (length === 126) {
            if (buffer.length < 8) return;
            length = buffer.readUInt16BE(2);
            offset = 4;
          }
          if (length > 512) return socket.destroy();
          if (buffer.length < offset + 4 + length) return;
          const mask = buffer.subarray(offset, offset + 4);
          const data = buffer.subarray(offset + 4, offset + 4 + length);
          const payload = Buffer.alloc(length);
          for (let index = 0; index < length; index++) payload[index] = data[index] ^ mask[index % 4];
          buffer = buffer.subarray(offset + 4 + length);
          try {
            const packet = JSON.parse(payload.toString("utf8"));
            receiver.receive(packet); // Each registry validates its own single-use actor/event token.
          } catch {
            socket.destroy();
            return;
          }
        }
      };
      socket.on("data", consume);
      socket.on("error", () => socket.destroy());
      if (head.length) consume(head);
    } catch {
      socket.destroy();
    }
  });
  // Node http.Server.close() does not drain upgraded WebSocket sockets.
  // The acceptance harness must destroy only its own local proof channels.
  return () => { for (const socket of sockets) socket.destroy(); sockets.clear(); };
}
