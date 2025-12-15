import { Server } from "colyseus";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { GameRoom } from "./rooms/GameRoom.js";
import { GAME_VERSION } from "@gangs-online/shared";

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json());

// Version API endpoint (0.7.1)
app.get("/version", (req, res) => {
    res.json({ version: GAME_VERSION });
});

const httpServer = createServer(app);

const gameServer = new Server({
    server: httpServer,
});

gameServer.define("game_room", GameRoom);

// Listen on all network interfaces (0.0.0.0)
httpServer.listen(port, "0.0.0.0", () => {
    console.log(`[Gangs Online] Server v${GAME_VERSION} is listening on:`);
    console.log(`  - Local:   ws://localhost:${port}`);
    console.log(`  - Network: ws://0.0.0.0:${port}`);
    console.log(`  - Version API: http://0.0.0.0:${port}/version`);
    console.log(`  - Ready for remote connections!`);
});
