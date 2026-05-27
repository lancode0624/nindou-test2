# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 對話與程式碼風格

- 跟我對話一律使用繁體中文
- 程式碼加上註解，用中文解釋
- 盡可能使用簡潔的說明，避免冗餘內容

## Git Workflow 規範

- 頻繁提交：每次完成一組功能後必須 commit
- 提交訊息請涵蓋變更的全部範圍，並保持訊息簡潔
- 開始實作新功能時建立並切換到新的 Git 分支（例如，使用 git worktree 或直接創建分支）
- 永遠 *不要* 推送到 main 分支（main 或 master），避免干擾 prod 環境

## 驗證指令

修改任何 JS 後必須執行語法檢查：

```powershell
node --check .\game.js
```

若有視覺改動，直接用瀏覽器打開 `index.html` 確認畫面。

## 架構總覽

這是純瀏覽器 Canvas 遊戲，無框架、無模組系統。所有 JS 以 `<script>` 標籤按順序載入，共享全域命名空間。

### 載入順序（index.html）

```
scripts/data/config.js        → 遊戲常數（grid、maxHp、maxSkill、武器傷害、倒數時間…）
scripts/data/weapons.js       → weaponDefinitions 陣列、weaponFrames 快取結構
scripts/data/assets.js        → 所有圖片/動畫影格的路徑來源陣列（imageSources、*FrameSources）
scripts/data/rule-modes.js    → modeRuleProfiles（modified / original）與各規則查詢函式
scripts/systems/grid.js       → 格子座標計算（cellCenter、cellRect、isBlockedCell…）
scripts/data/map.js           → buildMapObjects()，地圖物件初始位置
scripts/systems/state-helpers.js → 狀態工具（clearDragState、selectedUnit、canControlUnit…）
scripts/systems/ninjutsu.js   → 忍術施放邏輯（updateNinju、useNinjuByType、各忍術效果）
scripts/systems/combat.js     → 武器攻擊、傷害計算（weaponAreaCells、weaponHitInDirection、attackCell）
scripts/systems/movement.js   → 移動判斷與執行（moveUnit、pathfinding）
scripts/systems/ai.js         → AI 決策（updateAi、各 AI 模式行動邏輯）
scripts/systems/match.js      → 勝負判斷（checkVictory、finishMatch）
game.js                       → DOM 綁定、素材載入、主迴圈 draw()、繪圖函式、輸入處理、房間 UI
```

### 主迴圈（game.js `draw()`）

每幀依序執行：
1. `updateMatchState` → 倒數計時
2. `updateCharging` / `updateNinju` / `updateAi` / `updateProjectiles`（僅戰鬥中）
3. 繪製：backdrop → board → drag → mapObjects → moveTrails → units → ninjuEffects → moneyDartShoot → projectiles → attacks → gameHud → ninjuBar
4. 覆蓋層：countdownOverlay → resultOverlay

### 遊戲流程

房間畫面（DOM）→ 按「戰鬥開始」呼叫 `startBattleFromRoom()` → 戰鬥（Canvas）→ `checkVictory()` 偵測全滅 → `finishMatch()` 設定結算 → 結算畫面 → `returnToRoomFromResult()` 返回房間。

## 座標系

**使用者說的座標是玩家座標，不是內部陣列座標。**

- 玩家 `[1,1]` = 左下角可走第一格；往右是 `[2,1]`，往上是 `[1,2]`
- `internalCellCoord()` / `displayCellCoord()` 互轉（`scripts/systems/grid.js`）
- 改 `buildMapObjects()`（`scripts/data/map.js`）時，`add()` 接受玩家座標；`addInternal()` 接受內部座標

## 規則模式（Rule Mode）

`state.useOriginalMode`（房間頂端 checkbox）切換 **modified**（預設）/ **original** 兩套數值。

- 傷害、冷卻、忍術效果查詢要透過 `scripts/data/rule-modes.js` 的函式（`steelRule()`、`moneyDartRule()`、`weaponDamageForMode()` 等），不要直接讀常數
- `scripts/data/config.js` 的常數是 fallback 預設值，`modeRuleProfiles` 覆蓋它們

## 高風險區（不要隨意改動）

### 武器動畫 offsets

`game.js` 的 `drawKunaiAttackFrame()` 與 `drawKunaiHandAttackFrame()` 內的 offset 常數是人工校準過的，**除非使用者明確要求，否則不要改**。

### 視覺 offset 常數（game.js）

人工調好的數值，改動前要確認使用者有需求：

- `eyeOffsets` — 眼睛相對角色中心位置
- `useNinjuSpriteOffset` — 忍術施放 sprite 偏移
- `moveEffectOffsets` — 移動殘影 prearrive / arrive 偏移
- `moneyDartVisualOffsets` — 錢鏢手持、無敵圈、飛行、出手位置

### 素材路徑

不要把 BGM 改回系統絕對路徑：

- 房間 BGM：`assets/sounds/bgm/lobby.mp3`
- 戰鬥 BGM：`assets/sounds/bgm/bgm.mp3`

## 素材命名慣例

| 類型 | 資料夾 |
|------|--------|
| 角色 sprite | `assets/characters/{idle,move,charge,use-ninju,parts}/` |
| 武器動畫 | `assets/weapon/{folder}/{direction}_{hand\|attack}/{n}.png`（1-indexed） |
| 忍術動畫 | `assets/ninju/` |
| 音效 | `assets/sounds/sfx/` |
| 房間 UI | `assets/room/` |
| 候選素材 | `assets/_candidates/` |

## 武器新增方式

在 `scripts/data/weapons.js` 的 `weaponDefinitions` 加一筆，攻擊範圍在 `scripts/systems/combat.js` 的 `weaponAreaCells()` 新增對應的 `area` 分支。

## 編碼注意事項

- 中文可直接寫在 JS 和 HTML 裡，不要轉成 `\uXXXX`
- 在 Windows PowerShell 編輯含中文的檔案時，優先用 Edit tool，避免亂轉編碼