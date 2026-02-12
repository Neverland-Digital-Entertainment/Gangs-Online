# Gangs Online

> **Version:** 0.20.0 — Quest Blueprint System
> **Stack:** Babylon.js 7 · Colyseus · Next.js 15 · Firebase · TypeScript

A 3D multiplayer online game set in a Hong Kong-inspired open world, featuring gang warfare, dynamic NPC systems, a quest blueprint visual editor, and a full-featured admin dashboard.

> **Note on Development:** This project was developed as a case study for AI-assisted workflow using Chinese prompts. The commit history reflects this real-world collaborative process between a native Cantonese/Mandarin speaker and the AI model.

---

## Project Structure

```
Gangs-Online/
├── packages/
│   ├── shared/              # Shared types, interfaces, and constants
│   ├── client/              # Babylon.js 3D game client
│   ├── server/              # Colyseus multiplayer game server
│   └── dashboard/main/      # Next.js admin dashboard
```

### Shared (`@gangs-online/shared`)
Single source of truth for all cross-package types, constants, and interfaces. Defines player schemas, NPC templates, quest blueprint node types, item definitions, shop interfaces, and game constants.

### Client (`@gangs-online/client`)
3D game client built with **Babylon.js 7** using an orthographic isometric camera. Handles player movement, combat, NPC interaction, dialogue UI, shop UI, and the quest blueprint UI. Communicates with the server via Colyseus WebSocket rooms.

### Server (`@gangs-online/server`)
**Colyseus** room-based multiplayer server. Manages game state synchronization, NPC spawning, combat logic, quest blueprint execution, shop transactions, progression, and Firebase persistence.

### Dashboard (`@gangs-online/dashboard/main`)
**Next.js 15** admin panel with React 19, Tailwind CSS, and Firebase integration. Provides CRUD interfaces for NPC templates/instances, items, shops, and the visual quest blueprint editor.

---

## Key Features

### Quest Blueprint System (Phase 20)
A complete quest design and execution pipeline:
- **Visual Node Editor** — Drag-and-drop quest design in the Dashboard using React Flow with 7 node types: Start, Dialogue, Choice, Task, Condition, Action, End
- **Server Execution Engine** — `QuestBlueprintManager` loads blueprints from Firebase, spawns quest NPCs at configured positions, and walks the node graph in response to player actions
- **Client Quest UI** — HTML-based UI for quest accept/decline, NPC dialogue, branching choices, task progress tracking (HUD), and reward display
- **Persistence** — Quest progress saved to Firebase; only task-node states are restored on reconnect (dialogue/choice states are discarded as non-resumable)
- **Diagnostics** — Client-visible debug reasons when quest availability checks fail

### NPC System (Phase 16-2)
- NPC templates and instances managed via Dashboard
- Dialogue tree editor with drag-and-drop reordering, inline editing, and smart defaults
- Server-driven dialogue with support for branching conversations and shop integration
- Custom 3D models (GLB) with fallback to default model

### Shop & Economy System (Phase 16-3)
- Dynamic shop system powered by Firebase (no hardcoded items)
- Shop CRUD in Dashboard with multi-select item picker
- Business hours, global inventory, per-player purchase limits, price multipliers
- Full purchase flow: client request → server validation → inventory update → response

### Combat & Progression
- Real-time PvP and PvE combat
- Level/XP progression system with rank titles
- Loot drops and inventory management
- Evil value system and prison mechanics

### Guild System (Phase 13)
- Guild creation and management
- Guild chat
- Guild-exclusive shop access

### World System (Phase 15)
- Hong Kong-inspired map with chunk-based scene loading
- Prison area with timed release mechanics
- NPC spawn positions from Firebase

### NPC Appearance System (Phase 19, In Progress)
- 3D character preview in Dashboard using Babylon.js
- 6 equipment slots with bone binding
- Gender-specific models and hairstyles
- Real-time hair/beard color modification

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **3D Engine** | Babylon.js 7.0 |
| **Multiplayer** | Colyseus 0.15 |
| **Dashboard** | Next.js 15 + React 19 + Tailwind CSS |
| **Node Editor** | React Flow (`@xyflow/react`) |
| **Database** | Firebase Firestore |
| **Auth** | Firebase Authentication |
| **Language** | TypeScript (strict) |
| **i18n** | Custom context-based (English + Traditional Chinese) |

---

## Development

### Prerequisites
- Node.js 18+
- Firebase project with Firestore enabled
- Firebase Admin SDK credentials (server)
- Firebase client config (dashboard)

### Getting Started

```bash
# Install dependencies
npm install

# Build shared package first (required by server and client)
cd packages/shared && npm run build

# Start the server
cd packages/server && npm run dev

# Start the client (in another terminal)
cd packages/client && npm run dev

# Start the dashboard (in another terminal)
cd packages/dashboard/main && npm run dev
```

### Key Patterns
- **i18n**: Uses `@/contexts/i18n-context` (not react-i18next). Keys use dot notation.
- **Services**: Singleton pattern with `getInstance()`, Firebase CRUD operations.
- **Firebase writes**: Always use `removeUndefinedFields()` before writes, `convertToDate()` for timestamps.
- **SSR safety**: Use `dynamic(() => import(...), { ssr: false })` for browser-only components (Babylon.js, React Flow).

---

## Phase History

| Phase | Feature | Status |
|-------|---------|--------|
| 20 | Quest Blueprint System (Visual Editor + Execution Engine) | ✅ Complete |
| 19 | NPC Appearance System (3D Preview) | 🚧 In Progress |
| 16.3 | Shop & Economy System | ✅ Complete |
| 16.2 | NPC Dialogue System + Dashboard Editor | ✅ Complete |
| 15 | Scene Chunk Loading + Prison System | ✅ Complete |
| 14 | Evil Value System + NPC Type Expansion | ✅ Complete |
| 13 | Guild System + Chat | ✅ Complete |
| 12 | Firebase Persistence | ✅ Complete |
| 10 | Quest System (Legacy) | ✅ Complete |
| 9 | PvE Combat + Enemy AI | ✅ Complete |
| 8 | Loot & Inventory System | ✅ Complete |
| 7 | Level & Progression System | ✅ Complete |

---

## Documentation

- **[PROJECT_GUIDE.md](./PROJECT_GUIDE.md)** — Detailed architecture guide with data flows, troubleshooting, and code patterns (Traditional Chinese with English annotations)

---

## License

Private project. All rights reserved.
