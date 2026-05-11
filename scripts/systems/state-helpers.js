// ===== Unit State Helpers =====
// 清空按住角色、拖曳線與集技狀態。
function clearDragState() {
  state.pressedUnit = null;
  state.dragMoved = false;
  state.charging = false;
}

// 把傷害數字整理成結算畫面顯示格式。
function formatDamage(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

// 把毫秒轉成 mm:ss 比賽時間。
function formatMatchTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// 判斷滑鼠座標是否在矩形按鈕內。
function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

// 取得目前玩家可操作的角色。
function selectedUnit() {
  return state.units.find((u) => u.id === state.selectedId && u.alive);
}

// 判斷角色是否由玩家操控；玩家操控的角色不會被 AI 移動。
function canControlUnit(unit) {
  return unit?.controlMode === "player";
}

// 取得 HUD 要顯示資料的角色。
function selectedHudUnit() {
  return state.units.find((u) => u.id === state.selectedId) || selectedUnit();
}
