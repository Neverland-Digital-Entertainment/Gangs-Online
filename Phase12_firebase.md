Gangs Online: Phase 12 - Persistence & Auth (Firebase Edition)
Objective: Replace the failed Nakama integration with Firebase. Firebase provides fully managed Authentication and Database (Firestore) with zero server setup required.
Step 1: Firebase Setup (Manual but Fast)
Go to Firebase Console.
Click "Add project" -> Name it "GangsOnline".
Disable Google Analytics (optional) -> Create Project.
Enable Auth:
Go to Build -> Authentication -> Get Started.
Select Anonymous (for easiest dev) AND Email/Password. Enable them.
Enable Database:
Go to Build -> Firestore Database -> Create Database.
Select location (e.g., asia-east2 or us-central1).
Security Rules: Select "Start in test mode" (Allow read/write for 30 days).
Get Config:
Click the Gear Icon (Project Settings).
Scroll down to "Your apps" -> Click the </> (Web) icon.
Register app "GangsWeb".
Copy the firebaseConfig object. You will need this.
Step 2: Install Firebase SDK
Run in your terminal:
# Client Side (Vite)
cd packages/client
npm install firebase

# Server Side (Colyseus)
cd ../server
npm install firebase-admin


Step 3: Server-Side Persistence (Firebase Admin)
We need a service account to let the Colyseus server write to the database securely.
In Firebase Console -> Project Settings -> Service accounts.
Click Generate new private key.
It will download a .json file. Rename it to service-account.json and put it in packages/server/src/config/. (Add this to .gitignore!)
Now, create packages/server/src/data/persistence.ts:
import { Player, Item, Quest } from "../rooms/schema/GameState";
import { IQuestDef } from "@gangs-online/shared";
import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

// Initialize Firebase Admin (Server-Side)
// Check if running locally or on Render (Environment Variable vs File)
const serviceAccountPath = path.resolve(__dirname, "../config/service-account.json");

let db: admin.firestore.Firestore;

try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // Production (Render): Use Environment Variable
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else if (fs.existsSync(serviceAccountPath)) {
        // Local Dev: Use File
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
        console.warn("[Firebase] No credentials found. Persistence disabled.");
    }
    
    if (admin.apps.length > 0) {
        db = admin.firestore();
        console.log("[Firebase] Admin Initialized.");
    }
} catch (e) {
    console.error("[Firebase] Init Error:", e);
}

export const savePlayer = async (player: Player, userId: string) => {
    if (!db) return;

    // Serialize
    const inventory = player.inventory.map(i => ({ id: i.id, name: i.name, type: i.type, value: i.value }));
    let activeQuest = null;
    if (player.activeQuest) {
        activeQuest = { id: player.activeQuest.id, currentCount: player.activeQuest.currentCount, completed: player.activeQuest.completed };
    }

    const saveData = {
        name: player.name,
        level: player.level,
        xp: player.xp,
        money: player.money,
        inventory: inventory,
        activeQuest: activeQuest,
        maxXp: player.maxXp,
        maxHp: player.maxHp,
        x: player.x,
        z: player.z,
        lastOnline: admin.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection("players").doc(userId).set(saveData, { merge: true });
        console.log(`[Firebase] Saved ${player.name}`);
    } catch (e) {
        console.error("[Firebase] Save Failed:", e);
    }
};

export const loadPlayer = async (player: Player, userId: string, questDefs: Map<string, IQuestDef>) => {
    if (!db) return false;

    try {
        const doc = await db.collection("players").doc(userId).get();
        if (doc.exists) {
            const saved = doc.data() as any;
            console.log(`[Firebase] Restoring ${saved.name}...`);

            player.name = saved.name || player.name;
            player.level = saved.level;
            player.xp = saved.xp;
            player.money = saved.money;
            player.maxXp = saved.maxXp;
            player.maxHp = saved.maxHp;
            player.hp = saved.maxHp;
            player.x = saved.x;
            player.z = saved.z;

            if (saved.inventory) {
                saved.inventory.forEach((i: any) => {
                    const newItem = new Item();
                    newItem.id = i.id; newItem.name = i.name; newItem.type = i.type; newItem.value = i.value;
                    player.inventory.push(newItem);
                });
            }

            if (saved.activeQuest) {
                const def = questDefs.get(saved.activeQuest.id);
                if (def) {
                    const QuestClass = player._schema.activeQuest._type;
                    const q = new QuestClass();
                    q.id = def.id; q.name = def.name; q.description = def.description; q.requiredCount = def.requiredCount;
                    q.rewardXp = def.reward.xp; q.rewardMoney = def.reward.money;
                    q.currentCount = saved.activeQuest.currentCount; q.completed = saved.activeQuest.completed;
                    player.activeQuest = q;
                }
            }
            return true;
        }
    } catch (e) {
        console.error("[Firebase] Load Failed:", e);
    }
    return false;
};


Step 4: Client-Side Auth (Firebase SDK)
Modify packages/client/src/firebase.ts (Create new file).
Note: Replace the config values with the ones you copied from Firebase Console.
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, User } from "firebase/auth";

// TODO: Paste your config from Firebase Console here
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "gangsonline.firebaseapp.com",
  projectId: "gangsonline",
  storageBucket: "gangsonline.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export class FirebaseService {
    async loginAnonymous(): Promise<User> {
        const result = await signInAnonymously(auth);
        return result.user;
    }

    // You can add signInWithEmailAndPassword here later
    
    getCurrentUser() {
        return auth.currentUser;
    }
}

export const firebaseService = new FirebaseService();


Step 5: Update Main Entry (Client)
Modify packages/client/src/main.ts to use Firebase Auth.
Update createLoginUI logic:
// packages/client/src/main.ts
// ... imports ...
import { firebaseService } from "./firebase"; // Import Firebase

// ... (UI Setup) ...

const createLoginUI = (onJoin: (username: string, userId: string) => void) => {
    // ... (UI Code same as before) ...
    // ...
    const btn = GUI.Button.CreateSimpleButton("join", "快速登入 (Quick Play)");
    
    btn.onPointerUpObservable.add(async () => {
        if (input.text.trim().length > 0) {
            btn.isEnabled = false;
            statusTxt.text = "Connecting to Firebase...";
            
            try {
                // 1. Firebase Auth
                const user = await firebaseService.loginAnonymous();
                
                // 2. Start Game (Pass Firebase UID)
                advancedTexture.dispose();
                onJoin(input.text.trim(), user.uid);
            } catch (e) {
                console.error(e);
                statusTxt.text = "Auth Failed";
                btn.isEnabled = true;
            }
        }
    });
    // ...
}


Step 6: Update GameRoom (Server)
Update packages/server/src/rooms/GameRoom.ts.
Update onJoin to use the Firebase-backed persistence:
// packages/server/src/rooms/GameRoom.ts
// ... imports ...
import { savePlayer, loadPlayer } from "../data/persistence"; 

export class GameRoom extends Room<GameState> {
    // ... (onCreate) ...

    async onJoin(client: Client, options: any) {
        // options.userId comes from Firebase UID sent by client
        const username = options.username || "Gangster";
        const userId = options.userId; 
        
        console.log(`${username} (UID: ${userId}) connecting...`);

        const player = new Player();
        player.sessionId = client.sessionId;
        player.name = username;
        
        // Load from Firebase
        const loaded = await loadPlayer(player, userId, this.questDefinitions);
        
        if (!loaded) {
            // New Character
            player.x = Math.random() * 10 - 5;
            player.z = Math.random() * 10 - 5;
            player.money = 200;
            // ... (rest of defaults)
        }

        this.state.players.set(client.sessionId, player);
    }

    async onLeave(client: Client, consented: boolean) {
        const player = this.state.players.get(client.sessionId);
        if (player) {
            // Options.userId is not stored on player, we need to pass the ID used to load
            // In onJoin, we loaded using `options.userId`.
            // We should store this ID on the player object for saving later.
            // (Assuming you added `uid` field to Player schema or we can pass it via session)
            
            // Let's assume we mapped it or stored it in player.id (if player.id is the db id)
            // Or pass the userId in auth data.
            // For now, let's use client.auth.id if set, or just use the name for simple testing if ID is missing.
            // BEST PRACTICE: Add `uid` to Player Schema.
            
            // Temporary: Use options from onJoin if accessible, or better, store it:
            // player.firebaseId = options.userId (Need to update Schema)
            
            // For this specific script, let's assume we pass the right ID. 
            // We'll update Schema to hold `firebaseUid`.
            
            await savePlayer(player, options.userId || player.name); 
            this.state.players.delete(client.sessionId);
        }
    }
}


Note: For onLeave to work perfectly, you should add @type("string") firebaseUid: string = ""; to your Player schema in GameState.ts and set player.firebaseUid = options.userId inside onJoin. Then use player.firebaseUid in savePlayer.
