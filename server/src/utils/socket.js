const WebSocket = require("ws");

const wsPort = process.env.WS_PORT || 5050;
const wss = new WebSocket.Server({ port: wsPort });

console.log(`⚡ WebSocket Server running on port ${wsPort}`);

let clients = [];

wss.on("connection", (ws) => {
  clients.push(ws);

  ws.on("message", (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === "join") {
        ws.routerId = Number(parsed.routerId);
      }
    } catch (e) {}
  });

  ws.on("close", () => {
    clients = clients.filter((c) => c !== ws);
  });
});

function broadcast(data) {
  clients.forEach((client) => {
    if (client.readyState === 1) {
      if (data && data.routerId !== undefined) {
        if (Number(client.routerId) === Number(data.routerId)) {
          client.send(JSON.stringify(data));
        }
      } else {
        client.send(JSON.stringify(data));
      }
    }
  });
}

module.exports = { wss, broadcast };