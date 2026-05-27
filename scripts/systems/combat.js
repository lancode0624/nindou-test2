// ===== Combat =====
function attack(attacker, target) {
  if (isUnitDisabled(attacker)) {
    setMessage(`${attacker.name}: cannot act now.`);
    return;
  }
  if (attacker.moneyDart) {
    setMessage(`${attacker.name}: cannot attack while holding money dart.`);
    return;
  }
  if (isUnitCastingNinju(attacker)) {
    setMessage(`${attacker.name}: cannot attack while using ninjutsu.`);
    return;
  }
  if (attacker.moveTrail && (performance.now() - attacker.moveTrail.startedAt) < ARRIVE_TOTAL) {
    setMessage(`${attacker.name}: cannot attack while moving.`);
    return;
  }
  if (activeMoneyDartCast(attacker)) {
    setMessage(`${attacker.name}: cannot attack while throwing money dart.`);
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
    gainSoul(target, soulDeathGainSteps);
    if (attacker && attacker !== target) attacker.kills += 1;
    cancelDragIfPressed(target);
    playSound("death");
    setMessage(`${target.name} defeated.`);
    checkVictory();
  }
  return damage;
}

function recordDamage(attacker, target, damage, options = {}) {
  const amount = Math.max(0, damage);
  if (target) target.damageTaken += amount;
  if (options.skipSoulGain) return;
  if (attacker && attacker !== target) {
    attacker.damageDone += amount;
    gainSoul(attacker, soulCombatGainSteps);
  }
  if (target) gainSoul(target, soulCombatGainSteps);
}

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

function attackCell(attacker, cell) {
  if (isUnitDisabled(attacker)) {
    setMessage(`${attacker.name}: cannot act now.`);
    return;
  }
  if (attacker.moneyDart) {
    setMessage(`${attacker.name}: cannot attack while holding money dart.`);
    return;
  }
  if (isUnitCastingNinju(attacker) || isUnitInNinjuGap(attacker)) {
    setMessage(`${attacker.name}: cannot attack while using ninjutsu.`);
    return;
  }
  if (attacker.moveTrail && (performance.now() - attacker.moveTrail.startedAt) < ARRIVE_TOTAL) {
    setMessage(`${attacker.name}: cannot attack while moving.`);
    return;
  }
  if (activeMoneyDartCast(attacker)) {
    setMessage(`${attacker.name}: cannot attack while throwing money dart.`);
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

function attackAimedWeapon(attacker, targetCell) {
  if (isUnitDisabled(attacker)) {
    setMessage(`${attacker.name}: cannot act now.`);
    return;
  }
  if (attacker.moneyDart) {
    setMessage(`${attacker.name}: cannot attack while holding money dart.`);
    return;
  }
  if (isUnitCastingNinju(attacker) || isUnitInNinjuGap(attacker)) {
    setMessage(`${attacker.name}: cannot attack while using ninjutsu.`);
    return;
  }
  if (attacker.moveTrail && (performance.now() - attacker.moveTrail.startedAt) < ARRIVE_TOTAL) {
    setMessage(`${attacker.name}: cannot attack while moving.`);
    return;
  }
  if (activeMoneyDartCast(attacker)) {
    setMessage(`${attacker.name}: cannot attack while throwing money dart.`);
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

function weaponIsReady(unit) {
  return performance.now() >= (unit.weaponReadyAt || 0);
}

function markWeaponUsed(unit) {
  const weapon = weaponDefinitionByKey[unit.weaponKey] || weaponDefinitionByKey[defaultWeaponKey];
  unit.weaponReadyAt = performance.now() + (weapon.cooldownMs || weaponCooldownMs);
}

function unitWeaponDamage(unit) {
  const weapon = weaponDefinitionByKey[unit.weaponKey] || weaponDefinitionByKey[defaultWeaponKey];
  if (!weapon) return weaponDamage;
  const baseDamage = weaponDamageForMode(weapon.key, weapon.damage ?? weaponDamage);
  return isHotBloodActive(unit) ? baseDamage * hotBloodRule().weaponDamageMultiplier : baseDamage;
}

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

function isCellInWeaponRange(attacker, cell, dir) {
  return weaponAreaCells(attacker, dir).some((hitCell) => hitCell.x === cell.x && hitCell.y === cell.y);
}

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

function weaponSlashAnchorCell(attacker, dir) {
  return { x: attacker.x + dir.dx, y: attacker.y + dir.dy };
}

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

function slashSoundKeyForWeapon(weaponKey) {
  const soundByWeapon = {
    weapon1: "slash1",
    weapon3: "slash3",
    weapon4: "slash4",
    weapon6: "slash6",
  };
  return soundByWeapon[weaponKey] || soundByWeapon[defaultWeaponKey];
}

function playSlash(attacker, target) {
  playSound(slashSoundKeyForWeapon(attacker.weaponKey || defaultWeaponKey));
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
