import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import * as Client from "colyseus.js";
import { ChatMessageType } from "@gangs-online/shared";

/**
 * 聊天系統 (Phase 13: 支援多頻道)
 * 負責聊天輸入框和聊天氣泡的顯示
 */
export class ChatSystem {
    private room: Client.Room;
    private scene: BABYLON.Scene;
    private uiTexture: GUI.AdvancedDynamicTexture;

    // Phase 13: 當前頻道
    private currentChannel: ChatMessageType = "GLOBAL";

    // Phase 13: 幫會 ID（用於判斷是否可以使用幫會頻道）
    private guildId: string = "";

    constructor(room: Client.Room, scene: BABYLON.Scene, uiTexture: GUI.AdvancedDynamicTexture) {
        this.room = room;
        this.scene = scene;
        this.uiTexture = uiTexture;
    }

    /**
     * 設置當前頻道
     */
    setChannel(channel: ChatMessageType): void {
        // 如果沒有幫會，不能切換到幫會頻道
        if (channel === "GUILD" && !this.guildId) {
            console.log("[ChatSystem] 無法切換到幫會頻道：你不在任何幫會中");
            return;
        }
        this.currentChannel = channel;
        console.log(`[ChatSystem] 切換到 ${channel} 頻道`);
    }

    /**
     * 獲取當前頻道
     */
    getChannel(): ChatMessageType {
        return this.currentChannel;
    }

    /**
     * 更新幫會 ID
     */
    updateGuildId(guildId: string): void {
        this.guildId = guildId;
        // 如果離開幫會，自動切回全服頻道
        if (!guildId && this.currentChannel === "GUILD") {
            this.currentChannel = "GLOBAL";
        }
    }

    /**
     * 檢查是否有幫會
     */
    hasGuild(): boolean {
        return this.guildId !== "";
    }

    /**
     * 創建聊天輸入框（Mobile-friendly，帶發送按鈕）
     */
    createChatInput(): void {
        const isMobile = window.innerWidth < 768;

        // 輸入框
        const input = new GUI.InputText();
        input.width = isMobile ? "calc(70% - 60px)" : "350px"; // 為按鈕留出空間
        input.maxWidth = "350px";
        input.height = isMobile ? "50px" : "40px";
        input.text = "";
        input.color = "white";
        input.background = "rgba(0,0,0,0.5)";
        input.placeholderText = isMobile ? "輸入訊息..." : "Press Enter to Chat...";
        input.focusedBackground = "rgba(0,0,0,0.8)";
        input.fontSize = isMobile ? 16 : 14;
        input.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        input.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        input.left = isMobile ? "5%" : "20px";
        input.top = isMobile ? "-10px" : "-20px";
        input.paddingLeft = "10px";
        input.paddingRight = "10px";

        // 發送按鈕
        const sendButton = GUI.Button.CreateSimpleButton("sendBtn", "➤");
        sendButton.width = "50px";
        sendButton.height = isMobile ? "50px" : "40px";
        sendButton.color = "white";
        sendButton.fontSize = isMobile ? 24 : 20;
        sendButton.background = "rgba(52, 152, 219, 0.7)"; // 藍色背景
        sendButton.hoverCursor = "pointer";
        sendButton.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        sendButton.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;

        // 按鈕位置：在輸入框右邊
        if (isMobile) {
            sendButton.left = "calc(5% + 70% - 60px + 10px)"; // 輸入框後面
        } else {
            sendButton.left = "380px"; // 350px + 20px(起始位置) + 10px(間距)
        }
        sendButton.top = isMobile ? "-10px" : "-20px";

        // Phase 13: 發送訊息的共用函數（支援頻道）
        const sendMessage = () => {
            if (input.text.trim()) {
                // 根據當前頻道發送不同格式的訊息
                this.room.send("chat", {
                    text: input.text,
                    type: this.currentChannel
                });
                input.text = "";
            }
        };

        // Enter 鍵發送
        input.onKeyboardEventProcessedObservable.add((ev) => {
            if (ev.key === "Enter") {
                sendMessage();
            }
        });

        // 點擊按鈕發送
        sendButton.onPointerUpObservable.add(() => {
            sendMessage();
        });

        // Hover 效果
        sendButton.onPointerEnterObservable.add(() => {
            sendButton.background = "rgba(52, 152, 219, 1)";
        });

        sendButton.onPointerOutObservable.add(() => {
            sendButton.background = "rgba(52, 152, 219, 0.7)";
        });

        this.uiTexture.addControl(input);
        this.uiTexture.addControl(sendButton);

        // 視窗大小調整時重新計算
        window.addEventListener("resize", () => {
            const isMobileNow = window.innerWidth < 768;

            // 更新輸入框
            input.width = isMobileNow ? "calc(70% - 60px)" : "350px";
            input.height = isMobileNow ? "50px" : "40px";
            input.fontSize = isMobileNow ? 16 : 14;
            input.left = isMobileNow ? "5%" : "20px";
            input.placeholderText = isMobileNow ? "輸入訊息..." : "Press Enter to Chat...";

            // 更新按鈕
            sendButton.height = isMobileNow ? "50px" : "40px";
            sendButton.fontSize = isMobileNow ? 24 : 20;

            if (isMobileNow) {
                sendButton.left = "calc(5% + 70% - 60px + 10px)";
            } else {
                sendButton.left = "380px";
            }
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
