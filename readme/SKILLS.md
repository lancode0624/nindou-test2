# Project Skills / Working Rules

這不是 Codex 系統技能檔，而是本專案的工作技能說明，讓其他 AI 知道接手時該怎麼做。

## Skill: Browser Canvas Game Maintenance

適用範圍：

- 修改 `game.js` 的 Canvas 遊戲邏輯。
- 調整 `game.html` / `style.css` 的房間 UI。
- 接入 `assets/` 內的角色、地圖、武器、忍術、音效素材。

工作流程：

1. 先用搜尋定位相關函式，例如 `weaponAreaCells`、`drawKunaiAttackFrame`、`useSteelNinju`。
2. 確認使用者是否說過某些常數不要動。
3. 修改前先理解該功能是否同時影響輸入、判定、動畫、音效。
4. 修改後執行 `node --check .\game.js`。
5. 若是視覺改動，盡量用瀏覽器截圖或實際畫面檢查。

## Skill: Asset Integration

素材規則：

- 優先使用 `assets/` 已整理好的素材。
- 原始來源多半在 `C:\Users\lane6\OneDrive\Desktop\忍豆風雲2\ExportedProject\Assets\Resources\images`。
- 若從外部資料夾接入常用素材，請複製到專案 `assets/`，不要長期依賴絕對路徑。
- 圖片組合圖通常依方向分資料夾，例如 `right_attack`、`left_hand`。

命名建議：

- 音樂放 `assets/audio`。
- 音效放 `assets/sfx`。
- 武器放 `assets/weapon`。
- 忍術放 `assets/ninju`。
- 房間 UI 放 `assets/room-ui-selected` 或候選素材放 `assets/room-candidates`。

## Skill: Combat / Weapon Changes

改武器時要同時檢查：

- 傷害：`weaponDamage`
- 冷卻：`weaponCooldownMs`
- 素材來源：`kunaiHandFrameSources`、`kunaiAttackFrameSources`
- 動畫時間：`playSlash()` 裡的 `duration`
- 範圍：`weaponAreaCells()`
- 命中：`weaponHitInDirection()`、`attackCell()`

目前忍太刀是 AOE，不是單點命中。範圍內所有敵人和可破壞物件都會被打到。

## Skill: Ninjutsu Changes

改忍術時要同時檢查：

- 按鈕繪製與點擊區域。
- 技量消耗。
- 施放時間、無敵時間、忍走間隔。
- 角色是否能移動、是否能被攻擊。
- 音效。
- 狀態結束或刷新規則。

目前鋼鐵和錢鏢的規則都經過多輪調整，不要用一般 RPG 常識覆蓋掉現有行為。

## Skill: Room UI Changes

房間畫面是 DOM + CSS，不是 Canvas。

重要檔案：

- `game.html`
- `style.css`
- `assets/room-ui-selected`

注意：

- 使用者希望接近原版房間畫面，要優先找素材，不要直接用純 CSS 畫假 UI。
- 左下角音量滑桿要控制真實音量。
- 右下模式標題目前是「隨機忍二系列」。

## Skill: Safe Documentation / Commenting

文件與註解偏好：

- 可直接使用繁體中文。
- 寫明「哪些東西不要動」比寫抽象架構更有用。
- 程式註解以使用者之後能調數值為目標，例如位置、大小、顏色、冷卻、傷害。
- 不要把中文改成 Unicode escape。
