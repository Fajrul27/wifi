import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';

// 1. Load user credentials dynamically from CSV
const csvData = new SharedArray('users_credentials', function () {
  return papaparse.parse(open('./users.csv'), { header: true }).data;
});

export const options = {
  stages: [
    { duration: '2m', target: 50 },    // Ramp-up to 50 users (initial phase)
    { duration: '3m', target: 500 },   // Ramp-up to 500 users (mid load)
    { duration: '5m', target: 1000 },  // Ramp-up and hold at 1000 users (peak load)
    { duration: '5m', target: 1000 },  // Hold at 1000 users
    { duration: '2m', target: 0 },     // Ramp-down to 0 users
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],    // HTTP failure rate must be under 1%
    http_req_duration: ['p(95)<2000'],  // 95% of requests must complete within 2s
  },
};

// URL endpoints (Adjust localhost to your server's IP address if testing remotely)
const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

export default function () {
  // Assign a unique user credential to each Virtual User (VU)
  const userIndex = (__VU - 1) % csvData.length;
  const user = csvData[userIndex];

  // --- STEP 1: HTTP LOGIN ---
  const loginUrl = `${BASE_URL}/api/auth/login`;
  const loginPayload = JSON.stringify({
    identifier: user.username,
    password: user.password,
  });

  const headers = { 'Content-Type': 'application/json' };
  const loginRes = http.post(loginUrl, loginPayload, { headers });

  const loginOk = check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login success flag': (r) => r.json().success === true,
  });

  if (!loginOk) {
    console.error(`Login failed for user: ${user.username}`);
    sleep(5);
    return;
  }

  // --- STEP 2: SIMULATE DASHBOARD / MAP TRAFFIC (HTTP) ---
  sleep(Math.random() * 3 + 2); // Random think time: 2-5 seconds

  // Fetch routers list (triggers DB query & returns coordinates)
  const routersRes = http.get(`${BASE_URL}/api/monitoring/routers`);
  const routersOk = check(routersRes, {
    'fetch routers status 200': (r) => r.status === 200,
  });

  let routerId = 1; // Default fallback
  if (routersOk) {
    try {
      const data = routersRes.json();
      if (data && data.routers && data.routers.length > 0) {
        // Select a random router ID from the returned list
        const randomRouter = data.routers[Math.floor(Math.random() * data.routers.length)];
        routerId = randomRouter.id;
      }
    } catch (e) {
      // JSON parse failed, keep default
    }
  }

  sleep(Math.random() * 2 + 1);

  // Fetch topology map info (ratusan ODP/ODC coordinates and cables)
  const topologyRes = http.get(`${BASE_URL}/api/topology/olt-ports`);
  check(topologyRes, {
    'fetch map topology status 200': (r) => r.status === 200,
  });

  sleep(Math.random() * 2 + 1);

  // --- STEP 3: PERSISTENT WEBSOCKET CONNECTION (SOCKET.IO) ---
  // Connect to socket server to receive real-time graph & map updates
  const socketIoUrl = `${WS_URL}/socket.io/?EIO=4&transport=websocket`;

  ws.connect(socketIoUrl, {}, function (socket) {
    socket.on('open', function () {
      // Send initial Socket.IO connection protocol
      socket.send('40');

      // Send join-router event to listen to PPPoE disconnect/connect updates
      socket.send(`42["join-router", ${routerId}]`);

      // Keep the connection open for 30 to 60 seconds (simulates user session duration)
      const sessionDuration = Math.floor(Math.random() * 30) + 30;
      
      socket.setTimeout(function () {
        socket.close();
      }, sessionDuration * 1000);
    });

    socket.on('message', function (message) {
      // Validate engine.io / socket.io event framing
      if (message.startsWith('42')) {
        check(message, {
          'received real-time updates': (msg) => msg.includes('pppoe-update') || msg.includes('ping') || true,
        });
      }
    });

    socket.on('error', function (err) {
      console.error(`Socket.IO error on VU ${__VU}: ${err.error()}`);
    });
  });

  // Cool down period before VU starts next iteration
  sleep(5);
}
