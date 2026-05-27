# AI Handoff Notes

這份文件是給後續接手的 AI 或工程師看的。請先讀完再改程式，因為這個專案有不少人工校準過的位置和規則。

## 專案目標

做《忍豆風雲 2》的單機版原型，優先還原使用者指定的戰鬥手感，而不是做通用遊戲框架。畫面與素材要盡量貼近原版；不要用太多 CSS 方塊或抽象 placeholder 取代已找到的素材。

## 重要使用者偏好

- 使用者會自己微調座標與 offsets。看到使用者說「不要動」的常數，就絕對不要改。
- 對視覺位置很敏感，尤其角色、武器、房間 UI、HUD。
- 每次改武器或動畫，要先確認是否會影響已校準的 `offsets`。
- 中文可直接寫在程式與 HTML 裡，不要用 `\uXXXX`，方便人工校訂。
- 避免 PowerShell 亂轉中文編碼；編輯檔案優先用 `apply_patch`。

## 高風險區

### 武器動畫 offsets

`game.js`：

- `drawKunaiAttackFrame()`
- `drawKunaiHandAttackFrame()`

這兩個函式內的 `offsets` 是使用者人工調好的。除非新需求明確要求調整動畫位置，否則不要動。

目前忍太刀：

- 刀光：`assets/weapon/3忍太刀/*_attack`
- 手部：`assets/weapon/3忍太刀/*_hand`
- 兩者 24 張同步播放。

### 攻擊範圍

`weaponAreaCells(attacker, dir)` 定義忍太刀範圍：

- up：上方橫向 3 格
- down：下方橫向 3 格
- left：左側 2 格
- right：右側 2 格

`weaponHitInDirection()` 是 AOE，會回傳範圍內全部敵人與可破壞物件。

### 座標系

使用者說的座標是玩家座標，不是內部陣列座標：

- 玩家 `[1,1]` 是左下角可走第一格。
- `displayCellCoord()` / `internalCellCoord()` 做轉換。
- 改 `buildMapObjects()` 時要特別小心。

### BGM

目前有兩首：

- 房間：`assets/sounds/bgm/lobby.mp3`
- 戰鬥：`assets/sounds/bgm/bgm.mp3`

不要把音樂改回外部絕對路徑。`startBgm()`、`syncBgm()`、`activeBgm()` 控制何時播放哪一首。

## 核心流程

1. `game.html` 載入房間 DOM 和 Canvas。
2. `loadImages()` 載入素材。
3. `resetGame()` 建立角色、地圖物件、狀態。
4. 房間中按 `battleStartBtn` 呼叫 `startBattleFromRoom()`。
5. 主迴圈 `draw()` 每幀更新 AI、忍術、錢鏢、動畫，再繪製地圖、角色、攻擊、HUD。
6. `checkVictory()` 偵測隊伍全滅，`finishMatch()` 設定結算並停止戰鬥 BGM。

## 常用檢查

```powershell
node --check .\game.js
```

若需要看畫面，可打開：

```text
C:\Users\lane6\Documents\Codex\2026-05-03\2-c-users-lane6-onedrive-desktop\game.html
```

## 建議工作方式

- 先讀相關函式，不要大範圍重構。
- 小步修改，小步驗證。
- 視覺相關改動要保留使用者手調數值。
- 不要刪 `assets/map`，使用者明確說過不要刪。
- 如果整理素材，只刪明確不用的衍生檔；不要刪原始 PNG 素材。
