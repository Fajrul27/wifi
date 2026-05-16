const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 5050 });

let clients = [];

wss.on("connection", (ws) => {
  clients.push(ws);

  ws.on("close", () => {
    clients = clients.filter((c) => c !== ws);
  });
});

function broadcast(data) {
  if (global.io && data && data.type) {
    global.io.emit(data.type, data);
  }
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data));
    }
  });
}

module.exports = { wss, broadcast };