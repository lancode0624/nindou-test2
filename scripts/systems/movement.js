// ===== Movement / Collision =====
function skillMove(unit, cell) {
  if (!cell) return;
  if (unit.moneyDart) {
    setMessage(`${unit.name}: cannot move while holding money dart.`);
    return;
  }
  if (!weaponIsReady(unit)) {
    setMessage(`${unit.name}: cannot move while weapon is recovering.`);
    return;
  }
  if (isUnitDisabled(unit)) {
    setMessage(`${unit.name}: cannot act now.`);
    return;
  }
  if (!canUnitMoveNow(unit)) {
    setMessage(`${unit.name}: cannot move while using ninjutsu.`);
    return;
  }
  if (unit.moveTrail && (performance.now() - unit.moveTrail.startedAt) < ARRIVE_TOTAL) {
    setMessage(`${unit.name}: cannot move while moving.`);
    return;
  }
  const wanted = cell;
  if (!isStraightMove(unit, wanted)) {
    setMessage("Move must be horizontal or vertical.");
    return;
  }
  const maxDistance = Math.floor(unit.skill);
  if (maxDistance < 1) {
    setMessage(`Not enough skill. Need 1, have ${unit.skill.toFixed(1)}.`);
    return;
  }
  const path = movePath(unit, wanted, maxDistance);
  cell = path ? path.cell : null;
  if (!cell) {
    setMessage("Path is blocked.");
    return;
  }
  if (cell.x === unit.x && cell.y === unit.y) {
    setMessage("Move cancelled.");
    return;
  }
  const cost = Math.max(1, manhattan(unit, cell));

  unit.skill -= cost;
  gainSoul(unit, cost);
  moveUnit(unit, cell.x, cell.y);
  if (path.hitEnemies.length > 0) {
    for (const enemy of path.hitEnemies) {
      collideWithEnemy(unit, enemy);
    }
  } else {
    setMessage(`${unit.name} spent ${cost} skill to move.`);
  }
}

function gainSoul(unit, steps) {
  if (!unit || !canControlUnit(unit)) return;
  const maxSteps = soulStepsPerLevel * soulMaxLevel;
  const before = unit.soulSteps || 0;
  const beforeLevel = Math.min(soulMaxLevel, Math.floor(before / soulStepsPerLevel));
  unit.soulSteps = Math.min(maxSteps, before + Math.max(0, steps));
  const afterLevel = Math.min(soulMaxLevel, Math.floor(unit.soulSteps / soulStepsPerLevel));
  if (afterLevel > beforeLevel) playSound(afterLevel >= soulMaxLevel ? "soulMax" : "soulLevelUp");
}

function moveUnit(unit, x, y) {
  updateFacing(unit, { x, y });
  // 記錄殘影起點、終點與移動當下面向，用於 drawMoveTrails 播放動畫。
  unit.moveTrail = { fromX: unit.x, fromY: unit.y, toX: x, toY: y, startedAt: performance.now(), facing: unit.facing, team: unit.team };
  unit.fromX = unit.x;
  unit.fromY = unit.y;
  unit.x = x;
  unit.y = y;
  unit.moveT = 1; // 格子位置瞬間切換，動畫由 moveTrail 時間軸負責。
  if (isUnitInNinjuGap(unit)) {
    unit.ninju.gapMoves = (unit.ninju.gapMoves || 0) + 1;
  } else if (isUnitCastingNinju(unit) && unit.ninju.chainMoves > 0) {
    unit.ninju.chainMoves -= 1;
  }
  playSound("move");
}

function cancelDragIfPressed(unit) {
  if (state.pressedUnit !== unit) return;
  state.pressedUnit = null;
  state.dragMoved = false;
  state.charging = false;
}

function collideWithEnemy(mover, enemy) {
  if (isUnitInvincible(enemy)) {
    setMessage(`${enemy.name} is invincible.`);
    return;
  }
  const damage = defendedDamage(enemy, collisionDamage);
  enemy.hp = Math.max(0, enemy.hp - damage);
  recordDamage(mover, enemy, damage, { skipSoulGain: true });
  gainSoul(mover, soulCombatGainSteps);
  enemy.hitFlash = 0.65;
  enemy.alive = false;
  enemy.moneyDart = null;
  cancelDragIfPressed(enemy);
  playSound("runOver");
  setMessage(`${mover.name} ran into ${enemy.name}. ${enemy.name} took ${formatDamage(damage)}.`);

  if (enemy.hp <= 0) {
    enemy.respawning = false;
    gainSoul(enemy, soulDeathGainSteps);
    mover.kills += 1;
    playSound("death");
    setMessage(`${enemy.name} defeated.`);
    checkVictory();
  } else {
    enemy.respawning = true;
    window.setTimeout(() => {
      respawnUnit(enemy);
    }, respawnMs);
  }
}

function respawnUnit(unit) {
  if (!state.units.includes(unit)) return;
  const cell = randomOpenCell();
  unit.x = cell.x;
  unit.y = cell.y;
  unit.fromX = cell.x;
  unit.fromY = cell.y;
  unit.moveT = 1;
  unit.alive = true;
  unit.respawning = false;
  unit.hitFlash = 0.65;
  if (canControlUnit(unit)) unit.respawnTipUntil = performance.now() + respawnPointerDuration;
  unit.moneyDart = null;
  if (canControlUnit(unit)) playSound("respawn");
  setMessage(`${unit.name} respawned.`);
}

function randomOpenCell() {
  const candidates = [];
  for (let y = 1; y < grid.rows - 1; y++) {
    for (let x = 1; x < grid.cols - 1; x++) {
      if (!isBlockedCell(x, y) && !unitAt(x, y)) candidates.push({ x, y });
    }
  }

  if (candidates.length === 0) return { x: 1, y: 1 };
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function reachableMoveCell(unit, wanted, maxDistance = Infinity) {
  const path = movePath(unit, wanted, maxDistance);
  return path ? path.cell : null;
}

function movePath(unit, wanted, maxDistance = Infinity) {
  if (!wanted || !isStraightMove(unit, wanted)) return null;
  const dx = Math.sign(wanted.x - unit.x);
  const dy = Math.sign(wanted.y - unit.y);
  if (dx === 0 && dy === 0) return { cell: { x: unit.x, y: unit.y }, hitEnemies: [] };
  if (maxDistance < 1) return null;

  let lastOpen = { x: unit.x, y: unit.y };
  const hitEnemies = [];
  let x = unit.x + dx;
  let y = unit.y + dy;
  let distance = 1;

  while (inside(x, y)) {
    const other = unitAt(x, y);
    if (isPermanentObstacle(x, y) || objectAt(x, y)) break;
    if (other) {
      if (other.team === unit.team || isUnitInvincible(other)) break;
      hitEnemies.push(other);
    }

    lastOpen = { x, y };
    if ((x === wanted.x && y === wanted.y) || distance >= maxDistance) return { cell: lastOpen, hitEnemies };
    x += dx;
    y += dy;
    distance += 1;
  }

  return lastOpen.x === unit.x && lastOpen.y === unit.y ? null : { cell: lastOpen, hitEnemies };
}

function dragMoveTargetCell(unit) {
  if (!unit) return null;
  const origin = cellCenter(unit.x, unit.y);
  const dx = state.pointer.x - origin.x;
  const dy = state.pointer.y - origin.y;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return { x: unit.x, y: unit.y };

  if (Math.abs(dx) >= Math.abs(dy)) {
    const x = clamp(Math.floor((state.pointer.x - grid.left) / grid.cell), 0, grid.cols - 1);
    return inside(x, unit.y) ? { x, y: unit.y } : null;
  }

  const y = clamp(Math.floor((state.pointer.y - grid.top) / grid.cell), 0, grid.rows - 1);
  return inside(unit.x, y) ? { x: unit.x, y } : null;
}

function clearStraightPath(from, to, allowedFinalUnit) {
  if (!isStraightMove(from, to)) return false;
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  let x = from.x + dx;
  let y = from.y + dy;

  while (x !== to.x || y !== to.y) {
    if (isBlockedCell(x, y) || unitAt(x, y)) return false;
    x += dx;
    y += dy;
  }

  const finalUnit = unitAt(to.x, to.y);
  if (finalUnit && finalUnit !== allowedFinalUnit) return false;
  return !isPermanentObstacle(to.x, to.y) && !objectAt(to.x, to.y);
}
