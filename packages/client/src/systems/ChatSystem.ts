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
     * 創建聊天輸入框（Mobile-friendly）
     */
    createChatInput(): void {
        const input = new GUI.InputText();

        // 響應式寬度：手機上佔 70%，桌面上最大 400px
        const isMobile = window.innerWidth < 768;
        input.width = isMobile ? "70%" : "400px";
        input.maxWidth = "400px";
        input.height = isMobile ? "50px" : "40px"; // 手機上更高以方便觸控

        input.text = "";
        input.color = "white";
        input.background = "rgba(0,0,0,0.5)";
        input.placeholderText = "Press Enter to Chat...";
        input.focusedBackground = "rgba(0,0,0,0.8)";
        input.fontSize = isMobile ? 16 : 14; // 手機上字體稍大
        input.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        input.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        input.left = isMobile ? "5%" : "20px";
        input.top = isMobile ? "-10px" : "-20px";
        input.paddingLeft = "10px";
        input.paddingRight = "10px";

        // Send on Enter
        input.onKeyboardEventProcessedObservable.add((ev) => {
            if (ev.key === "Enter" && input.text) {
                this.room.send("chat", input.text);
                input.text = "";
            }
        });

        this.uiTexture.addControl(input);

        // 視窗大小調整時重新計算
        window.addEventListener("resize", () => {
            const isMobileNow = window.innerWidth < 768;
            input.width = isMobileNow ? "70%" : "400px";
            input.height = isMobileNow ? "50px" : "40px";
            input.fontSize = isMobileNow ? 16 : 14;
            input.left = isMobileNow ? "5%" : "20px";
        });
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
