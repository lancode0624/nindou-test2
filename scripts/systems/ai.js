// ===== AI =====
const aiProfiles = {
  ai_beginner: {
    reactionMultiplier: 1,
    skillRegenMultiplier: 1,
    meleeAttackChance: 0.55,
    chaseChance: 0.84,
    thinkMinMs: 320,
    thinkRandMs: 360,
    steelUseChance: 0,
    moneyDartReadyChance: 0,
    moneyDartThrowChance: 0,
  },
  ai_money_dart_master: {
    reactionMultiplier: 0.5,
    skillRegenMultiplier: 2,
    meleeAttackChance: 0.86,
    chaseChance: 0.96,
    thinkMinMs: 300,
    thinkRandMs: 300,
    steelUseChance: 0.01,
    moneyDartReadyChance: 1,
    moneyDartThrowChance: 1,
  },
  ai_dart_only_master: {
    reactionMultiplier: 0.5,
    skillRegenMultiplier: 2,
    meleeAttackChance: 0,
    chaseChance: 0.98,
    thinkMinMs: 300,
    thinkRandMs: 300,
    steelUseChance: 0.01,
    moneyDartReadyChance: 1,
    moneyDartThrowChance: 1,
  },
};

function aiProfile(unit) {
  return aiProfiles[unit?.controlMode] || aiProfiles.ai_beginner;
}

function isMoneyDartFocusedAi(unit) {
  return unit?.controlMode === "ai_money_dart_master" || unit?.controlMode === "ai_dart_only_master";
}

// 更新電腦角色的判斷、攻擊、移動與脫困行為。
function updateAi(dt, now) {
  if (state.gameOver) return;

  for (const unit of state.units) {
    if (canControlUnit(unit) || !unit.alive || unit.respawning || isUnitCastingNinju(unit) || isUnitDisabled(unit)) continue;

    const profile = aiProfile(unit);
    unit.skill = Math.min(maxSkill, unit.skill + aiSkillRegenPerSecond * profile.skillRegenMultiplier * dt);

    if (tryAiNinjutsu(unit, profile, now)) {
      unit.aiNextThink = now + profile.thinkMinMs + Math.random() * profile.thinkRandMs;
      continue;
    }

    if (tryAiThrowMoneyDart(unit, profile, now)) {
      unit.aiNextThink = now + profile.thinkMinMs + Math.random() * profile.thinkRandMs;
      continue;
    }

    const target = nearestEnemy(unit, unit.team === "blue" ? "grey" : "blue");
    if (!target) {
      unit.aiNextThink = now + 1000;
      checkVictory();
      continue;
    }

    if (unit.moveT >= 1 && aiIsTrappedByBreakable(unit) && aiBreakOut(unit, target)) {
      continue;
    }

    if (unit.moveT < 1 || now < unit.aiNextThink) continue;

    const dist = manhattan(unit, target);
    const planKey = `${target.id}:${target.x},${target.y}:${unit.x},${unit.y}`;
    if (unit.aiPlanKey !== planKey) {
      unit.aiPlanKey = planKey;
      unit.aiActionAt = now + aiReactionDelay(dist, profile.reactionMultiplier);
      continue;
    }
    if (now < unit.aiActionAt) continue;

    unit.aiPlanKey = "";
    unit.aiActionAt = 0;

    if (unit.controlMode === "ai_dart_only_master") {
      // 尬鏢神人：不近戰、不撞人、不用武器，只追線丟錢鏢。
      const acted = aiStepToMoneyDartLine(unit, target) || aiPathMoveToward(unit, target) || aiStepToward(unit, target) || aiRandomMove(unit);
      if (!acted) aiBreakOut(unit, target);
      unit.aiNextThink = Math.max(unit.aiNextThink, now + profile.thinkMinMs + Math.random() * profile.thinkRandMs);
      continue;
    }

    // 錢鏢神人：先優先走到可直線命中的位置，再進入一般近戰行為。
    if (unit.controlMode === "ai_money_dart_master" && !unit.moneyDart && !aiMoneyDartAimCell(unit)) {
      if (aiStepToMoneyDartLine(unit, target)) {
        unit.aiNextThink = Math.max(unit.aiNextThink, now + profile.thinkMinMs + Math.random() * profile.thinkRandMs);
        continue;
      }
    }

    if (dist === 1) {
      if (isUnitInvincible(target)) {
        unit.aiNextThink = now + 500 + Math.random() * 500;
        continue;
      }
      if (Math.random() < profile.meleeAttackChance || unit.skill < 1) {
        attack(unit, target);
        unit.aiNextThink = now + profile.thinkMinMs + Math.random() * profile.thinkRandMs;
      } else {
        aiMoveUnit(unit, { x: target.x, y: target.y });
      }
      continue;
    }

    if (isStraightMove(unit, target) && unit.skill >= dist && clearStraightPath(unit, target, target)) {
      aiMoveUnit(unit, { x: target.x, y: target.y });
      continue;
    }

    const acted = Math.random() < profile.chaseChance
      ? (aiPathMoveToward(unit, target) || aiStepToward(unit, target))
      : aiRandomMove(unit);
    if (!acted) aiBreakOut(unit, target);
    unit.aiNextThink = Math.max(unit.aiNextThink, now + profile.thinkMinMs + Math.random() * profile.thinkRandMs);
  }
}

// 依照距離計算 AI 反應時間，越遠反應越慢。
function aiReactionDelay(distance, multiplier = 1) {
  return (400 + Math.max(1, distance) * 100 + Math.random() * 180) * multiplier;
}

// 找出離自己最近的敵方角色。
function nearestEnemy(unit, enemyTeam) {
  let best = null;
  let bestDist = Infinity;
  for (const other of state.units) {
    if (!other.alive || other.team !== enemyTeam) continue;
    const dist = manhattan(unit, other);
    if (dist < bestDist) {
      best = other;
      bestDist = dist;
    }
  }
  return best;
}

// 讓 AI 消耗技移動到指定格子。
function aiMoveUnit(unit, cell) {
  if (isUnitDisabled(unit)) return false;
  if (isUnitCastingNinju(unit)) return false;
  if (unit.moneyDart) return false;
  if (!weaponIsReady(unit)) return false;
  if (!cell || unit.skill < 1) return false;
  if (!isStraightMove(unit, cell)) return false;
  const cost = Math.max(1, manhattan(unit, cell));
  if (unit.skill < cost) return false;
  if (isPermanentObstacle(cell.x, cell.y) || objectAt(cell.x, cell.y)) return false;

  const targetUnit = unitAt(cell.x, cell.y);
  if (targetUnit && isUnitInvincible(targetUnit)) return false;
  if (targetUnit && targetUnit.team === unit.team) return false;
  if (!clearStraightPath(unit, cell, targetUnit)) return false;

  unit.skill -= cost;
  moveUnit(unit, cell.x, cell.y);
  unit.aiNextThink = performance.now() + 650 + Math.random() * 420;
  unit.aiPlanKey = "";
  unit.aiActionAt = 0;

  if (targetUnit) {
    collideWithEnemy(unit, targetUnit);
  } else {
    setMessage(`${unit.name} moved.`);
  }
  return true;
}

// 計算 AI 往目標靠近時下一步可走格。
function aiStepToward(unit, target) {
  const options = [];
  const maxSteps = Math.max(1, Math.min(3, Math.floor(unit.skill)));
  const directions = [
    { dx: Math.sign(target.x - unit.x), dy: 0 },
    { dx: 0, dy: Math.sign(target.y - unit.y) },
    { dx: -Math.sign(target.x - unit.x), dy: 0 },
    { dx: 0, dy: -Math.sign(target.y - unit.y) },
  ];

  for (const direction of directions) {
    if (direction.dx === 0 && direction.dy === 0) continue;
    for (let step = maxSteps; step >= 1; step--) {
      const cell = { x: unit.x + direction.dx * step, y: unit.y + direction.dy * step };
      if (!inside(cell.x, cell.y)) continue;
      if (!clearStraightPath(unit, cell, null)) continue;
      if (isBlockedCell(cell.x, cell.y) || unitAt(cell.x, cell.y)) continue;
      options.push({ cell, score: manhattan(cell, target) + Math.random() * 0.6 });
      break;
    }
  }

  options.sort((a, b) => a.score - b.score);
  if (options[0]) return aiMoveUnit(unit, options[0].cell);
  return false;
}

// 以 BFS 找繞路下一步，避免在障礙旁左右抖動。
function aiPathMoveToward(unit, target) {
  const nextCell = aiPathNextCell(unit, target);
  if (!nextCell) return false;
  return aiMoveUnit(unit, nextCell);
}

function aiPathNextCell(unit, target) {
  const maxSteps = Math.max(1, Math.min(3, Math.floor(unit.skill)));
  if (maxSteps < 1) return null;
  const startKey = `${unit.x},${unit.y}`;
  const queue = [{ x: unit.x, y: unit.y }];
  const cameFrom = new Map();
  cameFrom.set(startKey, "");
  let bestKey = startKey;
  let bestScore = manhattan(unit, target);

  while (queue.length > 0) {
    const current = queue.shift();
    const currentKey = `${current.x},${current.y}`;
    const score = manhattan(current, target);
    if (score < bestScore) {
      bestScore = score;
      bestKey = currentKey;
      if (score <= 1) break;
    }

    for (const n of neighbors(current.x, current.y)) {
      const key = `${n.x},${n.y}`;
      if (cameFrom.has(key)) continue;
      if (!inside(n.x, n.y)) continue;
      if (isBlockedCell(n.x, n.y)) continue;
      if (isPermanentObstacle(n.x, n.y) || objectAt(n.x, n.y)) continue;
      const other = unitAt(n.x, n.y);
      if (other && other.id !== unit.id) continue;
      cameFrom.set(key, currentKey);
      queue.push(n);
    }
  }

  if (bestKey === startKey) return null;

  const path = [];
  let cursor = bestKey;
  while (cursor && cursor !== startKey) {
    const [x, y] = cursor.split(",").map(Number);
    path.push({ x, y });
    cursor = cameFrom.get(cursor);
  }
  path.reverse();
  if (path.length === 0) return null;

  const first = path[0];
  const dirX = Math.sign(first.x - unit.x);
  const dirY = Math.sign(first.y - unit.y);
  let chosen = first;
  let steps = 1;
  while (steps < path.length && steps < maxSteps) {
    const cell = path[steps];
    if (Math.sign(cell.x - chosen.x) !== dirX || Math.sign(cell.y - chosen.y) !== dirY) break;
    chosen = cell;
    steps += 1;
  }
  return chosen;
}

// 讓 AI 在可走方向中隨機移動。
function aiRandomMove(unit) {
  const options = [];
  const maxSteps = Math.max(1, Math.min(2, Math.floor(unit.skill)));
  for (const direction of [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }]) {
    for (let step = 1; step <= maxSteps; step++) {
      const cell = { x: unit.x + direction.dx * step, y: unit.y + direction.dy * step };
      if (!inside(cell.x, cell.y) || isBlockedCell(cell.x, cell.y) || unitAt(cell.x, cell.y)) break;
      options.push(cell);
    }
  }
  if (options.length > 0) return aiMoveUnit(unit, options[Math.floor(Math.random() * options.length)]);
  return false;
}

// AI 被草或障礙困住時，嘗試揮砍旁邊物件脫困。
function aiBreakOut(unit, target) {
  if (!weaponIsReady(unit)) {
    unit.aiNextThink = performance.now() + 80;
    return true;
  }

  const options = neighbors(unit.x, unit.y)
    .map((cell) => ({ cell, object: objectAt(cell.x, cell.y) }))
    .filter((entry) => entry.object && entry.object.breakable);

  if (options.length === 0) return false;

  options.sort((a, b) => {
    const aScore = manhattan(a.cell, target) + a.object.hp / Math.max(1, a.object.maxHp);
    const bScore = manhattan(b.cell, target) + b.object.hp / Math.max(1, b.object.maxHp);
    return aScore - bScore;
  });

  attackCell(unit, options[0].cell);
  unit.aiNextThink = performance.now() + 80 + Math.random() * 80;
  unit.aiPlanKey = "";
  unit.aiActionAt = 0;
  return true;
}

function aiIsTrappedByBreakable(unit) {
  let hasBreakableNeighbor = false;
  let hasOpenNeighbor = false;

  for (const cell of neighbors(unit.x, unit.y)) {
    if (!inside(cell.x, cell.y)) continue;
    const object = objectAt(cell.x, cell.y);
    if (object?.breakable) hasBreakableNeighbor = true;
    if (!isBlockedCell(cell.x, cell.y) && !object && !unitAt(cell.x, cell.y)) {
      hasOpenNeighbor = true;
    }
  }

  return hasBreakableNeighbor && !hasOpenNeighbor;
}

function tryAiNinjutsu(unit, profile, now) {
  if (isUnitDisabled(unit)) return false;
  if ((unit.ninjuLockedUntil || 0) > now) return false;
  if (unit.ninju || unit.moneyDart) return false;

  if (unit.controlMode === "ai_dart_only_master") {
    const steel = steelRule();
    if (!isSteelDefenseActive(unit) && unit.skill >= steel.cost && Math.random() < profile.steelUseChance) {
      unit.skill -= steel.cost;
      unit.ninju = { type: "steel", phase: "active", startedAt: now, duration: steel.castDurationMs, queue: 0 };
      playStatusEnergyUpSequence();
      return true;
    }
    if (Math.random() < profile.moneyDartReadyChance && aiCanStartMoneyDartAfterLineDelay(unit, now)) {
      unit.moneyDartLineSince = 0;
      startMoneyDart(unit, now, true);
      return true;
    }
    return false;
  }

  const steel = steelRule();
  if (!isSteelDefenseActive(unit) && unit.skill >= steel.cost && Math.random() < profile.steelUseChance) {
    unit.skill -= steel.cost;
    unit.ninju = { type: "steel", phase: "active", startedAt: now, duration: steel.castDurationMs, queue: 0 };
    playStatusEnergyUpSequence();
    return true;
  }

  // 只有有直線可命中的敵人時才準備錢鏢，避免拿了就亂丟。
  if (Math.random() < profile.moneyDartReadyChance && (!isMoneyDartFocusedAi(unit) ? aiMoneyDartAimCell(unit) : aiCanStartMoneyDartAfterLineDelay(unit, now))) {
    if (isMoneyDartFocusedAi(unit)) unit.moneyDartLineSince = 0;
    startMoneyDart(unit, now, true);
    return true;
  }
  return false;
}

function aiCanStartMoneyDartAfterLineDelay(unit, now) {
  if (!aiMoneyDartAimCell(unit)) {
    unit.moneyDartLineSince = 0;
    return false;
  }
  if (!unit.moneyDartLineSince) unit.moneyDartLineSince = now;
  return now - unit.moneyDartLineSince >= 300;
}

function tryAiThrowMoneyDart(unit, profile, now) {
  if (!unit.moneyDart || now < unit.moneyDart.invincibleUntil || isUnitCastingNinju(unit)) return false;

  // 手持錢鏢後，AI 一旦可丟就立刻丟，不再等機率。
  const aimCell = aiMoneyDartAimCell(unit);
  if (!aimCell) {
    // 目標不在直線時取消手持，回到移動找線。
    unit.moneyDart = null;
    return false;
  }
  throwMoneyDart(unit, aimCell);
  return true;
}

// AI 錢鏢瞄準：只對同列/同行且中間無阻擋的敵人出手，優先最近目標。
function aiMoneyDartAimCell(unit) {
  const enemyTeam = unit.team === "blue" ? "grey" : "blue";
  const dirs = [
    { dx: 1, dy: 0, cell: { x: unit.x + 1, y: unit.y } },
    { dx: -1, dy: 0, cell: { x: unit.x - 1, y: unit.y } },
    { dx: 0, dy: 1, cell: { x: unit.x, y: unit.y + 1 } },
    { dx: 0, dy: -1, cell: { x: unit.x, y: unit.y - 1 } },
  ];
  let best = null;

  for (const dir of dirs) {
    let x = unit.x + dir.dx;
    let y = unit.y + dir.dy;
    let dist = 0;
    while (inside(x, y)) {
      if (isPermanentObstacle(x, y) || objectAt(x, y)) break;
      dist += 1;
      const other = unitAt(x, y);
      if (other) {
        if (other.team === enemyTeam && other.alive) {
          if (!best || dist < best.dist) best = { cell: dir.cell, dist };
        }
        break;
      }
      x += dir.dx;
      y += dir.dy;
    }
  }

  return best ? best.cell : null;
}

// 錢鏢神人走位：往「能和目標同列/同行且可直線命中」的格子靠。
function aiStepToMoneyDartLine(unit, target) {
  const options = [];
  const maxSteps = Math.max(1, Math.min(3, Math.floor(unit.skill)));
  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  for (const direction of directions) {
    for (let step = maxSteps; step >= 1; step--) {
      const cell = { x: unit.x + direction.dx * step, y: unit.y + direction.dy * step };
      if (!inside(cell.x, cell.y)) continue;
      if (!clearStraightPath(unit, cell, null)) continue;
      if (isBlockedCell(cell.x, cell.y) || unitAt(cell.x, cell.y)) continue;
      if (cell.x !== target.x && cell.y !== target.y) continue;
      if (!clearStraightPath(cell, target, target)) continue;
      options.push({
        cell,
        score: manhattan(cell, target) + Math.random() * 0.4,
      });
      break;
    }
  }

  options.sort((a, b) => a.score - b.score);
  if (options[0]) return aiMoveUnit(unit, options[0].cell);
  return false;
}
