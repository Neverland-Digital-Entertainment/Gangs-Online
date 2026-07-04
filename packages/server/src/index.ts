import { Server } from "colyseus";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { GameRoom } from "./rooms/GameRoom";
import { GAME_VERSION } from "@gangs-online/shared";

const port = Number(process.env.PORT || 2567);
const app = express();

// Phase 21 安全修復：CORS 白名單（原本 cors() 沒有任何限制，任何網站都能呼叫此 API）。
// 設定 CORS_ALLOWED_ORIGINS 環境變數（逗號分隔，如正式網域、Cloudflare Pages 網址）
// 來鎖定允許的來源；尚未設定時暫時放行並印出警告，避免還沒設定就直接擋掉正式網站。
// 支援萬用字元子網域，例如 "*.gangs-online.pages.dev" 可涵蓋 Cloudflare Pages
// 每次部署都會產生的不同 hash 臨時網址（如 https://146a6b4e.gangs-online.pages.dev）
// 以及 branch 別名網址，不需要每次部署都更新白名單。
// 注意：此設定僅保護一般 HTTP API（如 /version），Colyseus 的 WebSocket 連線本身
// 不受瀏覽器同源政策限制，真正的連線身份驗證請見 GameRoom.onAuth（Firebase ID Token）。
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const isOriginAllowed = (origin: string): boolean => {
    return allowedOrigins.some((pattern) => {
        if (pattern.startsWith("*.")) {
            // "*.gangs-online.pages.dev" 比對任何以 ".gangs-online.pages.dev" 結尾的 origin
            const suffix = pattern.slice(1);
            try {
                const host = new URL(origin).host;
                return host.endsWith(suffix.replace(/^https?:\/\//, ""));
            } catch {
                return false;
            }
        }
        return origin === pattern;
    });
};

app.use(cors({
    origin: (origin, callback) => {
        // 沒有 Origin（伺服器對伺服器、curl、健康檢查等）一律放行
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0) {
            console.warn(`[CORS] ⚠️ 尚未設定 CORS_ALLOWED_ORIGINS，暫時放行來源: ${origin}（請盡快設定白名單）`);
            return callback(null, true);
        }
        if (isOriginAllowed(origin)) return callback(null, true);
        console.warn(`[CORS] 拒絕不在白名單的來源: ${origin}`);
        return callback(new Error("Not allowed by CORS"));
    },
}));
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
