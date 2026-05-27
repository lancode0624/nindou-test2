// ===== Unit State Helpers =====
function clearDragState() {
  state.pressedUnit = null;
  state.dragMoved = false;
  state.charging = false;
}

function formatDamage(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatMatchTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function selectedUnit() {
  return state.units.find((u) => u.id === state.selectedId && u.alive);
}

function canControlUnit(unit) {
  return unit?.controlMode === "player";
}

function selectedHudUnit() {
  return state.units.find((u) => u.id === state.selectedId) || selectedUnit();
}
