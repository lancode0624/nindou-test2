// ===== Ninjutsu System =====
function updateNinju(now) {
  for (const unit of state.units) {
    if (!unit.ninju) continue;

    if (unit.ninju.phase === "active") {
      if (now - unit.ninju.startedAt < unit.ninju.duration) continue;
      refreshStatusNinju(unit, unit.ninju.type, now);
      const queuedType = unit.ninju.pendingType || unit.ninju.type;

      if (unit.ninju.pendingMoneyDart) {
        unit.ninju = { type: unit.ninju.type, phase: "gap", nextType: "moneyDart", startedAt: now, duration: ninjuChainGap, queue: unit.ninju.queue || 0, gapMoves: 0 };
        if (unit.id === playerUnitId) setMessage(`${unit.name}: money dart chain gap.`);
      } else if (unit.ninju.queue > 0) {
        unit.ninju = { type: unit.ninju.type, phase: "gap", nextType: queuedType, startedAt: now, duration: ninjuChainMaxGap, queue: unit.ninju.queue, gapMoves: 0 };
        if (unit.id === playerUnitId) setMessage(`${unit.name}: ninjutsu chain gap.`);
      } else {
        unit.ninju = null;
        if (unit.id === playerUnitId) setMessage(`${unit.name}: ninjutsu cast finished.`);
      }
      continue;
    }

    if (unit.ninju.phase === "gap") {
      const elapsed = now - unit.ninju.startedAt;
      const firstMoveSucceeded = (unit.ninju.gapMoves || 0) > 0;
      if (!firstMoveSucceeded && elapsed < unit.ninju.duration) continue;
      if (unit.ninju.nextType === "moneyDart") {
        unit.ninju = null;
        startMoneyDart(unit, now, true);
      } else {
        const type = unit.ninju.nextType || unit.ninju.type;
        unit.ninju = { type, phase: "active", startedAt: now, duration: statusNinjuRule(type).castDurationMs, queue: Math.max(0, unit.ninju.queue - 1), chainMoves: firstMoveSucceeded ? ninjuFollowupMoveAllowance : 0 };
        if (canControlUnit(unit)) playSound("useNinju");
        playStatusEnergyUpSequence();
        if (unit.id === playerUnitId) setMessage(`${unit.name}: ninjutsu cast continued.`);
      }
    }
  }
}

function updateProjectiles(now) {
  if (!state.projectiles) return;
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const projectile = state.projectiles[i];
    if (now - projectile.startedAt < projectile.duration) continue;
    if (projectile.hitUnitId) {
      const target = state.units.find((unit) => unit.id === projectile.hitUnitId);
      if (target && target.alive && !isUnitInvincible(target)) {
        damageUnit(target, moneyDartRule().damage, `${projectile.ownerName} hit ${target.name} with money dart`);
      }
    }
    state.projectiles.splice(i, 1);
  }
}

function useSteelNinju() {
  useStatusNinju("steel", "Steel");
}

function useHotBloodNinju() {
  useStatusNinju("hotBlood", "Hot blood");
}

function useStatusNinju(type, label) {
  const unit = selectedUnit();
  if (!unit || !canControlUnit(unit)) return;
  if (unit.moneyDart) {
    setMessage(`${unit.name}: cannot use ninjutsu while holding money dart.`);
    return;
  }
  const rule = statusNinjuRule(type);
  if ((unit.ninjuLockedUntil || 0) > performance.now()) {
    setMessage(`${unit.name}: cannot use ninjutsu yet.`);
    return;
  }
  if (unit.skill < rule.cost) {
    setMessage(`${label} needs ${rule.cost} skill.`);
    return;
  }

  unit.skill -= rule.cost;
  const now = performance.now();

  if (unit.ninju && isStatusNinjuType(unit.ninju.type)) {
    unit.ninju.pendingType = type;
    unit.ninju.queue = (unit.ninju.queue || 0) + 1;
    setMessage(`${unit.name} queued ${label}.`);
  } else {
    unit.ninju = { type, phase: "active", startedAt: now, duration: rule.castDurationMs, queue: 0 };
    playStatusEnergyUpSequence();
    setMessage(`${unit.name} used ${label}.`);
  }
  playSound("useNinju");
  clearDragState();
}

function useMoneyDart() {
  const unit = selectedUnit();
  if (!unit || !canControlUnit(unit)) return;
  if (unit.moneyDart) {
    setMessage(`${unit.name}: money dart is already ready.`);
    return;
  }
  if ((unit.ninjuLockedUntil || 0) > performance.now()) {
    setMessage(`${unit.name}: cannot use ninjutsu yet.`);
    return;
  }
  if (isUnitCastingNinju(unit)) {
    if (unit.ninju.pendingMoneyDart) {
      setMessage(`${unit.name}: money dart is already queued.`);
      return;
    }
    unit.ninju.pendingMoneyDart = true;
    playSound("useNinju");
    playSound("takeDart");
    clearDragState();
    setMessage(`${unit.name}: money dart queued after ninjutsu.`);
    return;
  }
  if (isUnitInNinjuGap(unit)) {
    unit.ninju.nextType = "moneyDart";
    playSound("useNinju");
    playSound("takeDart");
    clearDragState();
    setMessage(`${unit.name}: money dart queued in the chain gap.`);
    return;
  }
  playSound("useNinju");
  startMoneyDart(unit, performance.now(), true);
}

function startMoneyDart(unit, now = performance.now(), playActivationSound = true) {
  if (unit.moneyDart) return;
  unit.moneyDart = { startedAt: now, invincibleUntil: now + moneyDartReadyMs };
  if (playActivationSound) playSound("takeDart");
  if (canControlUnit(unit)) clearDragState();
  setMessage(`${unit.name}: money dart ready. Choose up, down, left, or right.`);
}

function throwMoneyDart(unit, targetCell) {
  if (!unit.moneyDart) return;
  const now = performance.now();
  if (now < unit.moneyDart.invincibleUntil) {
    setMessage(`${unit.name}: money dart is ready after the invincible moment.`);
    return;
  }
  if (isUnitCastingNinju(unit)) {
    setMessage(`${unit.name}: cannot throw while using ninjutsu.`);
    return;
  }

  const dir = directionFromTarget(unit, targetCell);
  if (!dir) {
    setMessage(`${unit.name}: choose a straight direction for money dart.`);
    return;
  }

  const shot = traceMoneyDart(unit, dir);
  updateFacing(unit, targetCell);
  playSound("shootDart");
  unit.moneyDart = null;
  state.moneyDartCasts = state.moneyDartCasts.filter((cast) => cast.unitId !== unit.id);
  if (shot.hitUnit && shot.hitUnit.alive && !isUnitInvincible(shot.hitUnit)) {
    damageUnit(shot.hitUnit, moneyDartRule().damage, `${unit.name} hit ${shot.hitUnit.name} with money dart`, true, unit);
  }
  state.projectiles.push({
    from: { x: unit.x, y: unit.y },
    to: shot.to,
    dir: dir.name,
    hitUnitId: null,
    ownerName: unit.name,
    startedAt: now,
    duration: Math.max(160, shot.distance * grid.cell / moneyDartSpeed * 1000),
  });
  // AI 丟錢鏢不播放出手動畫，避免畫面瞬間閃爍；玩家仍保留原動畫。
  if (canControlUnit(unit)) {
    state.moneyDartCasts.push({
      unitId: unit.id,
      dir: dir.name,
      startedAt: now,
      duration: 300,
    });
  }
  unit.ninjuLockedUntil = now + moneyDartPostThrowNinjuLockMs;
  setMessage(`${unit.name} threw money dart.`);
}

function traceMoneyDart(unit, dir) {
  let x = unit.x + dir.dx;
  let y = unit.y + dir.dy;
  let last = { x: unit.x, y: unit.y };
  let distance = 0;

  while (inside(x, y)) {
    if (isPermanentObstacle(x, y) || objectAt(x, y)) break;
    distance += 1;
    last = { x, y };
    const other = unitAt(x, y);
    if (other && other.id !== unit.id) {
      if (other.team !== unit.team) return { to: { x, y }, hitUnit: other, distance };
    }
    x += dir.dx;
    y += dir.dy;
  }

  if (distance === 0) {
    return { to: { x: unit.x + dir.dx, y: unit.y + dir.dy }, hitUnit: null, distance: 1 };
  }
  return { to: last, hitUnit: null, distance };
}

function isUnitCastingNinju(unit) {
  return Boolean(unit && unit.ninju && isStatusNinjuType(unit.ninju.type) && unit.ninju.phase === "active" && performance.now() - unit.ninju.startedAt < unit.ninju.duration);
}

function canUnitMoveNow(unit) {
  if (!isUnitCastingNinju(unit)) return true;
  return Boolean(unit.ninju && unit.ninju.chainMoves > 0);
}

function isUnitInvincible(unit) {
  return isUnitCastingNinju(unit) || isUnitInNinjuGap(unit) || isMoneyDartInvincible(unit);
}

function isMoneyDartInvincible(unit) {
  return Boolean(unit && unit.moneyDart && performance.now() < unit.moneyDart.invincibleUntil);
}

function isUnitInNinjuGap(unit) {
  return Boolean(unit && unit.ninju && isStatusNinjuType(unit.ninju.type) && unit.ninju.phase === "gap" && performance.now() - unit.ninju.startedAt < unit.ninju.duration);
}

function isSteelDefenseActive(unit) {
  return Boolean(unit && unit.steelUntil && performance.now() < unit.steelUntil);
}

function isHotBloodActive(unit) {
  return Boolean(unit && unit.hotBloodUntil && performance.now() < unit.hotBloodUntil);
}

function refreshStatusNinju(unit, type, now = performance.now()) {
  if (type === "steel") {
    unit.steelUntil = now + steelRule().durationMs;
    unit.buffAuraType = "steel";
  }
  if (type === "hotBlood") {
    unit.hotBloodUntil = now + hotBloodRule().durationMs;
    unit.buffAuraType = "hotBlood";
  }
}

function statusNinjuRule(type) {
  return type === "hotBlood" ? hotBloodRule() : steelRule();
}

function isStatusNinjuType(type) {
  return type === "steel" || type === "hotBlood";
}

function defendedDamage(unit, baseDamage) {
  return isSteelDefenseActive(unit) ? baseDamage / steelRule().defenseMultiplier : baseDamage;
}

function playStatusEnergyUpSequence() {
  const first = playSound("statusEnergyUp1");
  if (!first) return;
  const onFirstEnded = () => {
    first.removeEventListener("ended", onFirstEnded);
    playSound("statusEnergyUp2");
  };
  first.addEventListener("ended", onFirstEnded);
}
