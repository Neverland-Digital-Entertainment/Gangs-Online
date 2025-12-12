import { Server } from "colyseus";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { GameRoom } from "./rooms/GameRoom";

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

const gameServer = new Server({
    server: httpServer,
});

gameServer.define("game_room", GameRoom);

// Listen on all network interfaces (0.0.0.0)
httpServer.listen(port, "0.0.0.0", () => {
    console.log(`[Gangs Online] Server is listening on:`);
    console.log(`  - Local:   ws://localhost:${port}`);
    console.log(`  - Network: ws://0.0.0.0:${port}`);
    console.log(`  - Ready for remote connections!`);
});
