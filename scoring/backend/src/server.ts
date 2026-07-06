import http from "http";
import { createApp } from "./app";
import { initSocket } from "./lib/socket";

const PORT = process.env.PORT || 4000;

const app = createApp();
const server = http.createServer(app);

initSocket(server).then(() => {
  server.listen(PORT, () => {
    console.log(`Scoring API running on http://localhost:${PORT}`);
  });
});
