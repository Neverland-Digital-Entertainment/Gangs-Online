import { Schema, MapSchema, type } from "@colyseus/schema";
import { PlayerData } from "@gangs-online/shared";

export class GameState extends Schema {
    @type({ map: PlayerData }) players = new MapSchema<PlayerData>();
}

export { PlayerData as Player };
