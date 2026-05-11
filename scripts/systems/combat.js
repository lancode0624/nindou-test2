// ===== Combat =====
// 處理武器直接攻擊敵方角色。
function attack(attacker, target) {
  if (attacker.moneyDart) {
    setMessage(`${attacker.name}: cannot attack while holding money dart.`);
    return;
  }
  if (isUnitCastingNinju(attacker)) {
    setMessage(`${attacker.name}: cannot attack while using ninjutsu.`);
    return;
  }
  if (!weaponIsReady(attacker)) {
    setMessage(`${attacker.name}: weapon is recovering.`);
    return;
  }
  const dir = weaponDirectionFromTarget(attacker, target);
  if (!dir || !isCellInWeaponRange(attacker, target, dir)) {
    setMessage("Target is outside the Nodachi range.");
    return;
  }
  attackCell(attacker, { x: attacker.x + dir.dx, y: attacker.y + dir.dy });
}

// 套用角色傷害、無敵判定、防禦係數與死亡處理。
function damageUnit(target, baseDamage, label, announce = true, attacker = null) {
  const damage = defendedDamage(target, baseDamage);
  target.hp -= damage;
  recordDamage(attacker, target, damage);
  target.hitFlash = 0.65;
  playSound("weaponDamaged");
  if (announce) setMessage(`${label} for ${formatDamage(damage)}.`);
  if (target.hp <= 0) {
    target.alive = false;
    target.moneyDart = null;
    if (attacker && attacker !== target) attacker.kills += 1;
    cancelDragIfPressed(target);
    playSound("death");
    setMessage(`${target.name} defeated.`);
    checkVictory();
  }
  return damage;
}

// 紀錄造成傷害與承受傷害，用於結算畫面。
function recordDamage(attacker, target, damage) {
  const amount = Math.max(0, damage);
  if (target) target.damageTaken += amount;
  if (attacker && attacker !== target) attacker.damageDone += amount;
}

// 處理武器攻擊地圖物件與破壞音效。
function damageObject(object, attacker) {
  const damage = unitWeaponDamage(attacker);
  object.hp = Math.max(0, object.hp - damage);
  setMessage(`${attacker.name} hit ${object.type} for ${damage}.`);
  if (object.hp <= 0) {
    object.alive = false;
    playBreakSound(object);
    setMessage(`${object.type} destroyed.`);
  }
}

// 攻擊指定格子，可能打到敵人或物件。
function attackCell(attacker, cell) {
  if (attacker.moneyDart) {
    setMessage(`${attacker.name}: cannot attack while holding money dart.`);
    return;
  }
  if (isUnitCastingNinju(attacker) || isUnitInNinjuGap(attacker)) {
    setMessage(`${attacker.name}: cannot attack while using ninjutsu.`);
    return;
  }
  if (!weaponIsReady(attacker)) {
    setMessage(`${attacker.name}: weapon is recovering.`);
    return;
  }
  const dir = directionFromTarget(attacker, cell);
  if (!dir) {
    setMessage(`${attacker.name}: choose a direction to slash.`);
    return;
  }

  const hits = weaponHitInDirection(attacker, dir);
  updateFacing(attacker, { x: attacker.x + dir.dx, y: attacker.y + dir.dy });
  playSlash(attacker, weaponSlashAnchorCell(attacker, dir));
  markWeaponUsed(attacker);
  const targetCount = hits.units.length + hits.objects.length;
  if (targetCount === 0) {
    setMessage(`${attacker.name} slashed.`);
    return;
  }

  for (const unit of hits.units) {
    damageUnit(unit, unitWeaponDamage(attacker), `${attacker.name} attacked ${unit.name}`, false, attacker);
  }
  for (const object of hits.objects) {
    damageObject(object, attacker);
  }
  setMessage(`${attacker.name} hit ${targetCount} targets.`);
}

// 點遠處時推算方向，再攻擊角色旁邊一格。
function attackAimedWeapon(attacker, targetCell) {
  if (attacker.moneyDart) {
    setMessage(`${attacker.name}: cannot attack while holding money dart.`);
    return;
  }
  if (isUnitCastingNinju(attacker) || isUnitInNinjuGap(attacker)) {
    setMessage(`${attacker.name}: cannot attack while using ninjutsu.`);
    return;
  }
  if (!weaponIsReady(attacker)) {
    setMessage(`${attacker.name}: weapon is recovering.`);
    return;
  }
  const dir = weaponDirectionFromTarget(attacker, targetCell);
  if (!dir) {
    setMessage(`${attacker.name}: choose a direction to slash.`);
    return;
  }
  attackCell(attacker, { x: attacker.x + dir.dx, y: attacker.y + dir.dy });
}

// 判斷角色武器冷卻是否結束。
function weaponIsReady(unit) {
  return performance.now() >= (unit.weaponReadyAt || 0);
}

// 記錄角色本次揮砍時間，套用武器冷卻。
function markWeaponUsed(unit) {
  const weapon = weaponDefinitionByKey[unit.weaponKey] || weaponDefinitionByKey[defaultWeaponKey];
  unit.weaponReadyAt = performance.now() + (weapon.cooldownMs || weaponCooldownMs);
}

// 取得角色目前武器傷害；若武器未設置則回退到全域傷害。
function unitWeaponDamage(unit) {
  const weapon = weaponDefinitionByKey[unit.weaponKey] || weaponDefinitionByKey[defaultWeaponKey];
  if (!weapon) return weaponDamage;
  const baseDamage = weaponDamageForMode(weapon.key, weapon.damage ?? weaponDamage);
  return isHotBloodActive(unit) ? baseDamage * hotBloodRule().weaponDamageMultiplier : baseDamage;
}

// 依武器種類取得實際攻擊格形。
function weaponAreaCells(attacker, dir) {
  const weapon = weaponDefinitionByKey[attacker.weaponKey] || weaponDefinitionByKey[defaultWeaponKey];
  const x = attacker.x;
  const y = attacker.y;
  if (weapon.area === "single") {
    return [{ x: x + dir.dx, y: y + dir.dy }].filter((cell) => inside(cell.x, cell.y));
  }
  if (weapon.area === "line2") {
    return [
      { x: x + dir.dx, y: y + dir.dy },
      { x: x + dir.dx * 2, y: y + dir.dy * 2 },
    ].filter((cell) => inside(cell.x, cell.y));
  }
  if (weapon.area === "fan") {
    const shapes = {
      up: [{ x: x - 1, y: y - 1 }, { x, y: y - 1 }, { x: x + 1, y: y - 1 }, { x: x - 1, y }, { x: x + 1, y }],
      down: [{ x: x - 1, y: y + 1 }, { x, y: y + 1 }, { x: x + 1, y: y + 1 }, { x: x - 1, y }, { x: x + 1, y }],
      left: [{ x: x - 1, y: y - 1 }, { x: x - 1, y }, { x: x - 1, y: y + 1 }, { x, y: y - 1 }, { x, y: y + 1 }],
      right: [{ x: x + 1, y: y - 1 }, { x: x + 1, y }, { x: x + 1, y: y + 1 }, { x, y: y - 1 }, { x, y: y + 1 }],
    };
    return (shapes[dir.name] || []).filter((cell) => inside(cell.x, cell.y));
  }
  const shapes = {
    up: [{ x: x - 1, y: y - 1 }, { x, y: y - 1 }, { x: x + 1, y: y - 1 }],
    down: [{ x: x - 1, y: y + 1 }, { x, y: y + 1 }, { x: x + 1, y: y + 1 }],
    left: [{ x: x - 1, y }, { x: x - 1, y: y + 1 }],
    right: [{ x: x + 1, y }, { x: x + 1, y: y + 1 }],
  };
  return (shapes[dir.name] || []).filter((cell) => inside(cell.x, cell.y));
}

// 判斷指定格是否落在目前武器攻擊格形中。
function isCellInWeaponRange(attacker, cell, dir) {
  return weaponAreaCells(attacker, dir).some((hitCell) => hitCell.x === cell.x && hitCell.y === cell.y);
}

// 點到特殊格形時，先用格形決定方向；沒有落在格形時才退回一般滑鼠角度方向。
function weaponDirectionFromTarget(attacker, target) {
  const preferred = directionFromTarget(attacker, target);
  if (preferred && isCellInWeaponRange(attacker, target, preferred)) return preferred;
  const directions = [
    { name: "up", dx: 0, dy: -1 },
    { name: "down", dx: 0, dy: 1 },
    { name: "left", dx: -1, dy: 0 },
    { name: "right", dx: 1, dy: 0 },
  ];
  return directions.find((dir) => isCellInWeaponRange(attacker, target, dir)) || preferred;
}

// 取得武器動畫錨點；動畫用前方鄰格，避免組合圖被拉到範圍最遠處而偏掉。
function weaponSlashAnchorCell(attacker, dir) {
  return { x: attacker.x + dir.dx, y: attacker.y + dir.dy };
}

// 依武器格形掃描 AOE，範圍內所有敵人與可破壞物件都會被命中。
function weaponHitInDirection(attacker, dir) {
  const hits = { units: [], objects: [] };
  for (const cell of weaponAreaCells(attacker, dir)) {
    const unit = unitAt(cell.x, cell.y);
    if (unit && unit.team !== attacker.team && !isUnitInvincible(unit)) {
      hits.units.push(unit);
    }

    const object = objectAt(cell.x, cell.y);
    if (object?.breakable) {
      hits.objects.push(object);
    }
  }
  return hits;
}

// 加入一筆揮砍動畫並播放武器音效。
function playSlash(attacker, target) {
  playSound("slash");
  if (!state.attacks) state.attacks = [];
  const direction = directionFromTarget(attacker, target)?.name || attacker.facing;
  const weapon = weaponDefinitionByKey[attacker.weaponKey] || weaponDefinitionByKey[defaultWeaponKey];
  state.attacks.push({
    from: { x: attacker.x, y: attacker.y },
    to: { x: target.x, y: target.y },
    direction,
    weaponKey: attacker.weaponKey || defaultWeaponKey,
    startedAt: performance.now(),
    duration: weapon?.cooldownMs || weaponCooldownMs,
    side: attacker.id % 2 === 0 ? -1 : 1,
  });
}
