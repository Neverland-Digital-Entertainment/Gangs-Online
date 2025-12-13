import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import * as Client from "colyseus.js";

/**
 * 聊天系統
 * 負責聊天輸入框和聊天氣泡的顯示
 */
export class ChatSystem {
    private room: Client.Room;
    private scene: BABYLON.Scene;
    private uiTexture: GUI.AdvancedDynamicTexture;

    constructor(room: Client.Room, scene: BABYLON.Scene, uiTexture: GUI.AdvancedDynamicTexture) {
        this.room = room;
        this.scene = scene;
        this.uiTexture = uiTexture;
    }

    /**
     * 創建聊天輸入框
     */
    createChatInput(): void {
        const input = new GUI.InputText();
        input.width = "300px";
        input.height = "40px";
        input.text = "";
        input.color = "white";
        input.background = "rgba(0,0,0,0.5)";
        input.placeholderText = "Press Enter to Chat...";
        input.focusedBackground = "rgba(0,0,0,0.8)";
        input.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        input.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        input.left = "20px";
        input.top = "-20px";

        // Send on Enter
        input.onKeyboardEventProcessedObservable.add((ev) => {
            if (ev.key === "Enter" && input.text) {
                this.room.send("chat", input.text);
                input.text = "";
            }
        });

        this.uiTexture.addControl(input);
    }

    /**
     * 創建聊天氣泡
     */
    createChatBubble(mesh: BABYLON.AbstractMesh, text: string): void {
        const rect = new GUI.Rectangle();
        rect.width = "150px";
        rect.height = "40px";
        rect.cornerRadius = 10;
        rect.color = "black";
        rect.thickness = 1;
        rect.background = "white";
        this.uiTexture.addControl(rect);
        rect.linkWithMesh(mesh);
        rect.linkOffsetY = -180; // Higher than name tag

        const label = new GUI.TextBlock();
        label.text = text;
        label.fontSize = 12;
        label.textWrapping = true;
        label.color = "black";
        rect.addControl(label);

        // Fade out and destroy
        setTimeout(() => {
            rect.dispose();
        }, 4000);
    }
}
