# Game Design Document: Teddy Boy Online (古惑仔Online)

**Version:** 1.0  
**Based on:** Legacy Design Documents (2001)  
**Genre:** MMORPG  
**Platform:** PC Online  

---

## 1. Introduction

### 1.1 Overview
**Teddy Boy Online** is a Massively Multiplayer Online Role-Playing Game (MMORPG) set in the gritty underworld of modern Hong Kong and Taiwan. Based on the popular "Teddy Boy" (古惑仔) comic series, the game allows players to immerse themselves in the life of triad members, police officers, or ordinary citizens trying to survive in a city ruled by loyalty, betrayal, and street justice.

### 1.2 Core Concept
Players are thrust into a "virtual society" that mirrors the real world. Unlike traditional fantasy MMOs, *Teddy Boy Online* focuses on realistic urban environments, social hierarchy, and faction warfare. The game emphasizes the struggle between law (Police), chaos (Triads), and neutral survival (Citizens).

### 1.3 Target Audience
- Fans of the *Teddy Boy* comic series and movies.
- Players enjoying realistic roleplay, social simulation, and PvP combat.
- Gamers interested in Hong Kong culture and gangland narratives.

---

## 2. Gameplay Mechanics

### 2.1 Character Professions (Classes)
Players choose one of three distinct paths. This choice is permanent and defines their gameplay loop.

#### A. Citizen (一般市民)
The default starting class. Citizens focus on the economy, crafting, and social aspects of the game.
- **Role:** Economy driver, crafter, neutral party.
- **Skills:** 
  - **Mechanics:** Repair and modify vehicles/items.
  - **Cooking:** Create food for health/buffs.
  - **Sewing:** Create clothing and armor.
  - **Medicine:** Craft healing items and drugs.
- **Reputation (Titles):**
  - **Good:** Model Citizen (模範市民) → Justice of the Peace (太平紳士) → Hong Kong Leader (香港領袖)
  - **Bad:** Criminal (罪犯) → Wanted (通緝犯) → Public Enemy No.1 (頭號重犯)
- **Special Features:**
  - Can attack "Wanted" players without penalty (Bounty Hunting).
  - Can train at Martial Arts centers.
  - Immune to unprovoked attacks unless they enter Danger Zones or are Wanted.

#### B. Triad Member (古惑仔)
The combat-focused class. Players join a gang (e.g., Hung Hing) and climb the ranks.
- **Role:** Fighter, territory controller, enforcer.
- **Skills:**
  - **Melee (Slash/Bludgeon):** Proficiency with knives, pipes, etc.
  - **Crafting:** Metalwork/Woodwork (for weapons), Spiritual Invocation (God of War buffs).
- **Ranks:**
  - Member (會員) → 49 (四九) → Blue Lantern (藍燈籠) → Straw Sandal (草鞋) → Red Pole (紅棍) → Dragon Head (龍頭).
- **Special Features:**
  - Faction-based PvP.
  - Participate in Turf Wars.

#### C. Police (警察)
Enforcers of the law. They patrol limits and catch criminals.
- **Role:** Peacekeeper, hunter of "Red Name" players.
- **Mechanics:**
  - Patrol specific beats.
  - Arrest players with high "Evil" stats.
  - Shoot on sight if a criminal resists (attacks back).

### 2.2 Combat & PvP Systems
- **PK (Player Killing):** Attacking innocent players turns a name "Red". Red-named players are "Wanted".
- **Bounty System:** Citizens and Police can hunt Wanted players for rewards.
- **Danger Zones (禁區):** Certain areas become restricted at specific times. Police patrol these zones heavily. Trespassing results in immediate pursuit.
- **Death Penalty:** Potential loss of money, experience, or items (standard for the era).

### 2.3 Character Attributes
Players customize their avatars with stats that affect performance:
- **Strength (力量):** Melee damage, carry weight.
- **Endurance (耐力):** Health points (HP), defense.
- **Hit (命中):** Accuracy with weapons.
- **Agility (敏捷):** Evasion, movement speed, attack speed.
- **Explosiveness (爆炸力):** Critical hit chance / Burst damage.

### 2.4 Spirit System (神打)
A unique mechanic for Triad members (and potentially others via Temples). Players can invoke spirits for temporary combat buffs:
- **Guan Yu (關公):** Attack +10%, Defense +5%, Agility -10%. Balance of offense and defense.
- **Monkey King (孫悟空):** Attack +10%, Defense -10%, Agility +5%. High offense, low defense.
- **Nezha (哪叱):** Attack +5%, Defense -5%, Agility +10%. Speed and evasion.
*Requires "Incense" and "Holy Water" from the Temple.*

---

## 3. Game World & Story

### 3.1 Setting
The game features realistic recreations of iconic locations:
- **Hong Kong:** Causeway Bay (銅鑼灣), Wan Chai, Mong Kok.
- **Taiwan:** Specific districts relevant to the comic arcs.
- **Atmosphere:** Neon lights, busy streets, mahjong parlors, night clubs, and dark alleyways.

### 3.2 Narrative Structure
The story is delivered in "Episodes" (Chapters) that mirror the comic books.
- **Episode 1: The Dragon Crosses the River (猛龍過江 - implied)**
  - **Protagonists:** Chan Ho-nam (陳浩南), Chicken (山雞).
  - **Antagonist:** Ugly Kwan (靚坤).
  - **Plot:** Ugly Kwan is expanding his influence into the entertainment industry using illicit funds. He tries to frame Chicken for producing bootleg discs. The player assists Chan Ho-nam and Chicken in exposing Kwan's schemes and defending the honor of the Hung Hing society.

### 3.3 Facilities & Shops
The world is populated with functional buildings:
- **Martial Arts Center (武館):** Training ground for players.
- **Temple (廟宇):** Buy religious items (incense, charms), ask for fortune (hints), or donate for luck.
- **Black Market:** Located in Kwai Fong/Kwun Tong. Selling illegal goods.
- **Real Estate & Furniture:** Buy houses and decorate them with wallpapers and furniture.
- **Entertainment:** Mahjong Parlors, Pool Halls, Arcades, and Karaoke Bars.
- **Jockey Club:** Bet on results (lottery system).

---

## 4. Minigames & Jobs
The game features a rich collection of minigames that serve as "Jobs" for Citizens to earn money or skills.

### 4.1 Job Minigames
- **Window Cleaning:** Clean windows on a moving platform while dodging falling trash.
- **Machine Assembly:** Place gears correctly to connect Start and End points.
- **Sewing:** Trace a pattern with the mouse to create clothes.
- **Medicine Making:** Memory game—replicate the sequence of mixing colored liquids.
- **Cooking:** Serve dishes by selecting the correct ingredients within a time limit.
- **PC Assembly:** Drag and drop components (CPU, RAM, HDD) into a case in the correct order.

### 4.2 Recreation Minigames
- **Mahjong:** Full 4-player mahjong.
- **Pool/Snooker:** Physics-based billiards.
- **Boxing:** Reflex-based combat mini-game.
- **Prison Games:** 
  - *Mowing Grass:* Clear the yard without hitting rocks.
  - *Smoking:* Sneak a smoke without being caught by the warden.

---

## 5. Systems Design

### 5.1 Economy & Trade
- **Currency:** Hong Kong Dollars (HKD).
- **Consumables:** Wide variety of foods (e.g., Turkey, Pumpkin Pie) that restore HP and VP (Vigor Points).
- **Trading:** Direct player-to-player trade.
- **MLM System (Legacy Feature):** A "Referral/Downline" system where players gain a percentage of XP from players they "recruit" into the game (simulating a triad hierarchy or pyramid scheme). *Note: This is a historical feature of the original 2001 design.*

### 5.2 Communication
- **Chat Channels:** Public, Party, Guild (Triad), Whisper.
- **Kill Order (追殺令):** A global broadcast system where a player can put a bounty or a "hit" on another player, marking them for death.

### 5.3 Mission System
- **Main Story Missions:** Advance the plot (e.g., "Infiltrate Ugly Kwan's film set").
- **Side Missions:** 
  - **Delivery:** Transport illegal goods.
  - **Protection:** Escort VIPs.
  - **Assassination:** Take out rival gang members.

---

## 6. Technical & Interface

### 6.1 Controls
- **Movement:** Mouse click to move.
- **Camera:** Fixed isometric or rotating 3rd person (standard for 2.5D MMOs of the time).
- **Interface:** 
  - Status Bar (HP/MP/EXP).
  - Chat Box (Bottom left).
  - Mini-map (Top right).

### 6.2 System Requirements (Legacy)
- **OS:** Windows 95/98/2000.
- **Network:** 56k Modem or Broadband.
- **Input:** Keyboard & Mouse.
