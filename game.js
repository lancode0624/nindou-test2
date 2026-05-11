// ===== DOM / Canvas =====
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const statusEl = document.querySelector("#status");
const unitInfoEl = document.querySelector("#unitInfo");
const skillFillEl = document.querySelector("#skillFill");
const resetBtn = document.querySelector("#resetBtn");
const battleStartBtn = document.querySelector("#battleStartBtn");
const musicVolumeInput = document.querySelector("#musicVolume");
const sfxVolumeInput = document.querySelector("#sfxVolume");
const ruleModeToggle = document.querySelector("#ruleModeToggle");
const ruleModeCheckbox = document.querySelector("#ruleModeCheckbox");
const roomCardEls = Array.from(document.querySelectorAll(".room-player-card"));
const weaponSelectEls = Array.from(document.querySelectorAll(".room-weapon-select"));
const controlSelectEls = Array.from(document.querySelectorAll(".room-control-select"));
const hpInputEls = Array.from(document.querySelectorAll(".room-hp-input"));

// ===== Runtime State =====
const state = {
  inRoom: true,
  units: [],
  selectedId: 1,
  pointer: { x: 0, y: 0, cell: null },
  pressedUnit: null,
  pressTime: 0,
  dragMoved: false,
  charging: false,
  message: "Ready",
  gameOver: false,
  countdownStart: 0,
  matchStart: 0,
  matchEnd: 0,
  result: null,
  resultClickableAt: 0,
  startSoundPlayed: false,
  endSoundPlayed: false,
  endSoundInstance: null,
  pulse: 0,
  lastFrame: performance.now(),
  projectiles: [],
  moneyDartCasts: [],
  useOriginalMode: false,
};

// 眼睛貼圖位置（相對角色中心）。X 正值往右，Y 正值往下。
// 你可以直接調這裡微調外觀。
const eyeOffsets = {
  down: { x: -14, y: -25, w: 30, h: 13 },  // 下：雙眼；x/y 是 offset，w/h 是眼睛大小。
  up: null,                                  // 上：不顯示眼睛；要顯示時改成 {x,y,w,h}。
  right: { x: 3, y: -26, w: 20, h: 15 },   // 右：單眼；x 加大往右、y 加大往下。
  left: { x: -19, y: -26, w: 20, h: 15 },  // 左：單眼；通常和 right 用不同 x 來貼頭型。
};
const steelOutlineCache = new WeakMap();
const hotBloodOutlineCache = new WeakMap();

// ===== Asset Loading =====
// 載入所有遊戲圖片與動畫影格。
function loadImages() {
  const staticImages = Object.entries(imageSources).map(([key, src]) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      images[key] = img;
      resolve();
    };
    img.onerror = resolve;
    img.src = src;
  }));
  const ninjuImages = defUpFrameSources.map((src, index) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      defUpFrames[index] = img;
      resolve();
    };
    img.onerror = resolve;
    img.src = src;
  }));
  const atkUpImages = atkUpFrameSources.map((src, index) => loadFrame(src, atkUpFrames, index));
  const readyImages = moneyDartReadyFrameSources.map((src, index) => loadFrame(src, moneyDartReadyFrames, index));
  const respawnPointerImages = respawnPointerFrameSources.map((src, index) => loadFrame(src, respawnPointerFrames, index));
  const dragArrowImages = Object.entries(dragArrowFrameSources).flatMap(([direction, sources]) => (
    sources.map((src, index) => loadFrame(src, dragArrowFrames[direction], index))
  ));
  const shootImages = Object.entries(moneyDartShootFrameSources).flatMap(([direction, sources]) => (
    sources.map((src, index) => loadFrame(src, moneyDartShootFrames[direction], index))
  ));
  const weaponImages = weaponDefinitions.flatMap((weapon) => (
    ["right", "left", "up", "down"].flatMap((direction) => (
      ["hand", "attack"].flatMap((kind) => (
        Array.from({ length: weapon.frameCount }, (_, index) => {
          const src = `assets/weapon/${weapon.folder}/${direction}_${kind}/${index + 1}.png`;
          return loadFrame(src, weaponFrames[weapon.key][kind][direction], index);
        })
      ))
    ))
  ));
  const chargeRedImages = chargeRedFrameSources.map((src, index) => loadFrame(src, chargeRedFrames, index));
  const chargeYellowImages = chargeYellowFrameSources.map((src, index) => loadFrame(src, chargeYellowFrames, index));
  return Promise.all([...staticImages, ...ninjuImages, ...atkUpImages, ...chargeRedImages, ...chargeYellowImages, ...readyImages, ...respawnPointerImages, ...dragArrowImages, ...weaponImages, ...shootImages]);
}

// 載入單張動畫影格，成功後放到指定陣列位置。
function loadFrame(src, target, index) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      target[index] = img;
      resolve();
    };
    img.onerror = resolve;
    img.src = src;
  });
}

// ===== Game Setup =====
// 重設一局遊戲的角色、地圖物件、倒數與狀態。
function resetGame() {
  const now = performance.now();
  const keepRoomState = state.inRoom;
  state.objects = buildMapObjects();
  state.units = buildStartingUnits();
  state.attacks = [];
  state.projectiles = [];
  state.moneyDartCasts = [];
  state.selectedId = 1;
  state.pressedUnit = null;
  state.dragMoved = false;
  state.charging = false;
  state.gameOver = false;
  state.countdownStart = 0;
  state.matchStart = now;
  state.matchEnd = 0;
  state.result = null;
  state.resultClickableAt = 0;
  state.startSoundPlayed = true;
  state.endSoundPlayed = false;
  state.endSoundInstance = null;
  state.inRoom = keepRoomState;
  setMessage("Start.");
  updatePanel();
}

// 建立一個角色資料物件，包含血量、技、AI 與統計資料。
function makeUnit(id, name, team, x, y, weaponKey = defaultWeaponKey, controlMode = "ai_beginner", hpMax = maxHp) {
  const aiNextThink = controlMode === "player" ? 0 : performance.now() + 520 + Math.random() * 500;
  return { id, name, team, x, y, hp: hpMax, maxHp: hpMax, skill: maxSkill, facing: team === "blue" ? "right" : "left", alive: true, moveT: 1, fromX: x, fromY: y, hitFlash: 0, respawning: false, respawnTipUntil: 0, aiNextThink, aiActionAt: 0, aiPlanKey: "", ninju: null, steelUntil: 0, hotBloodUntil: 0, buffAuraType: "", moneyDart: null, ninjuLockedUntil: 0, weaponKey, controlMode, weaponReadyAt: 0, kills: 0, damageDone: 0, damageTaken: 0 };
}

// 依照兩隊起始範圍隨機產生本局角色位置。
function buildStartingUnits() {
  const units = [];
  let id = 1;
  const addTeam = (team, label) => {
    const activeSlots = roomCardEls
      .filter((card) => card.classList.contains("active-slot") && card.dataset.team === team)
      .map((card) => Number(card.dataset.slot))
      .sort((a, b) => a - b);
    const cells = shuffledCellsInArea(startingAreas[team]).filter((cell) => !isBlockedCell(cell.x, cell.y) && !units.some((unit) => unit.x === cell.x && unit.y === cell.y));
    const count = Math.min(activeSlots.length, cells.length);
    for (let i = 0; i < count; i++) {
      const slot = activeSlots[i];
      const controlMode = selectedControlMode(team, slot);
      const weaponKey = selectedWeaponKey(team, slot);
      units.push(makeUnit(
        id,
        `${label}${slot}`,
        team,
        cells[i].x,
        cells[i].y,
        weaponKey,
        controlMode,
        selectedHpValue(team, slot),
      ));
      id += 1;
    }
  };

  addTeam("blue", "Blue");
  addTeam("grey", "Grey");
  return units;
}

// 房間武器下拉選單的預設內容；第一個 select 寫在 HTML，其餘空 select 由這裡補齊，避免維護十份 option。
function setupWeaponSelects() {
  if (weaponSelectEls.length === 0) return;
  const optionsHtml = weaponDefinitions.map((weapon) => (
    `<option value="${weapon.key}"${weapon.key === defaultWeaponKey ? " selected" : ""}>${weapon.label}</option>`
  )).join("");
  weaponSelectEls.forEach((select) => {
    if (!select.innerHTML.trim()) select.innerHTML = optionsHtml;
    if (!weaponDefinitionByKey[select.value]) select.value = defaultWeaponKey;
  });
}

// 房間控制模式下拉選單的預設內容；玩家代表不跑 AI，可由使用者操作。
function setupControlSelects() {
  if (controlSelectEls.length === 0) return;
  const optionsHtml = `
    <option value="player">玩家</option>
    <option value="ai_beginner" selected>初心者</option>
    <option value="ai_money_dart_master">錢鏢神人</option>
    <option value="ai_dart_only_master">尬鏢神人</option>
  `;
  controlSelectEls.forEach((select) => {
    if (!select.innerHTML.trim()) {
      select.innerHTML = optionsHtml;
    } else {
      const current = select.value;
      select.innerHTML = optionsHtml;
      select.value = current;
    }
    if (select.value === "ai") select.value = "ai_beginner";
    if (select.value !== "player" && select.value !== "ai_beginner" && select.value !== "ai_money_dart_master" && select.value !== "ai_dart_only_master") select.value = "player";
  });
}

// 房間血量輸入框預設與範圍保護。
function setupHpInputs() {
  if (hpInputEls.length === 0) return;
  hpInputEls.forEach((input) => {
    if (!input.value) input.value = String(maxHp);
    const fixed = clamp(Math.round(Number(input.value) || maxHp), 1, 9999);
    input.value = String(fixed);
    input.addEventListener("change", () => {
      const value = clamp(Math.round(Number(input.value) || maxHp), 1, 9999);
      input.value = String(value);
    });
  });
}

// 房間卡片新增/刪除：預設 blue1、grey1 啟用，其餘顯示新增。
function setupRoomSlots() {
  roomCardEls.forEach((card) => {
    const team = card.dataset.team;
    const slot = Number(card.dataset.slot);
    const addBtn = card.querySelector(".room-slot-add");
    const removeBtn = card.querySelector(".room-slot-remove");
    const nameEl = card.querySelector(".room-name");
    const levelEl = card.querySelector(".room-level");
    const controlEl = card.querySelector(".room-control-select");

    if (addBtn) {
      addBtn.addEventListener("click", () => {
        card.classList.add("active-slot");
        if (nameEl) nameEl.textContent = `${team}${slot}`;
        if (levelEl) levelEl.textContent = `id-${team}${slot}`;
        if (controlEl) controlEl.value = "ai_beginner";
      });
    }
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        if (slot === 1) return;
        card.classList.remove("active-slot");
      });
    }
  });
}

// 依房間卡片上的隊伍與位置，取得該角色進戰鬥後要使用的武器。
function selectedWeaponKey(team, slot) {
  const select = weaponSelectEls.find((element) => element.dataset.team === team && Number(element.dataset.slot) === slot);
  return weaponDefinitionByKey[select?.value] ? select.value : defaultWeaponKey;
}

// 依房間卡片上的隊伍與位置，取得該角色進戰鬥後是玩家操控或電腦操控。
function selectedControlMode(team, slot) {
  const select = controlSelectEls.find((element) => element.dataset.team === team && Number(element.dataset.slot) === slot);
  if (select?.value === "player") return "player";
  if (select?.value === "ai_money_dart_master") return "ai_money_dart_master";
  if (select?.value === "ai_dart_only_master") return "ai_dart_only_master";
  return "ai_beginner";
}

// 依房間卡片上的隊伍與位置，取得該角色進戰鬥後使用的最大血量。
function selectedHpValue(team, slot) {
  const input = hpInputEls.find((element) => element.dataset.team === team && Number(element.dataset.slot) === slot);
  const value = Number(input?.value);
  if (!Number.isFinite(value)) return maxHp;
  return clamp(Math.round(value), 1, 9999);
}

// 把指定玩家座標矩形範圍內的格子打散，用於隨機出生。
function shuffledCellsInArea(area) {
  const cells = [];
  const xMin = Math.min(area.xMin, area.xMax);
  const xMax = Math.max(area.xMin, area.xMax);
  const yMin = Math.min(area.yMin, area.yMax);
  const yMax = Math.max(area.yMin, area.yMax);

  for (let y = yMin; y <= yMax; y++) {
    for (let x = xMin; x <= xMax; x++) {
      cells.push(internalCellCoord({ x, y }));
    }
  }

  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
}

// ===== Main Loop =====
// 主遊戲迴圈，更新狀態並依序繪製全部畫面。
function draw(now = performance.now()) {
  try {
    const dt = Math.min(0.05, (now - state.lastFrame) / 1000);
    state.lastFrame = now;
    state.pulse += dt;
    updateMatchState(now);
    if (isMatchActive()) {
      updateCharging(dt);
      updateNinju(now);
      updateAi(dt, now);
      updateProjectiles(now);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackdrop();
    drawBoard();
    drawDrag();
    drawMapObjects();
    drawUnits();
    drawNinjuEffects(now);
    drawMoneyDartShootAnimations(now);
    drawProjectiles(now);
    drawAttacks();
    drawGameHud();
    drawNinjuBar();
    drawCountdownOverlay(now);
    drawResultOverlay();
    updatePanel();
  } catch (error) {
    console.error("Render loop recovered", error);
    state.moneyDartCasts = [];
    state.projectiles = [];
  } finally {
    requestAnimationFrame(draw);
  }
}

// ===== Per-Frame Updates =====
// 處理玩家長按角色時的集技規則。
function updateCharging(dt) {
  if (!state.pressedUnit || state.gameOver) return;
  if (!canUnitMoveNow(state.pressedUnit)) return;
  const held = (performance.now() - state.pressTime) / 1000;
  if (held < holdSeconds) return;
  if (!pointerIsOnUnit(state.pressedUnit)) {
    state.charging = true;
    setMessage(`${state.pressedUnit.name}: move the mouse back onto the character to keep charging.`);
    return;
  }

  state.charging = true;
  state.pressedUnit.skill = Math.min(maxSkill, state.pressedUnit.skill + chargePerSecond * dt);
  setMessage(`${state.pressedUnit.name} charging skill ${state.pressedUnit.skill.toFixed(1)} / ${maxSkill}`);
}

// 處理開場倒數結束後正式開始比賽。
function updateMatchState(now) {
  if (state.matchStart || state.result) return;
  if (!state.countdownStart) state.countdownStart = now;
  if (now - state.countdownStart >= countdownTotalMs) {
    state.matchStart = state.countdownStart + countdownTotalMs;
    state.lastFrame = now;
    if (!state.startSoundPlayed) {
      playSound("gameStarted");
      state.startSoundPlayed = true;
    }
    setMessage("Start.");
  }
}

// 判斷目前是否在可以操作與 AI 行動的正式對戰中。
function isMatchActive() {
  return Boolean(!state.inRoom && state.matchStart && !state.result);
}

// ===== Rendering: Background / Board =====
// 繪製整體背景與 UI 底板。
function drawBackdrop() {
  ctx.fillStyle = "#062f37";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawUiPanels();
  if (images.arena) {
    ctx.drawImage(images.arena, grid.left, grid.top, grid.cols * grid.cell, grid.rows * grid.cell);
  } else if (images.bg) {
    ctx.globalAlpha = 0.8;
    ctx.drawImage(images.bg, grid.left, grid.top, grid.cols * grid.cell, grid.rows * grid.cell);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = "#74ad7f";
    ctx.fillRect(grid.left, grid.top, grid.cols * grid.cell, grid.rows * grid.cell);
  }
  drawFrame();
}

// 繪製下方 UI 面板區塊。
function drawUiPanels() {
  const bottom = ui.bottomTop;
  ctx.save();
  ctx.fillStyle = "#074451";
  ctx.fillRect(0, bottom, canvas.width, ui.bottomHeight);
  ctx.fillStyle = "#052b32";
  ctx.fillRect(8, bottom + 10, ui.leftPanelW - 18, ui.bottomHeight - 18);
  ctx.fillRect(ui.midX + 10, bottom + 10, canvas.width - ui.midX - 18, ui.bottomHeight - 18);
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.fillRect(0, 0, canvas.width, 32);
  ctx.restore();
}

// 繪製遊戲外框與分隔線。
function drawFrame() {
  const bottom = ui.bottomTop;
  ctx.save();
  ctx.strokeStyle = "#7b2417";
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, canvas.width - 6, bottom - 4);
  ctx.strokeRect(3, bottom, canvas.width - 6, canvas.height - bottom - 4);
  ctx.beginPath();
  ctx.moveTo(ui.midX, bottom);
  ctx.lineTo(ui.midX, canvas.height - 4);
  ctx.stroke();
  for (const [x, y] of [[9, 9], [canvas.width - 9, 9], [9, bottom - 2], [canvas.width - 9, bottom - 2], [9, canvas.height - 9], [ui.midX, bottom], [ui.midX, canvas.height - 9], [canvas.width - 9, canvas.height - 9]]) {
    drawCornerGem(x, y);
  }
  ctx.restore();
}

// 繪製外框角落的圓形裝飾。
function drawCornerGem(x, y) {
  ctx.save();
  ctx.fillStyle = "#224d43";
  ctx.strokeStyle = "#d0a15b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#75c7a5";
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 繪製地圖底圖、樹牆與基本場景。
function drawBoard() {
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const r = cellRect(x, y);
      const hovered = state.pointer.cell && state.pointer.cell.x === x && state.pointer.cell.y === y;
      if (hovered) {
        ctx.fillStyle = isBlockedCell(x, y) ? "rgba(255, 82, 69, .22)" : "rgba(255, 238, 124, .22)";
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
    }
  }

  const selected = selectedUnit();
  if (!selected) return;
  for (const n of neighbors(selected.x, selected.y)) {
    if (!inside(n.x, n.y)) continue;
    const r = cellRect(n.x, n.y);
    ctx.fillStyle = unitAt(n.x, n.y) ? "rgba(255,95,83,.26)" : "rgba(103,212,179,.20)";
    if (isBlockedCell(n.x, n.y)) ctx.fillStyle = "rgba(255,224,109,.18)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
}

// ===== Rendering: Units / Objects / Effects =====
// 繪製所有角色、名字、血條與手持忍術物件。
function drawUnits() {
  for (const unit of state.units) {
    if (!unit.alive) continue;
    const p = unitPosition(unit);
    const selected = unit.id === state.selectedId;
    const bob = 0;

    if (selected) {
      ctx.strokeStyle = "#ffe06d";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y + 4, 31, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (state.charging && state.pressedUnit === unit) {
      drawChargeEffect(p, "back");
    }

    if (unit.hitFlash > 0) {
      unit.hitFlash = Math.max(0, unit.hitFlash - 0.06);
      ctx.save();
      ctx.globalAlpha = unit.hitFlash;
      ctx.fillStyle = "#ff5148";
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const sprite = unitSprite(unit);
    if (!activeMoneyDartCast(unit) && sprite) {
      const auraType = activeBuffAuraType(unit);
      if (auraType === "steel") drawSteelSpriteOutline(sprite, p, bob);
      if (auraType === "hotBlood") drawHotBloodSpriteOutline(sprite, p, bob);
      ctx.drawImage(sprite, p.x - 31, p.y - 47 + bob, 62, 62);
      drawUnitEyes(unit, p, bob);
    } else if (!activeMoneyDartCast(unit)) {
      ctx.fillStyle = unit.team === "blue" ? "#5bb8ff" : "#b5b9b3";
      ctx.beginPath();
      ctx.arc(p.x, p.y - 12 + bob, 24, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state.charging && state.pressedUnit === unit) {
      drawChargeEffect(p, "front");
    }

    drawHeldMoneyDart(unit, p);
    drawRespawnPointer(unit, p);

    drawHp(unit, p.x, p.y + 28);
    ctx.fillStyle = "#f8fff9";
    ctx.font = "14px Microsoft JhengHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(unit.name, p.x, p.y + 50);
  }
}

// 集技時繪製藍色外圈、放大的紅火與較小的黃火疊圖。
function drawChargeEffect(p, layer = "all") {
  const now = performance.now(); // 目前時間，用來切換集技火焰動畫影格。
  const redFrame = chargeRedFrames[Math.floor(now / 120) % chargeRedFrames.length]; // 紅色火焰影格，120ms 換一張。
  const yellowFrame = chargeYellowFrames[Math.floor(now / 120) % chargeYellowFrames.length]; // 黃色火焰影格，120ms 換一張。

  ctx.save();
  ctx.globalAlpha = 0.82; // 外圈與紅火整體透明度。
  if ((layer === "all" || layer === "back") && images.chargeOuter) {
    ctx.drawImage(images.chargeOuter, p.x - 39, p.y - 55, 78, 78); // 藍色外圈位置/大小，畫在角色後方。
  }
  if ((layer === "all" || layer === "front") && redFrame) {
    const w = 50; // 紅色火焰寬度，越大火越寬。
    const h = 60; // 紅色火焰高度，越大火越高。
    ctx.drawImage(redFrame, p.x - w / 2 - 5, p.y - 65, w, h); // 紅色火焰位置，p.y - 50 越小越往上。
  }
  if ((layer === "all" || layer === "front") && yellowFrame) {
    const w = 32; // 黃色火焰寬度，會疊在紅火上。
    const h = 38; // 黃色火焰高度。
    ctx.globalAlpha = 0.72; // 黃色火焰透明度。
    ctx.drawImage(yellowFrame, p.x - w / 2 - 5, p.y - 55, w, h); // 黃色火焰位置，p.y - 45 越小越往上。
  }
  ctx.restore();
}

// 鋼鐵防禦的藍光描邊：用角色 sprite 本身當遮罩，往外偏移 3px 畫出貼角色輪廓的細線。
function drawSteelSpriteOutline(sprite, p, bob = 0) {
  drawBuffSpriteOutline(sprite, p, bob, steelOutlineCache, "#5feeff", "#39e8ff", 2, 7); // 鋼鐵外圈：fill 顏色、shadow 顏色、線寬、發光強度。
}

function drawHotBloodSpriteOutline(sprite, p, bob = 0) {
  drawBuffSpriteOutline(sprite, p, bob, hotBloodOutlineCache, "#ff2d24", "#ff1f1a", 2, 7); // 熱血外圈：紅色系，線寬目前跟鋼鐵一致。
}

function drawBuffSpriteOutline(sprite, p, bob, cache, fill, shadow, outlineWidth, shadowBlur) {
  const mask = spriteColorMask(sprite, cache, fill);
  if (!mask) return;
  const x = p.x - 31; // 外圈相對角色 X offset；改這裡可整體左右平移外圈。
  const y = p.y - 47 + bob; // 外圈相對角色 Y offset；改這裡可整體上下平移外圈。
  const pulse = 0.66 + Math.sin(performance.now() / 170) * 0.1; // 透明度脈動強度/速度。

  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.shadowColor = shadow;
  ctx.shadowBlur = shadowBlur;
  for (let dx = -outlineWidth; dx <= outlineWidth; dx++) {
    for (let dy = -outlineWidth; dy <= outlineWidth; dy++) {
      const distance = Math.hypot(dx, dy);
      if (distance <= 0 || distance > outlineWidth) continue;
      ctx.drawImage(mask, x + dx, y + dy, 62, 62);
    }
  }
  ctx.restore();
}

// 快取上色後的 sprite 遮罩，避免每幀重新建立。
function spriteColorMask(sprite, cache, fill) {
  if (cache.has(sprite)) return cache.get(sprite);
  const canvas = document.createElement("canvas");
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const maskCtx = canvas.getContext("2d");
  maskCtx.drawImage(sprite, 0, 0);
  maskCtx.globalCompositeOperation = "source-in";
  maskCtx.fillStyle = fill;
  maskCtx.fillRect(0, 0, canvas.width, canvas.height);
  cache.set(sprite, canvas);
  return canvas;
}

function activeBuffAuraType(unit) {
  if (unit.buffAuraType === "steel" && isSteelDefenseActive(unit)) return "steel";
  if (unit.buffAuraType === "hotBlood" && isHotBloodActive(unit)) return "hotBlood";
  if (isSteelDefenseActive(unit)) return "steel";
  if (isHotBloodActive(unit)) return "hotBlood";
  return "";
}

// 統一 offset 規則：x 正值往右、y 正值往上。
function applyOffset(anchor, offset) {
  return { x: anchor.x + offset.x, y: anchor.y - offset.y };
}

// 角色平常手上顯示苦無武器。
function drawHeldKunai(unit, p) {
  if (activeMoneyDartCast(unit)) return;
  const frame = weaponFrames[unit.weaponKey || defaultWeaponKey]?.hand?.[unit.facing]?.[0];
  if (!frame) return;
  const scale = 1.25;
  const w = frame.width * scale;
  const h = frame.height * scale;
  const offsets = {
    right: { x: 8, y: 39 },
    left: { x: -8 - w, y: 39 },
    up: { x: -w / 2, y: 58 },
    down: { x: -w / 2, y: 22 },
  };
  const offset = offsets[unit.facing] || offsets.down;
  const at = applyOffset(p, offset);
  ctx.drawImage(frame, at.x, at.y, w, h);
}

// 重生後在角色上方畫大箭頭，提示玩家角色回到場上。
function drawRespawnPointer(unit, p) {
  const now = performance.now();
  if (!unit.respawnTipUntil || now >= unit.respawnTipUntil) return;
  const remaining = unit.respawnTipUntil - now;
  const elapsed = respawnPointerDuration - remaining;
  const progress = Math.min(0.999, Math.max(0, elapsed / respawnPointerDuration));
  const frame = respawnPointerFrames[Math.floor(progress * respawnPointerFrames.length)];
  if (!frame) return;

  const fade = Math.min(1, remaining / 180);
  const bounce = Math.sin(now / 70) * 3;
  const w = 142;
  const h = 125;
  const x = p.x - 24;
  const y = p.y - 126 + bounce;

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.drawImage(frame, x, y, w, h);
  ctx.restore();
}

// 繪製角色準備錢鏢時手上拿著的金色物件。
function drawHeldMoneyDart(unit, p) {
  if (!unit.moneyDart) return;
  const dir = directionVector(unit.facing);
  const holdX = p.x + dir.dx * 18;
  const holdY = p.y - 22 + dir.dy * 12;
  const now = performance.now();
  const elapsed = now - unit.moneyDart.startedAt;
  const readyFrame = moneyDartReadyFrame(elapsed);
  ctx.save();
  if (now < unit.moneyDart.invincibleUntil) {
    ctx.globalAlpha = 0.35 + Math.sin(now / 55) * 0.12;
    ctx.strokeStyle = "#ffe26b";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 18, 32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.shadowColor = "#ffd43b";
  ctx.shadowBlur = 12;
  if (readyFrame) {
    const size = Math.max(24, readyFrame.width * 1.15);
    ctx.drawImage(readyFrame, holdX - size / 2, holdY - size / 2, size, size);
  } else if (images.moneyDartHold) {
    ctx.drawImage(images.moneyDartHold, holdX - 12, holdY - 12, 24, 24);
  } else {
    ctx.fillStyle = "#ffd247";
    ctx.beginPath();
    ctx.arc(holdX, holdY, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 依照時間取得錢鏢準備階段的動畫影格。
function moneyDartReadyFrame(elapsed) {
  const frames = moneyDartReadyFrames.filter(Boolean);
  if (frames.length === 0) return null;
  const frameMs = moneyDartReadyMs / frames.length;
  const index = Math.min(frames.length - 1, Math.floor(elapsed / frameMs));
  return frames[index];
}

// 繪製地圖上的草、瓶子、箱子、岩石等物件。
function drawMapObjects() {
  if (!state.objects) return;
  const sorted = state.objects.filter((object) => object.alive).slice().sort((a, b) => a.y - b.y || a.x - b.x);
  for (const object of sorted) {
    const img = images[object.type];
    const center = cellCenter(object.x, object.y);
    const scale = object.scale || 1;
    const width = grid.cell * scale;
    const height = grid.cell * scale;

    if (img) {
      ctx.drawImage(img, center.x - width / 2, center.y - height * 0.72, width, height);
    } else {
      ctx.fillStyle = object.breakable ? "#d9d260" : "#245038";
      ctx.fillRect(center.x - width / 2, center.y - height / 2, width, height);
    }

    if (object.breakable && object.hp < objectHp) {
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(center.x - 16, center.y - height * 0.78, 32, 4);
      ctx.fillStyle = "#ffd766";
      ctx.fillRect(center.x - 16, center.y - height * 0.78, 32 * Math.max(0, object.hp / object.maxHp), 4);
    }
  }
}

// 繪製武器揮砍的短暫攻擊動畫。
function drawAttacks() {
  if (!state.attacks) return;

  for (let i = state.attacks.length - 1; i >= 0; i--) {
    const attack = state.attacks[i];
    const age = (performance.now() - attack.startedAt) / attack.duration; // 0 到 1，代表目前揮砍動畫播放進度。
    if (age >= 1) {
      state.attacks.splice(i, 1);
      continue;
    }

    const from = cellCenter(attack.from.x, attack.from.y); // 攻擊者所在格中心。
    const to = cellCenter(attack.to.x, attack.to.y); // 動畫錨點格中心，不等於完整攻擊範圍。
    const weaponFrameSet = weaponFrames[attack.weaponKey || defaultWeaponKey] || weaponFrames[defaultWeaponKey];
    const frames = weaponFrameSet.attack[attack.direction] || []; // 依上下左右選擇對應武器組合圖。
    const handFrames = weaponFrameSet.hand[attack.direction] || []; // 依同一個方向選擇手部出招組合圖。
    const frameIndex = Math.min(frames.length - 1, Math.floor(age * frames.length)); // 依動畫進度選擇第幾張刀光圖。
    const handFrameIndex = Math.min(handFrames.length - 1, Math.floor(age * handFrames.length)); // 手部動畫和刀光同步播放。
    const frame = frames[frameIndex];
    const handFrame = handFrames[handFrameIndex];

    if (handFrame) {
      drawKunaiHandAttackFrame(handFrame, from, to, attack.direction, attack.weaponKey || defaultWeaponKey);
    }
    if (frame) {
      drawKunaiAttackFrame(frame, from, to, attack.direction, attack.weaponKey || defaultWeaponKey);
    } else {
      drawSlashArc(from, to, age, attack.side);
    }
  }
}

// 使用目前武器的方向攻擊組合圖繪製揮砍。
function drawKunaiAttackFrame(frame, from, to, direction, weaponKey = defaultWeaponKey) {
  const attackScaleByWeapon = {
    weapon1: 1.0,
    weapon3: 1.0,
    weapon4: 0.5,
    weapon6: 0.8,
  };
  const scale = 1.55 * (attackScaleByWeapon[weaponKey] || 1); // 每把武器可個別調整 attack 大小。
  const w = frame.width * scale; // 實際繪製寬度。
  const h = frame.height * scale; // 實際繪製高度。
  const dx = Math.sign(to.x - from.x); // 動畫方向 X：右 1、左 -1、上下 0。
  const dy = Math.sign(to.y - from.y); // 動畫方向 Y：下 1、上 -1、左右 0。
  const anchor = {
    x: from.x + dx * 34, // 從角色中心往攻擊方向推一點，作為武器動畫基準點。
    y: from.y + dy * 31, // 角色圖的視覺中心比格子中心高，所以先往上修。
  };
  const offsetsByWeapon = {
    weapon1: {
      right: { x: -40, y: h / 2 }, // 苦無右砍動畫位置；y 正值代表往上。
      left: { x: -w +40 , y: h / 2 }, // 苦無左砍動畫位置。
      up: { x: -w / 2, y: h - 20 }, // 苦無上砍動畫位置（已轉成 y 正值往上規則）。
      down: { x: -w / 2, y: 50 }, // 苦無下砍動畫位置。
    },
    weapon3: {
      right: { x: -w + 75, y: h / 2 - 44 }, // 忍太刀右砍動畫位置；y 正值代表往上。
      left: { x: -w + 125, y: h / 2 - 44 }, // 忍太刀左砍動畫位置；這組已校準，優先不要動。
      up: { x: -w / 2, y: h - 120 }, // 忍太刀上砍動畫位置；忍太刀上砍圖很高，所以 Y 需要往下補。
      down: { x: -w / 2, y: 40 }, // 忍太刀下砍動畫位置；目前這個方向視覺已校準，優先不要動。
    },
    weapon4: {
      right: { x: -50, y: h / 2 - 20 }, // 伊賀密刀右砍動畫位置（y 正值往上）。
      left: { x: -70, y: h / 2 - 20 }, // 伊賀密刀左砍動畫位置（基準值，可再微調）。
      up: { x: -w / 2, y: h -115 }, // 伊賀密刀上砍動畫位置（基準值，可再微調）。
      down: { x: -w / 2, y: 52 }, // 伊賀密刀下砍動畫位置（基準值，可再微調）。
    },
    weapon6: {
      right: { x: -56, y: h / 2 - 16 }, // 鐵扇不知火右砍動畫位置（先依你目前調法推估）。
      left: { x: -w + 56, y: h / 2 - 16 }, // 鐵扇不知火左砍動畫位置（可再微調）。
      up: { x: -w / 2, y: h - 70 }, // 鐵扇不知火上砍動畫位置（可再微調）。
      down: { x: -w / 2, y: 80 }, // 鐵扇不知火下砍動畫位置（可再微調）。
    },
  };
  const offsets = offsetsByWeapon[weaponKey] || offsetsByWeapon[defaultWeaponKey];
  const offset = offsets[direction] || { x: -w / 2, y: h / 2 }; // 防呆：方向異常時置中畫。
  const at = applyOffset(anchor, offset);
  ctx.drawImage(frame, at.x, at.y, w, h);
}

// 使用目前武器的手部組合圖繪製出招動畫；這組 offset 獨立於刀光位置，避免動到已校準的武器 offsets。
function drawKunaiHandAttackFrame(frame, from, to, direction, weaponKey = defaultWeaponKey) {
  const handScaleByWeapon = {
    weapon1: 1.0,
    weapon3: 1.0,
    weapon4: 1.0,
    weapon6: 0.72,
  };
  const scale = 1.55 * (handScaleByWeapon[weaponKey] || 1); // 每把武器可個別調整 hand 大小。
  const w = frame.width * scale; // 手部動畫實際繪製寬度。
  const h = frame.height * scale; // 手部動畫實際繪製高度。
  const dx = Math.sign(to.x - from.x); // 動畫方向 X：右 1、左 -1、上下 0。
  const dy = Math.sign(to.y - from.y); // 動畫方向 Y：下 1、上 -1、左右 0。
  const anchor = {
    x: from.x + dx * 34, // 和刀光使用同一個方向錨點，確保手和刀同步。
    y: from.y + dy * 31,
  };
  const offsetsByWeapon = {
    weapon1: {
      right: { x: -35, y: 39 }, // 苦無右手出招位置；之後只調 weapon1 這組，不影響忍太刀。
      left: { x: 35 - w, y: 39 }, // 苦無左手出招位置。
      up: { x: -w / 2, y: 20 }, // 苦無上手出招位置。
      down: { x: -w / 2, y: 50 }, // 苦無下手出招位置。
    },
    weapon3: {
      right: { x: -w + 30 , y: h / 2 + 5 }, // 忍太刀右手出招位置；只影響 right_hand，不影響 right_attack。
      left: { x: -w + 75 , y: h / 2 + 5 }, // 忍太刀左手出招位置；這組已校準，優先不要動。
      up: { x: -w / 2, y: h - 55 }, // 忍太刀上手出招位置；只影響 up_hand，不影響 up_attack。
      down: { x: -w / 2, y: 72 }, // 忍太刀下手出招位置；配合目前下砍刀光。
    },
    weapon4: {
      right: { x: -80, y: 60 }, // 伊賀密刀右手出招位置（基準值，可再微調）。
      left: { x: -50, y: 60 }, // 伊賀密刀左手出招位置（基準值，可再微調）。
      up: { x: -w / 2, y: 85 }, // 伊賀密刀上手出招位置（基準值，可再微調）。
      down: { x: -w / 2 -5, y: 80 }, // 伊賀密刀下手出招位置（基準值，可再微調）。
    },
    weapon6: {
      right: { x: -80, y: 90 }, // 鐵扇不知火右手出招位置（先依你目前調法推估）。
      left: { x: 80 - w, y: 90 }, // 鐵扇不知火左手出招位置（可再微調）。
      up: { x: -w / 2 +10,  y: 70 }, // 鐵扇不知火上手出招位置（可再微調）。
      down: { x: -w / 2, y: 80 }, // 鐵扇不知火下手出招位置（可再微調）。
    },
  };
  const offsets = offsetsByWeapon[weaponKey] || offsetsByWeapon[defaultWeaponKey];
  const offset = offsets[direction] || { x: -w / 2, y: h / 2 };
  const at = applyOffset(anchor, offset);
  ctx.drawImage(frame, at.x, at.y, w, h);
}

// 繪製錢鏢飛行中的 projectile 視覺。
function drawProjectiles(now) {
  if (!state.projectiles) return;
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const projectile = state.projectiles[i];
    const age = Math.min(1, (now - projectile.startedAt) / projectile.duration);
    if (!Number.isFinite(age) || !projectile.from || !projectile.to) {
      state.projectiles.splice(i, 1);
      continue;
    }
    const eased = 1 - Math.pow(1 - age, 2);
    const from = cellCenter(projectile.from.x, projectile.from.y);
    const to = cellCenter(projectile.to.x, projectile.to.y);
    const x = from.x + (to.x - from.x) * eased;
    const y = from.y + (to.y - from.y) * eased - 20;
    const img = moneyDartProjectileImage(projectile.dir);

    try {
      ctx.save();
      ctx.globalAlpha = age < 0.9 ? 1 : Math.max(0, (1 - age) / 0.1);
      ctx.shadowColor = "#ffd447";
      ctx.shadowBlur = 14;
      if (img) {
        const horizontal = projectile.dir === "left" || projectile.dir === "right";
        ctx.drawImage(img, x - (horizontal ? 38 : 25), y - (horizontal ? 24 : 38), horizontal ? 76 : 50, horizontal ? 48 : 76);
      } else {
        ctx.fillStyle = "#ffd447";
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } catch (error) {
      ctx.restore();
      state.projectiles.splice(i, 1);
    }
  }
}

// 繪製角色丟出錢鏢時的出手動畫。
function drawMoneyDartShootAnimations(now) {
  if (!state.moneyDartCasts) return;
  for (let i = state.moneyDartCasts.length - 1; i >= 0; i--) {
    const cast = state.moneyDartCasts[i];
    const progress = (now - cast.startedAt) / cast.duration;
    if (!Number.isFinite(progress) || progress >= 1 || now - cast.startedAt > 1000) {
      state.moneyDartCasts.splice(i, 1);
      continue;
    }

    const unit = state.units.find((u) => u.id === cast.unitId && u.alive);
    if (!unit) {
      state.moneyDartCasts.splice(i, 1);
      continue;
    }
    const frames = (moneyDartShootFrames[cast.dir] || []).filter(Boolean);
    if (frames.length === 0) {
      state.moneyDartCasts.splice(i, 1);
      continue;
    }
    const frame = frames[Math.min(frames.length - 1, Math.floor(progress * frames.length))];
    const p = unitPosition(unit);
    const placement = moneyDartShootPlacement(cast.dir, frame, p);

    try {
      ctx.save();
      ctx.globalAlpha = 0.98;
      ctx.drawImage(frame, placement.x, placement.y, placement.w, placement.h);
      ctx.restore();
    } catch (error) {
      ctx.restore();
      state.moneyDartCasts.splice(i, 1);
    }
  }
}

// 取得角色目前仍在播放的錢鏢出手動畫。
function activeMoneyDartCast(unit) {
  if (!state.moneyDartCasts) return null;
  const now = performance.now();
  return state.moneyDartCasts.find((cast) => cast.unitId === unit.id && now - cast.startedAt < cast.duration) || null;
}

// 依方向決定錢鏢出手動畫的位置與尺寸。
function moneyDartShootPlacement(direction, frame, p) {
  const scale = 1.05;
  const w = frame.width * scale;
  const h = frame.height * scale;
  if (direction === "right") return { x: p.x - 34, y: p.y - 50, w, h };
  if (direction === "left") return { x: p.x + 34 - w, y: p.y - 50, w, h };
  if (direction === "up") return { x: p.x - w / 2, y: p.y + 18 - h, w, h };
  return { x: p.x - w / 2, y: p.y - 50, w, h };
}

// 依攻擊方向繪製武器揮砍弧線。
function drawSlashArc(from, to, age, side) {
  const centerX = from.x + (to.x - from.x) * 0.62;
  const centerY = from.y + (to.y - from.y) * 0.62 - 16;
  const baseAngle = Math.atan2(to.y - from.y, to.x - from.x);
  const start = baseAngle - side * (1.1 - age * 0.35);
  const end = baseAngle + side * (0.75 + age * 0.35);
  const alpha = age < 0.65 ? 1 : (1 - age) / 0.35;

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255, 244, 166, .95)";
  ctx.lineWidth = 9 * (1 - age * 0.35);
  ctx.beginPath();
  ctx.arc(centerX, centerY, 39 + age * 14, start, end, side < 0);
  ctx.stroke();

  ctx.strokeStyle = "rgba(115, 228, 255, .75)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 51 + age * 10, start + side * 0.1, end, side < 0);
  ctx.stroke();
  ctx.restore();
}

// 繪製角色頭上的血條。
function drawHp(unit, x, y) {
  const hpMax = unit.maxHp || maxHp;
  const hpText = `${Math.max(0, Math.round(unit.hp))}/${hpMax}`; // 暫時顯示確切血量數字。
  ctx.fillStyle = "rgba(0,0,0,.45)";
  ctx.fillRect(x - 25, y, 50, 7);
  ctx.fillStyle = unit.team === "blue" ? "#69d8ff" : "#c6cbc4";
  ctx.fillRect(x - 25, y, 50 * Math.max(0, unit.hp / hpMax), 7);
  ctx.save();
  ctx.font = "700 11px Microsoft JhengHei, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,.75)";
  ctx.strokeText(hpText, x, y - 2);
  ctx.fillStyle = "#f4fff8";
  ctx.fillText(hpText, x, y - 2);
  ctx.restore();
}

// 疊加角色眼睛。左右只顯示單眼；上下顯示雙眼。
function drawUnitEyes(unit, p, bob = 0) {
  const facing = unit.facing || "down";
  const offset = Object.prototype.hasOwnProperty.call(eyeOffsets, facing) ? eyeOffsets[facing] : eyeOffsets.down;
  if (!offset) return;

  if (facing === "left" || facing === "right") {
    const sideEye = images.eyeSide || images.eyesFront;
    if (!sideEye) return;
    ctx.save();
    if (facing === "left") {
      // 左向改用鏡像（依目前素材方向做對調）。
      ctx.translate(p.x + offset.x + offset.w, p.y + offset.y + bob);
      ctx.scale(-1, 1);
      ctx.drawImage(sideEye, 0, 0, offset.w, offset.h);
    } else {
      // 右向改用原圖（依目前素材方向做對調）。
      ctx.drawImage(sideEye, p.x + offset.x, p.y + offset.y + bob, offset.w, offset.h);
    }
    ctx.restore();
    return;
  }

  const frontEyes = images.eyesFront;
  if (!frontEyes) return;
  ctx.drawImage(frontEyes, p.x + offset.x, p.y + offset.y + bob, offset.w, offset.h);
}

// 繪製玩家拖曳移動時的目標線與落點提示。
function drawDrag() {
  if (!state.charging || !state.dragMoved || !state.pressedUnit) return;
  if (!canUnitMoveNow(state.pressedUnit)) return;
  const target = dragMoveTargetCell(state.pressedUnit);
  if (!target) return;
  const maxDistance = Math.floor(state.pressedUnit.skill);
  const reachable = maxDistance >= 1 ? reachableMoveCell(state.pressedUnit, target, maxDistance) : null;
  if (!reachable) return;
  const from = unitPosition(state.pressedUnit);
  const to = cellCenter(reachable.x, reachable.y);
  const dist = manhattan(state.pressedUnit, reachable);
  const enough = state.pressedUnit.skill >= Math.max(1, dist);
  const direction = directionFromTarget(state.pressedUnit, reachable);
  if (!direction) return;
  drawDragArrow(from, to, direction, enough);
}

// 用 ninja_arrow_0~3 的組合圖繪製拖曳移動方向。
function drawDragArrow(from, to, direction, enough) {
  const directionName = typeof direction === "string" ? direction : direction?.name;
  const frame = dragArrowFrames[directionName]?.[0];
  if (!frame) return;
  const arrowY = -18;
  const thickness = 32;
  const minLength = 36;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(minLength, Math.abs(dx) + Math.abs(dy));

  ctx.save();
  ctx.globalAlpha = enough ? 0.95 : 0.45;
  if (directionName === "right") {
    ctx.drawImage(frame, from.x, from.y + arrowY - thickness / 2, length, thickness);
  } else if (directionName === "left") {
    ctx.drawImage(frame, from.x - length, from.y + arrowY - thickness / 2, length, thickness);
  } else if (directionName === "up") {
    ctx.drawImage(frame, from.x - thickness / 2, from.y + arrowY - length, thickness, length);
  } else if (directionName === "down") {
    ctx.drawImage(frame, from.x - thickness / 2, from.y + arrowY, thickness, length);
  }
  ctx.restore();
}

// 繪製忍術效果，例如鋼鐵藍光與施放動畫。
function drawNinjuEffects(now) {
  for (const unit of state.units) {
    if (!unit.alive) continue;
    const p = unitPosition(unit);
    if (isUnitCastingNinju(unit)) {
      const progress = Math.min(0.999, (now - unit.ninju.startedAt) / unit.ninju.duration);
      const frames = unit.ninju.type === "hotBlood" ? atkUpFrames : defUpFrames;
      const frame = frames[Math.floor(progress * frames.length)];
      if (frame) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.drawImage(frame, p.x - 46, p.y - 68, 92, 92);
        ctx.restore();
      }
    }
  }
}

// ===== Rendering: Overlays / Result =====
// 繪製開局三、二、一、開始的倒數畫面。
function drawCountdownOverlay(now) {
  if (state.result || state.matchStart || !state.countdownStart) return;
  const elapsed = now - state.countdownStart;
  const step = countdownStep(elapsed);
  if (!step) return;

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, .18)";
  ctx.fillRect(grid.left, grid.top, grid.cols * grid.cell, grid.rows * grid.cell);
  const shake = step.text === "\u958b\u59cb！" ? Math.sin(now / 35) * 8 : 0;
  const scale = step.text === "\u958b\u59cb！" ? 1 + Math.sin(now / 70) * 0.06 : 1;
  ctx.translate(canvas.width / 2 + shake, grid.top + grid.rows * grid.cell / 2 - 16);
  ctx.scale(scale, scale);
  drawOutlinedText(step.text, 0, 0, step.text === "\u958b\u59cb！" ? 76 : 96, step.color, "center");
  ctx.restore();
}

// 依倒數經過時間回傳目前要顯示的文字與顏色。
function countdownStep(elapsed) {
  if (elapsed < 500) return { text: "\u4e09", color: "#fff1a8" };
  if (elapsed < 1000) return { text: "\u4e8c", color: "#fff1a8" };
  if (elapsed < 1500) return { text: "\u4e00", color: "#fff1a8" };
  if (elapsed < countdownTotalMs) return { text: "\u958b\u59cb！", color: "#ffea4d" };
  return null;
}

// 繪製勝敗結算畫面與統計表。
function drawResultOverlay() {
  if (!state.result) return;
  ctx.save();
  ctx.fillStyle = "rgba(0, 18, 22, .82)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#063d46";
  ctx.strokeStyle = "#d0a65f";
  ctx.lineWidth = 4;
  ctx.fillRect(142, 88, 676, 504);
  ctx.strokeRect(142, 88, 676, 504);

  const title = state.result.winner === "blue" ? "勝利" : "敗北";
  drawOutlinedText(title, canvas.width / 2, 130, 48, state.result.winner === "blue" ? "#78ddff" : "#ff8d7d", "center");
  drawOutlinedText(`遊戲時間 ${formatMatchTime(state.result.durationMs)}`, canvas.width / 2, 176, 22, "#f6f2d0", "center");

  ctx.font = "700 17px Microsoft JhengHei, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  drawResultRow(["角色", "隊伍", "殺敵", "造成傷害", "承受傷害"], 214, true);
  const rows = state.units.slice().sort((a, b) => a.team.localeCompare(b.team) || a.id - b.id);
  rows.forEach((unit, index) => {
    drawResultRow([
      unit.name,
      unit.team === "blue" ? "Blue" : "Grey",
      String(unit.kills),
      formatDamage(unit.damageDone),
      formatDamage(unit.damageTaken),
    ], 248 + index * 42, false, unit.team);
  });
  ctx.restore();
}

// 繪製結算畫面的一列表格資料。
function drawResultRow(values, y, header = false, team = "") {
  const x = 186;
  const widths = [150, 100, 80, 140, 140];
  ctx.save();
  ctx.fillStyle = header ? "rgba(255,255,255,.14)" : team === "blue" ? "rgba(80,190,240,.13)" : "rgba(220,220,210,.12)";
  ctx.fillRect(x - 12, y - 18, 606, 34);
  ctx.fillStyle = header ? "#fff1a8" : "#f4fff8";
  ctx.font = `${header ? "700" : "600"} 17px Microsoft JhengHei, sans-serif`;
  let cursor = x;
  for (let i = 0; i < values.length; i++) {
    ctx.fillText(values[i], cursor, y);
    cursor += widths[i];
  }
  ctx.restore();
}

// ===== Rendering: HUD =====
// 繪製遊戲中的上方與下方 HUD。
function drawGameHud() {
  drawTopHud();
  drawBottomPlayerHud();
  drawInventoryHud();
}

// 繪製上方玩家名稱、段數與段位文字。
function drawTopHud() {
  ctx.save();
  ctx.textBaseline = "middle";
  drawIconImage(images.blueIcon, 38, 18, 42, 31);
  drawOutlinedText("\u7687\u5929\u4e0d\u8ca0\u5de5\u5177\u4eba", 118, 18, 17, "#f4f3dd", "left"); // 上方玩家名稱位置/大小/顏色
  drawOutlinedText("99段", 294, 18, 18, "#f4f3dd", "center"); // 上方段數位置/大小/顏色
  drawOutlinedText("夜遊神", 372, 18, 18, "#f4f3dd", "center"); // 上方段位位置/大小/顏色
  const unit = state.units.find((u) => u.id === playerUnitId);
  if (unit) {
    const coord = displayCellCoord(unit);
    drawOutlinedText(`座標 [${coord.x},${coord.y}]`, grid.left + grid.cols * grid.cell - 10, 18, 13, "#d9f4ff", "right"); // 右上角目前角色座標位置/大小/顏色
  }
  ctx.restore();
}

// 繪製左下角體、技、武器、德、金區塊。
function drawBottomPlayerHud() {
  const unit = selectedHudUnit();
  const hpRatio = unit ? Math.max(0, unit.hp / (unit.maxHp || maxHp)) : 0;
  const skillRatio = unit ? Math.max(0, unit.skill / maxSkill) : 0;

  ctx.save();
  drawHudBar(45, 574, 165, 30, hpRatio, "#a057be", "体"); // 體條位置/大小/填滿顏色
  drawHudBar(262, 574, 165, 30, skillRatio, "#38c2f2", "技"); // 技條位置/大小/填滿顏色
  drawOutlinedText("武", 35, 654, 18, "#f0f0df", "center"); // 武字位置/大小/顏色 X:35(間隔15)
  drawMoneyBox(50, 642, "", 95); // 武器名稱框位置/寬度 X:50+100=150
  drawOutlinedText("德", 175, 654, 18, "#f0f0df", "center"); // 德字位置/大小/顏色 X:180(30)
  drawMoneyBox(190, 642, "0", 95); // 德數值框位置/寬度 195(15)
  drawOutlinedText("金", 315, 654, 18, "#f0f0df", "center"); // 金字位置/大小/顏色
  drawMoneyBox(330, 642, "0", 95); // 金數值框位置/寬度
  ctx.restore();
}

// 繪製體力或技力條。
function drawHudBar(x, y, w, h, ratio, color, label) {
  ctx.save();
  ctx.fillStyle = "#26302c"; // 體/技條外框底色
  ctx.strokeStyle = "#d4a85e"; // 體/技條外框線顏色
  ctx.lineWidth = 2; // 體/技條外框線粗細
  ctx.fillRect(x, y, w, h); // 體/技條外框位置/大小
  ctx.strokeRect(x, y, w, h); // 體/技條外框線位置/大小
  ctx.fillStyle = "#080808"; // 體/技條內部未填滿底色
  ctx.fillRect(x + 6, y + 6, w - 12, h - 12); // 體/技條內部底色位置/大小
  ctx.fillStyle = color; // 體/技條目前值填滿顏色
  ctx.fillRect(x + 6, y + 6, (w - 12) * ratio, h - 12); // 體/技條目前值位置/大小
  ctx.fillStyle = "#4a4a3d"; // 體/技圓標底色
  ctx.beginPath();
  ctx.arc(x - 10, y + h / 2, 20, 0, Math.PI * 2); // 體/技圓標位置/半徑
  ctx.fill();
  ctx.stroke();
  drawOutlinedText(label, x - 10, y + h / 2 + 1, 19, "#e9f3dc", "center"); // 體/技字位置/大小/顏色
  ctx.restore();
}

// 繪製武器名稱、德、金等數值框。
function drawMoneyBox(x, y, text, w = 180) {
  ctx.save();
  if (images.moneyPanel) {
    ctx.drawImage(images.moneyPanel, x, y - 4, w, 30); // 武器/德/金框圖片位置/大小
  } else {
    ctx.fillStyle = "#2a9cca"; // 武器/德/金框底色
    ctx.fillRect(x, y - 4, w, 30); // 武器/德/金框位置/大小
  }
  ctx.strokeStyle = "#041316"; // 武器/德/金框線顏色
  ctx.lineWidth = 3; // 武器/德/金框線粗細
  ctx.strokeRect(x, y - 4, w, 30); // 武器/德/金框線位置/大小
  ctx.fillStyle = "#38c2f2"; // 武器/德/金數值文字顏色
  ctx.font = "700 18px Microsoft JhengHei, sans-serif"; // 武器/德/金數值文字大小/粗細
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + 11); // 武器/德/金數值文字位置
  ctx.restore();
}

// 繪製右下道具列、忍術列與存活人數。
function drawInventoryHud() {
  const itemY = 558; // 道具列 Y 位置
  const ninjuY = 600; // 忍術列 Y 位置
  const startX = 510; // 道具格起始 X 位置
  const slotW = 38; // 道具格寬度
  const gap = 6; // 道具格間距

  ctx.save();
  drawOutlinedText("道", 482, itemY + 14, 22, "#f0f0df", "center"); // 道字位置/大小/顏色
  drawOutlinedText("術", 482, ninjuY + 15, 22, "#f0f0df", "center"); // 術字位置/大小/顏色

  for (let i = 0; i < 10; i++) {
    const x = startX + i * (slotW + gap); // 第 i 個道具格 X 位置
    drawItemSlot(x, itemY, slotW, 34, false); // 道具格位置/大小
  }

  const ninjuLabels = ["", "", "", "", "", ""];
  for (let i = 0; i < ninjuLabels.length; i++) {
    const x = 510 + i * 75; // 第 i 個忍術格 X 位置/間距
    drawNinjuSlot(x, ninjuY, 60, 30, ninjuLabels[i], false); // 忍術空框位置/大小，先畫在按鈕後面
  }

  drawNinjuSlot(steelButtonRect.x, steelButtonRect.y, steelButtonRect.w, steelButtonRect.h, "鋼鐵", "steel"); // 鋼鐵按鈕位置/大小，後畫避免被忍術框蓋住
  drawNinjuSlot(moneyDartButtonRect.x, moneyDartButtonRect.y, moneyDartButtonRect.w, moneyDartButtonRect.h, "錢鏢", "moneyDart"); // 錢鏢按鈕位置/大小
  drawNinjuSlot(hotBloodButtonRect.x, hotBloodButtonRect.y, hotBloodButtonRect.w, hotBloodButtonRect.h, "熱血", "hotBlood"); // 熱血按鈕位置/大小

  drawSmallCounter(476, 644, "#2479a9", String(teamAliveCount("blue"))); // blue 存活數位置/顏色
  drawSmallCounter(476, 670, "#d8d8d8", String(teamAliveCount("grey"))); // grey 存活數位置/顏色
  ctx.restore();
}

// 繪製單一空道具格。
function drawItemSlot(x, y, w, h, filled) {
  ctx.save();
  ctx.fillStyle = filled ? "#12626d" : "#163f49";
  ctx.strokeStyle = "#5eb5b3";
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,.12)";
  ctx.fillRect(x + 4, y + 3, w - 8, 4);
  ctx.restore();
}

// 繪製單一忍術按鈕或空忍術框。
function drawNinjuSlot(x, y, w, h, text, type) {
  const unit = selectedHudUnit();
  const isSteel = type === true || type === "steel";
  const isHotBlood = type === "hotBlood";
  const isMoneyDart = type === "moneyDart";
  const statusRule = isHotBlood ? hotBloodRule() : steelRule();
  const active = unit && ((isSteel || isHotBlood) ? ((unit.ninju?.type === type && (isUnitCastingNinju(unit) || isUnitInNinjuGap(unit))) || (isSteel ? isSteelDefenseActive(unit) : isHotBloodActive(unit))) : isMoneyDart ? Boolean(unit.moneyDart) : false);
  const ready = unit && unit.alive && ((isSteel || isHotBlood) ? unit.skill >= statusRule.cost : isMoneyDart);
  ctx.save();
  if ((isSteel || isHotBlood) && images.steelButton) {
    ctx.globalAlpha = ready ? 1 : 0.55;
    ctx.drawImage(images.steelButton, x, y, w, h);
    ctx.globalAlpha = 1;
    drawNinjuButtonText(text, x + w / 2 - 1, y + h / 2 + 1, 16, "#232323f8", "center"); // 鋼鐵/熱血字：跟錢鏢同字型、大小、顏色。
  } else if (isMoneyDart && images.moneyDartButton) {
    ctx.globalAlpha = ready ? 1 : 0.55;
    ctx.drawImage(images.moneyDartButton, x, y, w, h);
    ctx.globalAlpha = 1;
    drawNinjuButtonText(text, x + w / 2 -1, y + h / 2 + 1, 16, "#232323f8", "center"); // 錢鏢字：x/y offset、字大小、字色。
  } else {
    ctx.fillStyle = ready ? "#c78e42" : "#2d3d38";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#77bec6";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    if (text) drawOutlinedText(text, x + w / 2, y + h / 2 + 1, 15, ready ? "#ffe6a6" : "#1b1d18", "center");
  }
  if (active) {
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.fillRect(x, y, w, h);
  }
  if ((isSteel || isHotBlood) && unit && unit.ninju?.type === type && unit.ninju.queue > 0) {
    drawOutlinedText(`x${unit.ninju.queue + 1}`, x + w - 10, y + 8, 12, "#fff2a8", "center");
  }
  ctx.restore();
}

// 繪製 blue/grey 存活人數的小圓點計數。
function drawSmallCounter(x, y, color, text) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y - 5, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e8f8f5";
  ctx.font = "13px Microsoft JhengHei, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 20, y - 4);
  ctx.restore();
}

function drawNinjuButtonText(text, x, y, size, color, align = "center") {
  ctx.save();
  ctx.font = `700 ${size}px DFKai-SB, KaiTi, Microsoft JhengHei, serif`; // 忍術按鈕字型與字重，size 控字大小。
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color; // 忍術按鈕文字顏色。
  ctx.fillText(text, x, y);
  ctx.restore();
}

// 計算指定隊伍目前還存活或等待重生的人數。
function teamAliveCount(team) {
  return state.units.filter((unit) => unit.team === team && (unit.alive || unit.respawning)).length;
}

// 有圖片就畫圖片，沒有圖片時用灰色方塊替代。
function drawIconImage(img, x, y, w, h) {
  if (img) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  ctx.fillStyle = "#cbd5ce";
  ctx.fillRect(x, y, w, h);
}

// 繪製帶黑邊的文字，提高 HUD 可讀性。
function drawOutlinedText(text, x, y, size, color, align = "left") {
  ctx.save();
  ctx.font = `700 ${size}px Microsoft JhengHei, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0,0,0,.72)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// 繪製目前忍術狀態提示條。
function drawNinjuBar() {
  const unit = selectedHudUnit();
  if (!unit) return;
  const active = isUnitCastingNinju(unit);
  const gap = isUnitInNinjuGap(unit);
  const steelBuff = isSteelDefenseActive(unit);
  const hotBloodBuff = isHotBloodActive(unit);
  const buff = steelBuff || hotBloodBuff;
  if (!active && !gap && !buff && (!unit.alive || unit.skill >= steelRule().cost)) return;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillRect(814, 616, 62, 30);
  const buffUntil = Math.max(unit.steelUntil || 0, unit.hotBloodUntil || 0);
  const text = active ? "施放中" : gap ? "可移動" : buff ? `${Math.ceil((buffUntil - performance.now()) / 1000)}秒` : `技 ${steelRule().cost}`;
  drawOutlinedText(text, 845, 631, 14, "#f7f6d7", "center");
  ctx.restore();
}

// 依角色移動進度計算畫面上的平滑位置。
function unitPosition(unit) {
  const target = cellCenter(unit.x, unit.y);
  if (unit.moveT >= 1) return target;
  const from = cellCenter(unit.fromX, unit.fromY);
  const t = 1 - Math.pow(1 - unit.moveT, 3);
  unit.moveT = Math.min(1, unit.moveT + 0.08);
  return { x: from.x + (target.x - from.x) * t, y: from.y + (target.y - from.y) * t };
}

// ===== Input =====
// 處理滑鼠按下：忍術按鈕、選角色、攻擊或開始拖曳。
function pointerDown(event) {
  if (state.inRoom) return;
  if (state.result) {
    if (performance.now() < (state.resultClickableAt || 0)) return;
    returnToRoomFromResult();
    return;
  }
  startBgm();
  pointerMove(event);
  if (!isMatchActive()) return;
  const cell = eventCell(event);
  if (pointInRect(state.pointer.x, state.pointer.y, steelButtonRect)) {
    useSteelNinju();
    return;
  }
  if (pointInRect(state.pointer.x, state.pointer.y, hotBloodButtonRect)) {
    useHotBloodNinju();
    return;
  }
  if (pointInRect(state.pointer.x, state.pointer.y, moneyDartButtonRect)) {
    useMoneyDart();
    return;
  }
  if (!cell || state.gameOver) return;

  const unit = unitAt(cell.x, cell.y);
  const selected = selectedUnit();
  state.pressedUnit = unit && canControlUnit(unit) ? unit : null;
  state.pressTime = performance.now();
  state.dragMoved = false;
  state.charging = false;

  if (selected && selected.moneyDart) {
    if (cell.x !== selected.x || cell.y !== selected.y) {
      throwMoneyDart(selected, cell);
    } else {
      setMessage(`${selected.name}: choose up, down, left, or right to throw money dart.`);
    }
    return;
  }

  if (unit && canControlUnit(unit)) {
    state.selectedId = unit.id;
    setMessage(`${unit.name}: keep holding to charge skill.`);
    return;
  }

  if (unit && selected && unit.team !== selected.team) {
    if (manhattan(selected, unit) === 1) {
      attack(selected, unit);
    } else {
      attackAimedWeapon(selected, cell);
    }
    return;
  }

  if (selected && (cell.x !== selected.x || cell.y !== selected.y)) {
    attackAimedWeapon(selected, cell);
    return;
  }

  setMessage("Move only works by holding a character, charging, then dragging to a cell.");
}

// 處理滑鼠移動並更新目前指向的格子。
function pointerMove(event) {
  const rect = canvas.getBoundingClientRect();
  state.pointer.x = (event.clientX - rect.left) * canvas.width / rect.width;
  state.pointer.y = (event.clientY - rect.top) * canvas.height / rect.height;
  state.pointer.cell = pointToCell(state.pointer.x, state.pointer.y);

  const lookUnit = state.pressedUnit || selectedUnit();
  if (lookUnit && canControlUnit(lookUnit) && lookUnit.alive) {
    updateFacingFromPointer(lookUnit);
  }

  if (!state.pressedUnit || !event.buttons) return;
  const start = cellCenter(state.pressedUnit.x, state.pressedUnit.y);
  const dx = state.pointer.x - start.x;
  const dy = state.pointer.y - start.y;
  if (Math.hypot(dx, dy) > 12) {
    state.dragMoved = true;
  }
}

// 處理滑鼠放開，決定是否執行拖曳移動。
function pointerUp(event) {
  startBgm();
  eventCell(event);
  const cell = state.pressedUnit ? dragMoveTargetCell(state.pressedUnit) : null;
  if (state.charging && state.dragMoved && state.pressedUnit && cell) {
    skillMove(state.pressedUnit, cell);
  } else if (state.pressedUnit) {
    setMessage(`${state.pressedUnit.name}: charged to ${state.pressedUnit.skill.toFixed(1)} skill.`);
  }

  state.pressedUnit = null;
  state.dragMoved = false;
  state.charging = false;
}

// ===== UI Text / Audio Helpers =====
// 更新頁面旁邊或下方的文字狀態資訊。
function updatePanel() {
  const unit = selectedHudUnit();
  if (!unit) return;
  const coord = displayCellCoord(unit);
  unitInfoEl.innerHTML = `
    <div>HP: ${Math.round(unit.hp)}/${unit.maxHp || maxHp}</div>
    <div>SKILL: ${unit.skill.toFixed(1)} / ${maxSkill}</div>
    <div>CELL: [${coord.x}, ${coord.y}]</div>
  `;
  skillFillEl.style.width = `${Math.min(100, unit.skill / maxSkill * 100)}%`;
}

// 依隊伍與面向取得角色圖片。
function unitSprite(unit) {
  const prefix = unit.team === "blue" ? "blue" : "grey";
  const suffix = unit.facing.charAt(0).toUpperCase() + unit.facing.slice(1);
  return images[prefix + suffix];
}

// 依目標位置更新角色面向。
function updateFacing(unit, target) {
  const dx = target.x - unit.x;
  const dy = target.y - unit.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    unit.facing = dx > 0 ? "right" : "left";
  } else if (dy !== 0) {
    unit.facing = dy > 0 ? "down" : "up";
  }
}

// 依滑鼠游標相對角色的位置更新面向。
function updateFacingFromPointer(unit) {
  const origin = cellCenter(unit.x, unit.y);
  const dx = state.pointer.x - origin.x;
  const dy = state.pointer.y - origin.y;
  if (Math.hypot(dx, dy) < 8) return;
  if (Math.abs(dx) >= Math.abs(dy)) {
    unit.facing = dx > 0 ? "right" : "left";
  } else {
    unit.facing = dy > 0 ? "down" : "up";
  }
}

// 當目標在上下左右一格時取得方向。
function directionFromAdjacent(unit, target) {
  const dx = target.x - unit.x;
  const dy = target.y - unit.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return null;
  if (dx > 0) return { name: "right", dx: 1, dy: 0 };
  if (dx < 0) return { name: "left", dx: -1, dy: 0 };
  if (dy > 0) return { name: "down", dx: 0, dy: 1 };
  return { name: "up", dx: 0, dy: -1 };
}

// 依遠方目標推算主要方向。
function directionFromTarget(unit, target) {
  const dx = target.x - unit.x;
  const dy = target.y - unit.y;
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? { name: "right", dx: 1, dy: 0 } : { name: "left", dx: -1, dy: 0 };
  }
  return dy > 0 ? { name: "down", dx: 0, dy: 1 } : { name: "up", dx: 0, dy: -1 };
}

// 把方向字串轉成 x/y 向量。
function directionVector(facing) {
  if (facing === "left") return { dx: -1, dy: 0 };
  if (facing === "right") return { dx: 1, dy: 0 };
  if (facing === "up") return { dx: 0, dy: -1 };
  return { dx: 0, dy: 1 };
}

// 依方向取得錢鏢飛行圖片。
function moneyDartProjectileImage(direction) {
  if (direction === "left") return images.moneyDartLeft;
  if (direction === "right") return images.moneyDartRight;
  if (direction === "up") return images.moneyDartUp;
  return images.moneyDartDown;
}

// 設定目前狀態訊息。
function setMessage(text) {
  state.message = text;
  statusEl.textContent = text;
}

// 依目前所在畫面選擇背景音樂：房間播大廳，戰鬥播地圖，結算停止地圖。
function activeBgm() {
  if (state.result) return null;
  return state.inRoom ? roomBgm : battleBgm;
}

// 停止指定背景音樂，並把播放位置歸零，方便下次重新進入時從頭播。
function stopBgm(audio) {
  audio.pause();
  audio.currentTime = 0;
}

// 停掉非目前畫面的 BGM，避免房間與地圖音樂同時播放。
function syncBgm() {
  const active = activeBgm();
  if (active !== roomBgm && !roomBgm.paused) stopBgm(roomBgm);
  if (active !== battleBgm && !battleBgm.paused) stopBgm(battleBgm);
}

// 嘗試播放目前畫面的背景音樂。
function startBgm() {
  syncBgm();
  const bgm = activeBgm();
  if (!bgm || !bgm.paused) return;
  bgm.play().catch(() => {
    setMessage("Click the game once to start background music.");
  });
}

// 套用房間左下角的音量滑桿；音樂控制 BGM，音效控制所有短音效。
function applyVolumeControls() {
  if (musicVolumeInput) {
    const volume = Number(musicVolumeInput.value) / 100;
    roomBgm.volume = volume;
    battleBgm.volume = volume;
  }
  if (sfxVolumeInput) {
    const volume = Number(sfxVolumeInput.value) / 100;
    Object.values(sounds).forEach((sound) => {
      sound.volume = volume;
    });
  }
}

// 播放指定音效，會複製音訊避免連續播放被截斷。
function playSound(key) {
  const sound = sounds[key];
  if (!sound) return null;
  const instance = sound.cloneNode();
  instance.volume = sound.volume;
  instance.play().catch(() => {});
  return instance;
}

// 依物件種類播放不同破壞音效。
function playBreakSound(object) {
  if (object.type === "vase") {
    playSound("breakVase");
  } else if (object.type === "chest") {
    playSound("breakChest");
  } else {
    playSound("breakDefault");
  }
}

// 從房間畫面進入正式戰鬥。
function startBattleFromRoom() {
  state.inRoom = false;
  document.body.classList.remove("room-mode");
  resetGame();
  syncBgm();
  startBgm();
}

// 結算畫面點一下回房間，並保留房間原本配置（卡片啟用、武器、控制模式、HP）。
function returnToRoomFromResult() {
  if (state.endSoundInstance) {
    state.endSoundInstance.pause();
    state.endSoundInstance.currentTime = 0;
    state.endSoundInstance = null;
  }
  state.inRoom = true;
  state.result = null;
  state.resultClickableAt = 0;
  state.gameOver = false;
  state.matchStart = 0;
  state.matchEnd = 0;
  state.countdownStart = 0;
  state.pressedUnit = null;
  state.dragMoved = false;
  state.charging = false;
  state.attacks = [];
  state.projectiles = [];
  state.moneyDartCasts = [];
  clearDragState();
  document.body.classList.add("room-mode");
  syncBgm();
  startBgm();
  setMessage("Back to room.");
}

function updateRuleModeUi() {
  if (!ruleModeToggle || !ruleModeCheckbox) return;
  const checked = state.useOriginalMode;
  ruleModeToggle.setAttribute("aria-pressed", checked ? "true" : "false");
  ruleModeToggle.classList.toggle("checked", checked);
}

function toggleRuleMode() {
  state.useOriginalMode = !state.useOriginalMode;
  updateRuleModeUi();
}

canvas.addEventListener("pointerdown", pointerDown);
canvas.addEventListener("pointermove", pointerMove);
window.addEventListener("pointerup", pointerUp);
resetBtn.addEventListener("click", resetGame);
resetBtn.addEventListener("click", startBgm);
setupWeaponSelects();
setupControlSelects();
setupHpInputs();
setupRoomSlots();
if (battleStartBtn) battleStartBtn.addEventListener("click", startBattleFromRoom);
if (musicVolumeInput) musicVolumeInput.addEventListener("input", applyVolumeControls);
if (sfxVolumeInput) sfxVolumeInput.addEventListener("input", applyVolumeControls);
if (ruleModeToggle) ruleModeToggle.addEventListener("click", toggleRuleMode);
window.addEventListener("keydown", startBgm, { once: true });

loadImages().then(() => {
  updateRuleModeUi();
  applyVolumeControls();
  resetGame();
  startBgm();
  draw();
});

