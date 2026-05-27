// ===== Grid / Coordinate Helpers =====
function displayCellCoord(cell) {
  return {
    x: cell.x - 1,
    y: grid.rows - 1 - cell.y,
  };
}

function internalCellCoord(cell) {
  return {
    x: cell.x + 1,
    y: grid.rows - 1 - cell.y,
  };
}

function unitAt(x, y) {
  return state.units.find((u) => u.alive && u.x === x && u.y === y);
}

function occupied(x, y) {
  return Boolean(unitAt(x, y));
}

function objectAt(x, y) {
  if (!state.objects) return null;
  return state.objects.find((object) => object.alive && object.x === x && object.y === y) || null;
}

function neighbors(x, y) {
  return [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }];
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isStraightMove(a, b) {
  return a.x === b.x || a.y === b.y;
}

function inside(x, y) {
  return x >= 0 && x < grid.cols && y >= 0 && y < grid.rows;
}

function isBlockedCell(x, y) {
  return isPermanentObstacle(x, y) || Boolean(objectAt(x, y));
}

function isPermanentObstacle(x, y) {
  if (!inside(x, y)) return true;
  if (x === 0 || x === grid.cols - 1) return true;
  if (y === 0 || y === grid.rows - 1) return true;
  if (x === 1 || x === grid.cols - 2) return true;
  return false;
}

function pointerIsOnUnit(unit) {
  if (!state.pointer.cell) return false;
  return state.pointer.cell.x === unit.x && state.pointer.cell.y === unit.y;
}

function cellRect(x, y) {
  return { x: grid.left + x * grid.cell, y: grid.top + y * grid.cell, w: grid.cell, h: grid.cell };
}

function cellCenter(x, y) {
  return { x: grid.left + x * grid.cell + grid.cell / 2, y: grid.top + y * grid.cell + grid.cell / 2 };
}

function pointToCell(px, py) {
  const x = Math.floor((px - grid.left) / grid.cell);
  const y = Math.floor((py - grid.top) / grid.cell);
  return inside(x, y) ? { x, y } : null;
}

function eventCell(event) {
  pointerMove(event);
  return state.pointer.cell;
}
