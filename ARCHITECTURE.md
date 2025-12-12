# Gangs Online - 代码架构文档

## 📁 文件结构

```
packages/client/src/
├── main.ts                    # 主入口文件，负责初始化和协调各系统
├── config.ts                  # 全局配置（服务器地址、游戏参数等）
│
├── types/                     # 类型定义
│   └── index.ts              # 所有 TypeScript 类型和接口
│
├── systems/                   # 游戏系统模块
│   ├── LoadingScreen.ts      # 加载屏幕系统
│   ├── ChatSystem.ts         # 聊天系统（输入框、气泡）
│   ├── UISystem.ts           # UI系统（血条、名字标签、战斗指示器）
│   └── WeaponSystem.ts       # 武器系统（创建和附加武器）
│
├── world/                     # 世界/环境模块
│   └── CityGenerator.ts      # 城市生成器（道路、建筑、人行道）
│
├── entities/                  # 游戏实体模块
│   └── PlayerManager.ts      # 玩家管理器（创建、更新、移除玩家）
│
└── utils/                     # 工具函数
    └── BabylonUtils.ts       # Babylon.js 相关工具函数
```

---

## 🏗️ 模块职责说明

### 1. **main.ts** - 主入口
**职责：**
- 初始化游戏引擎和客户端
- 协调各个系统的初始化
- 处理游戏主循环
- 处理用户输入（点击攻击/移动）

**依赖：**
- 所有其他模块

---

### 2. **config.ts** - 配置管理
**职责：**
- 存储游戏配置参数
- 服务器 URL
- 模型配置（路径、缩放）
- 相机配置
- 武器配置

**优点：**
- 集中管理所有配置，易于调整
- 修改配置不需要翻遍代码

---

### 3. **types/index.ts** - 类型定义
**职责：**
- 定义所有 TypeScript 接口和类型
- `PlayerEntity` - 玩家实体数据结构
- `PlayerUIElements` - 玩家 UI 元素
- `PlayerTarget` - 玩家目标位置
- `GameConfig` - 游戏配置
- `ChatMessage` - 聊天消息

**优点：**
- 提供类型安全
- 便于理解数据结构
- 集中管理类型定义

---

### 4. **systems/** - 游戏系统

#### 4.1 **LoadingScreen.ts** - 加载屏幕系统
**职责：**
- 显示加载进度
- 更新加载文本
- 隐藏加载屏幕（带动画）
- 显示错误消息

**主要方法：**
- `updateText(text: string)` - 更新加载文本
- `hide()` - 隐藏加载屏幕
- `showError(error: Error)` - 显示错误

---

#### 4.2 **ChatSystem.ts** - 聊天系统
**职责：**
- 创建聊天输入框
- 创建聊天气泡
- 处理聊天消息发送

**主要方法：**
- `createChatInput()` - 创建聊天输入框
- `createChatBubble(mesh, text)` - 在玩家头顶显示聊天气泡

**依赖：**
- Babylon.js GUI
- Colyseus Room

---

#### 4.3 **UISystem.ts** - UI系统
**职责：**
- 创建玩家 UI 元素（名字、血条、战斗指示器）
- 更新血条
- 控制战斗指示器显示

**主要方法：**
- `createPlayerUI(mesh, name)` - 创建完整的玩家 UI
- `updateHealthBar(ui, currentHp, maxHp)` - 更新血条
- `setCombatIndicator(ui, visible)` - 设置战斗指示器

**依赖：**
- Babylon.js GUI

---

#### 4.4 **WeaponSystem.ts** - 武器系统
**职责：**
- 创建武器模型
- 将武器附加到角色骨骼
- 武器材质和外观配置

**主要方法：**
- `attachWeapon(rootMesh, skinnedMesh, scene)` - 附加武器到角色

**特点：**
- 自动查找手部骨骼
- 有后备方案（如果找不到骨骼）

---

### 5. **world/** - 世界模块

#### 5.1 **CityGenerator.ts** - 城市生成器
**职责：**
- 生成程序化城市环境
- 创建道路、建筑物、人行道
- 设置碰撞体

**主要方法：**
- `generate()` - 生成整个城市
- `createRoad()` - 创建沥青道路（私有）
- `createBuildings()` - 创建建筑物和人行道（私有）

**特点：**
- 程序化生成，每次运行都一样
- 所有对象启用碰撞检测

---

### 6. **entities/** - 实体模块

#### 6.1 **PlayerManager.ts** - 玩家管理器
**职责：**
- 创建玩家实体（加载模型、动画、UI）
- 更新玩家位置和状态
- 移除玩家
- 处理玩家移动和动画

**主要方法：**
- `createPlayer(player, sessionId, isSelf)` - 创建玩家
- `removePlayer(sessionId)` - 移除玩家
- `updateTarget(sessionId, x, z)` - 更新目标位置
- `updateHealth(sessionId, currentHp, maxHp)` - 更新血量
- `updateCombatState(sessionId, inCombat)` - 更新战斗状态
- `updateAll()` - 更新所有玩家（在游戏循环中调用）
- `getEntity(sessionId)` - 获取玩家实体

**依赖：**
- `UISystem` - 创建玩家 UI
- `WeaponSystem` - 附加武器
- Babylon.js SceneLoader

**特点：**
- 集中管理所有玩家
- 自动处理动画切换（idle/run）
- 处理碰撞检测

---

### 7. **utils/** - 工具函数

#### 7.1 **BabylonUtils.ts** - Babylon.js 工具
**职责：**
- 创建优化的引擎
- 创建等轴测相机
- 更新相机跟随
- 设置场景基础配置

**主要函数：**
- `createEngine(canvas)` - 创建引擎（带移动端优化）
- `createIsometricCamera(scene, engine)` - 创建等轴测相机
- `updateCameraFollow(camera, playerMesh)` - 相机跟随玩家
- `setupScene(scene)` - 设置场景（光照、碰撞）

**特点：**
- 自动检测移动设备并优化
- 封装 Babylon.js 常用配置

---

## 🔄 数据流

```
┌─────────────┐
│   main.ts   │  ← 入口点
└──────┬──────┘
       │
       ├─→ LoadingScreen  ← 显示加载进度
       │
       ├─→ Engine (BabylonUtils)  ← 创建引擎
       │
       ├─→ Scene Creation
       │    │
       │    ├─→ setupScene (BabylonUtils)  ← 光照、碰撞
       │    ├─→ createIsometricCamera  ← 相机
       │    ├─→ CityGenerator.generate()  ← 城市环境
       │    │
       │    └─→ Systems Initialization
       │         ├─→ UISystem
       │         ├─→ WeaponSystem
       │         ├─→ ChatSystem
       │         └─→ PlayerManager
       │              │
       │              └─→ Player Creation
       │                   ├─→ Load Model
       │                   ├─→ WeaponSystem.attachWeapon()
       │                   └─→ UISystem.createPlayerUI()
       │
       └─→ Game Loop
            ├─→ PlayerManager.updateAll()  ← 更新所有玩家
            └─→ updateCameraFollow()  ← 相机跟随
```

---

## 🎯 设计原则

### 1. **单一职责原则 (SRP)**
- 每个类/模块只负责一件事
- 例如：`WeaponSystem` 只管武器，`UISystem` 只管 UI

### 2. **依赖注入**
- 系统之间通过构造函数传递依赖
- 例如：`PlayerManager` 接收 `UISystem` 和 `WeaponSystem`

### 3. **配置外置**
- 所有配置参数集中在 `config.ts`
- 便于调整和维护

### 4. **类型安全**
- 使用 TypeScript 接口定义所有数据结构
- 减少运行时错误

---

## 📝 添加新功能指南

### 添加新的游戏系统

1. 在 `systems/` 创建新文件，例如 `InventorySystem.ts`
2. 定义系统类和方法
3. 在 `main.ts` 中导入并初始化
4. 如需类型定义，添加到 `types/index.ts`
5. 如需配置，添加到 `config.ts`

**示例：**
```typescript
// systems/InventorySystem.ts
export class InventorySystem {
    constructor(scene: BABYLON.Scene) {
        // ...
    }

    addItem(item: Item): void {
        // ...
    }
}

// main.ts
import { InventorySystem } from "./systems/InventorySystem";

const inventorySystem = new InventorySystem(scene);
```

### 添加新的实体类型

1. 在 `entities/` 创建新文件，例如 `NPCManager.ts`
2. 参考 `PlayerManager.ts` 的结构
3. 在 `types/index.ts` 定义实体类型
4. 在 `main.ts` 中初始化和使用

---

## 🚀 未来扩展建议

### 可能的新模块：

1. **systems/InventorySystem.ts** - 背包系统
2. **systems/QuestSystem.ts** - 任务系统
3. **systems/AudioSystem.ts** - 音频系统
4. **systems/ParticleSystem.ts** - 粒子特效系统
5. **entities/NPCManager.ts** - NPC 管理器
6. **world/BuildingInterior.ts** - 建筑内部生成
7. **utils/MathUtils.ts** - 数学工具函数
8. **services/NetworkService.ts** - 网络服务封装

---

## 🔧 维护注意事项

### 修改现有代码时：

1. **不要破坏模块边界** - 系统之间通过公共接口交互
2. **保持配置集中** - 新参数添加到 `config.ts`
3. **更新类型定义** - 数据结构变化时更新 `types/index.ts`
4. **添加注释** - 复杂逻辑要有清晰注释
5. **测试影响** - 修改底层模块（如 `PlayerManager`）时测试所有相关功能

---

## 📚 文件大小对比

### 重构前：
- `main.ts`: ~500 行（所有代码在一个文件）

### 重构后：
- `main.ts`: ~200 行（只有协调逻辑）
- 各模块: 50-200 行（单一职责，易于理解）

**优势：**
- ✅ 代码更易读
- ✅ 更易维护和调试
- ✅ 团队协作更方便
- ✅ 便于单元测试
- ✅ 可复用性更高

---

## 🎓 学习路径

如果你是新加入的开发者，建议按以下顺序阅读代码：

1. `ARCHITECTURE.md`（本文件）- 理解整体架构
2. `types/index.ts` - 理解数据结构
3. `config.ts` - 了解游戏配置
4. `main.ts` - 理解初始化流程
5. `systems/LoadingScreen.ts` - 最简单的系统
6. `systems/UISystem.ts` - UI 创建
7. `entities/PlayerManager.ts` - 最复杂的模块
8. 其他模块根据需要学习

---

**最后更新：** 2025-12-12
**版本：** 1.0.0
