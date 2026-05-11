// ===== Grid / Coordinate Helpers =====
// 把程式內部格子座標轉成玩家看的座標：左下角可走第一格是 [1,1]。
function displayCellCoord(cell) {
  return {
    x: cell.x - 1,
    y: grid.rows - 1 - cell.y,
  };
}

// 把玩家看的座標轉回程式內部格子座標。
function internalCellCoord(cell) {
  return {
    x: cell.x + 1,
    y: grid.rows - 1 - cell.y,
  };
}

// 尋找指定格子上的角色。
function unitAt(x, y) {
  return state.units.find((u) => u.alive && u.x === x && u.y === y);
}

// 判斷指定格子是否被角色佔用。
function occupied(x, y) {
  return Boolean(unitAt(x, y));
}

// 尋找指定格子上的地圖物件。
function objectAt(x, y) {
  if (!state.objects) return null;
  return state.objects.find((object) => object.alive && object.x === x && object.y === y) || null;
}

// 取得指定格子的上下左右鄰居。
function neighbors(x, y) {
  return [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }];
}

// 計算兩格的曼哈頓距離。
function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// 把數值限制在最小與最大值之間。
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// 判斷兩格是否為水平或垂直移動。
function isStraightMove(a, b) {
  return a.x === b.x || a.y === b.y;
}

// 判斷格子是否在地圖範圍內。
function inside(x, y) {
  return x >= 0 && x < grid.cols && y >= 0 && y < grid.rows;
}

// 判斷格子是否因永久障礙或物件而不可通行。
function isBlockedCell(x, y) {
  return isPermanentObstacle(x, y) || Boolean(objectAt(x, y));
}

// 判斷格子是否是不可破壞的外圍障礙。
function isPermanentObstacle(x, y) {
  if (!inside(x, y)) return true;
  if (x === 0 || x === grid.cols - 1) return true;
  if (y === 0 || y === grid.rows - 1) return true;
  if (x === 1 || x === grid.cols - 2) return true;
  return false;
}

// 判斷滑鼠目前是否仍停在按住的角色身上。
function pointerIsOnUnit(unit) {
  if (!state.pointer.cell) return false;
  return state.pointer.cell.x === unit.x && state.pointer.cell.y === unit.y;
}

// 取得指定格子在畫面上的矩形位置。
function cellRect(x, y) {
  return { x: grid.left + x * grid.cell, y: grid.top + y * grid.cell, w: grid.cell, h: grid.cell };
}

// 取得指定格子的中心點座標。
function cellCenter(x, y) {
  return { x: grid.left + x * grid.cell + grid.cell / 2, y: grid.top + y * grid.cell + grid.cell / 2 };
}

// 把畫面座標轉成地圖格子。
function pointToCell(px, py) {
  const x = Math.floor((px - grid.left) / grid.cell);
  const y = Math.floor((py - grid.top) / grid.cell);
  return inside(x, y) ? { x, y } : null;
}

// 把滑鼠事件座標轉成地圖格子。
function eventCell(event) {
  pointerMove(event);
  return state.pointer.cell;
}
