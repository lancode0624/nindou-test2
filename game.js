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
const teamEditBtn = document.querySelector("#teamEditBtn");
const ninjuEditorEl = document.querySelector("#ninjuEditor");
const ninjuEditorSlotsEl = document.querySelector("#ninjuEditorSlots");
const ninjuEditorListEl = document.querySelector("#ninjuEditorList");
const ninjuEditorResetBtn = document.querySelector("#ninjuEditorReset");
const ninjuEditorCancelBtn = document.querySelector("#ninjuEditorCancel");
const ninjuEditorSaveBtn = document.querySelector("#ninjuEditorSave");
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
  ninjuDamageEffects: [],
  moneyDartCasts: [],
  useOriginalMode: false,
};

const ninjuCatalog = [
  { type: "moneyDart", label: "錢鏢", group: "projectile", editorRow: "special", editorOrder: 1 },
  { type: "steel", label: "鋼鐵", group: "buff", editorRow: "support", editorOrder: 1 },
  { type: "hotBlood", label: "熱血", group: "buff", editorRow: "support", editorOrder: 2 },
  { type: "flash", label: "閃光", group: "attack", editorRow: "attack", editorOrder: 1 },
  { type: "wildfire", label: "野火", group: "attack", editorRow: "attack", editorOrder: 2 },
  { type: "freeze", label: "急凍", group: "attack", editorRow: "attack", editorOrder: 3 },
  { type: "genki", label: "元氣", group: "heal", editorRow: "heal", editorOrder: 1 },
  { type: "kakki", label: "活氣", group: "heal", editorRow: "heal", editorOrder: 2 },
  { type: "shinki", label: "神氣", group: "heal", editorRow: "heal", editorOrder: 3 },
];
const ninjuByType = Object.fromEntries(ninjuCatalog.map((ninju) => [ninju.type, ninju]));
const ninjuEditorRowOrder = { heal: 1, support: 2, attack: 3, special: 4, transform: 5 };
const ninjuEditorCatalog = [...ninjuCatalog].sort((a, b) => (
  (ninjuEditorRowOrder[a.editorRow] || 99) - (ninjuEditorRowOrder[b.editorRow] || 99)
  || a.editorOrder - b.editorOrder
));
const defaultNinjuLoadout = ["moneyDart", "steel", "hotBlood", "genki", "kakki", "shinki"];
const ninjuLoadoutStorageKey = "nindou2.ninjuLoadout";
let selectedNinjuLoadout = loadSavedNinjuLoadout();
let editNinjuDraft = [...selectedNinjuLoadout];
let editNinjuSlotIndex = 0;
let restartHoldStartedAt = 0;
let restartHoldTriggered = false;

// 眼睛貼圖位置（相對角色中心）。X 正值往右，Y 正值往上。
// 你可以直接調這裡微調外觀。
const eyeOffsets = {
  down: { x: -14, y: 25, w: 30, h: 13 },  // 下：雙眼；x/y 是 offset，w/h 是眼睛大小。
  up: null,                                  // 上：不顯示眼睛；要顯示時改成 {x,y,w,h}。
  right: { x: 3, y: 26, w: 20, h: 15 },   // 右：單眼；x 加大往右、y 加大往上。
  left: { x: -19, y: 26, w: 20, h: 15 },  // 左：單眼；通常和 right 用不同 x 來貼頭型。
};

// 拿標備彈狀態的眼睛 offset（b_dart sprite 頭部位置與 idle 不同，可獨立調整）。
const moneyDartEyeOffsets = {
  down:  { x: -13, y: 24, w: 30, h: 13 },
  up:    null,
  right: { x: 2,   y: 23, w: 20, h: 15 },
  left:  { x: -18, y: 23, w: 20, h: 15 },
};
// b_dart sprite 與 idle sprite 的內容起始點差異補正（單位：canvas px）
// 讓備彈角色視覺位置完全對齊 idle，消除偏移。
const moneyDartReadyOffsets = {
  right: { dx: 3, dy: 5 },
  left:  { dx: 1, dy: 5 },
  up:    { dx: 3, dy: 3 },
  down:  { dx: 4, dy: 4 },
};
// 射出動畫逐幀眼睛位置：每個值是頭部中心相對 sprite 左上角的像素座標（未縮放）。
// sprite 尺寸：right/left=188×48, up=60×132, down=52×184。w/h 是眼睛大小。
// 調整方式：x 增大往右，y 增大往下。
// 左右方向丟出動畫的逐幀 Y 軸補正（sprite 像素，負值=往上移）。
// 以頭部 topY 為錨點：補正各幀 sprite 內角色頭頂位置差異，減少視覺上下晃動。
// 量測值（左側60px內最上方非透明像素 topY）：
//   frame 0=4, 1=4, 2=5, 3=5, 4=4, 5=5, 6=2（frame 6 較高因腳踢動作）
const moneyDartShootYCorrection = [1, 2, 3, 3, 4, 4, 5]; // 7 frames，0-indexed

const moneyDartShootFrameHeads = {
  right: { w: 20, h: 15, frames: [
    { x: 42, y: 26 }, // frame 1
    { x: 41, y: 26 }, // frame 2
    { x: 40, y: 26 }, // frame 3
    { x: 40, y: 26 }, // frame 4
    { x: 40, y: 23 }, // frame 5
    { x: 41, y: 23 }, // frame 6
    { x: 42, y: 23 }, // frame 7
  ]},
  left: { w: 20, h: 15, frames: [
    // 鏡像：x = 188 - right_x，y 相同
    { x: 146, y: 26 }, // frame 1
    { x: 147, y: 26 }, // frame 2
    { x: 148, y: 26 }, // frame 3
    { x: 148, y: 26 }, // frame 4
    { x: 148, y: 23 }, // frame 5
    { x: 147, y: 23 }, // frame 6
    { x: 146, y: 23 }, // frame 7
  ]},
  up: { w: 30, h: 13, frames: [
    { x: 15, y: 18 }, // frame 1
    { x: 15, y: 16 }, // frame 2
    { x: 15, y: 14 }, // frame 3
    { x: 15, y: 17 }, // frame 4
    { x: 15, y: 18 }, // frame 5
    { x: 15, y: 18 }, // frame 6
    { x: 15, y: 18 }, // frame 7
  ]},
  down: { w: 30, h: 13, frames: [
    // sprite 52×184，頭部在頂端；甩出時往下移，弧線對應 right 的 y 變化
    { x: 26, y: 27 }, // frame 1
    { x: 26, y: 27 }, // frame 2
    { x: 26, y: 28 }, // frame 3
    { x: 26, y: 28 }, // frame 4
    { x: 26, y: 28 }, // frame 5
    { x: 26, y: 27 }, // frame 6
    { x: 26, y: 27 }, // frame 7
  ]},
};


const useNinjuSpriteOffset = { x: 3.1, y: -1.03 }; // use-ninju sprite compensation: x positive moves right, y positive moves down.

// 拖曳後移動殘影 offset。X 正值往右，Y 正值往上。
// prearrive 是移動前段的速度線，arrive 是後段的角色殘影合成圖。
const moveEffectOffsets = {
  prearrive: {
    right: { x: 0, y: 0 },
    left: { x: 0, y: 0 },
    up: { x: 0, y: 0 },
    down: { x: 0, y: 0 },
  },
  arrive: {
    right: { x: -50, y: 15 },
    left: { x: 50, y: 15 },
    up: { x: 0, y: -45 },
    down: { x: 0, y: 50 },
  },
};

// 移動殘影動畫時間常數。
const ARRIVE_FRAME_MS   = 65;                      // 每影格持續毫秒
const ARRIVE_TOTAL      = ARRIVE_FRAME_MS * 5;     // 325 ms，5 影格
const PREARRIVE_FRAME_MS = 70;
const PREARRIVE_TOTAL   = PREARRIVE_FRAME_MS * 2;  // 140 ms，2 影格

// 依方向計算 arrive 影格繪製起點，使角色身體對齊目標格中心。
// 影格尺寸：水平方向 148×52，垂直方向 48×152 或 48×142。
function arriveFrameOffset(dir, destX, destY, frameW, frameH) {
  switch (dir) {
    case "right": return { x: destX - frameW + 31, y: destY - 42 };
    case "left":  return { x: destX - 31,          y: destY - 42 };
    case "up":    return { x: destX - frameW / 2,  y: destY - 47 };
    case "down":  return { x: destX - frameW / 2,  y: destY + 15 - frameH };
    default:      return { x: destX - frameW / 2,  y: destY - frameH / 2 };
  }
}

// 播放移動殘影：prearrive 在來源格，arrive 在目標格（水平方向裁切到角色身高）。
function drawMoveTrails(now) {
  for (const unit of state.units) {
    if (!unit.moveTrail) continue;
    const age = now - unit.moveTrail.startedAt;
    if (age >= Math.max(ARRIVE_TOTAL, PREARRIVE_TOTAL)) { unit.moveTrail = null; continue; }

    const trail = unit.moveTrail;
    const dir  = trail.facing;
    const team = trail.team; // "blue" 或 "grey"
    const dest = cellCenter(unit.x, unit.y);
    const src  = cellCenter(trail.fromX, trail.fromY);

    // Prearrive：來源格播放 2 影格（起跳/發射效果）
    if (age < PREARRIVE_TOTAL) {
      const fi = Math.min(1, Math.floor(age / PREARRIVE_FRAME_MS));
      const frame = movePrearriveFrames[team]?.[dir]?.[fi];
      if (frame) ctx.drawImage(frame, src.x - frame.width / 2, src.y - frame.height / 2);
    }

    // Arrive：目標格播放 5 影格（帶動態模糊的衝入動畫）
    if (age < ARRIVE_TOTAL) {
      const fi = Math.min(4, Math.floor(age / ARRIVE_FRAME_MS));
      const frame = moveArriveFrames[team]?.[dir]?.[fi];
      if (frame) {
        const off = arriveFrameOffset(dir, dest.x, dest.y, frame.width, frame.height);
        if (dir === "right" || dir === "left") {
          // 水平方向裁切到角色身高範圍，避免殘影延伸到角色上下方。
          ctx.save();
          ctx.beginPath();
          ctx.rect(off.x, dest.y - 47, frame.width, 62);
          ctx.clip();
          ctx.drawImage(frame, off.x, off.y, frame.width, frame.height);
          ctx.restore();
        } else {
          ctx.drawImage(frame, off.x, off.y, frame.width, frame.height);
        }
      }
    }
  }
}

// 錢鏢視覺 offset。x 正值往右、y 正值往上。
// 這裡統一控制：手上準備位置、無敵黃圈、飛行中的貼圖大小/位置、出手動畫位置。
const moneyDartVisualOffsets = {
  hold: {
    // 基準點從角色中心出發，再依面向推到手邊。
    handDistance: { x: 18, y: 12 },
    center: { x: 0, y: 18 },
    fallbackHalfSize: 18,
    frameScale: 1.15,
  },
  invincibleRing: {
    center: { x: 0, y: 18 },
    radius: 32,
  },
  projectile: {
    center: { x: 0, y: 20 },
    horizontal: { halfW: 38, halfH: 24, w: 76, h: 48 },
    vertical: { halfW: 25, halfH: 38, w: 50, h: 76 },
  },
  shoot: {
    scale: 1.05,
    right: { x: -34, y: 57 },
    left: { x: 34, y: 57 },
    up: { x: 0, y: -18 },
    down: { x: 0, y: 50 },
  },
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
  const regenHpSmallImages = regenHpSmallFrameSources.map((src, index) => loadFrame(src, regenHpSmallFrames, index));
  const regenHpLargeImages = regenHpLargeFrameSources.map((src, index) => loadFrame(src, regenHpLargeFrames, index));
  const smallThunderSummonImages = smallThunderSummonFrameSources.map((src, index) => loadFrame(src, smallThunderSummonFrames, index));
  const smallThunderDamagedImages = smallThunderDamagedFrameSources.map((src, index) => loadFrame(src, smallThunderDamagedFrames, index));
  const smallFireSummonImages = smallFireSummonFrameSources.map((src, index) => loadFrame(src, smallFireSummonFrames, index));
  const smallFireDamagedImages = smallFireDamagedFrameSources.map((src, index) => loadFrame(src, smallFireDamagedFrames, index));
  const smallIceSummonImages = smallIceSummonFrameSources.map((src, index) => loadFrame(src, smallIceSummonFrames, index));
  const smallIceDamagedImages = smallIceDamagedFrameSources.map((src, index) => loadFrame(src, smallIceDamagedFrames, index));
  const smallIceBreakImages = smallIceBreakFrameSources.map((src, index) => loadFrame(src, smallIceBreakFrames, index));
  const damageFailImages = damageFailFrameSources.map((src, index) => loadFrame(src, damageFailFrames, index));
  const faintedImages = faintedFrameSources.map((src, index) => loadFrame(src, faintedFrames, index));
  const damageSuccessSmallImages = damageSuccessSmallFrameSources.map((src, index) => loadFrame(src, damageSuccessSmallFrames, index));
  const damageSuccessMiddleImages = damageSuccessMiddleFrameSources.map((src, index) => loadFrame(src, damageSuccessMiddleFrames, index));
  const readyImages = Object.entries(moneyDartReadyFrameSources).flatMap(([team, sources]) =>
    sources.map((src, index) => loadFrame(src, moneyDartReadyFrames[team], index))
  );
  const pickupImages = moneyDartPickupFrameSources.map((src, index) => loadFrame(src, moneyDartPickupFrames, index));
  const respawnPointerImages = respawnPointerFrameSources.map((src, index) => loadFrame(src, respawnPointerFrames, index));
  const dragArrowImages = Object.entries(dragArrowFrameSources).flatMap(([direction, sources]) => (
    sources.map((src, index) => loadFrame(src, dragArrowFrames[direction], index))
  ));
  const movePrearriveImages = Object.entries(movePrearriveFrameSources).flatMap(([team, directions]) => (
    Object.entries(directions).flatMap(([direction, sources]) => (
      sources.map((src, index) => loadFrame(src, movePrearriveFrames[team][direction], index))
    ))
  ));
  const moveArriveImages = Object.entries(moveArriveFrameSources).flatMap(([team, directions]) => (
    Object.entries(directions).flatMap(([direction, sources]) => (
      sources.map((src, index) => loadFrame(src, moveArriveFrames[team][direction], index))
    ))
  ));
  const useNinjuImages = Object.entries(useNinjuFrameSources).flatMap(([team, sources]) => (
    sources.map((src, index) => loadFrame(src, useNinjuFrames[team], index))
  ));
  const shootImages = Object.entries(moneyDartShootFrameSources).flatMap(([team, dirs]) =>
    Object.entries(dirs).flatMap(([direction, sources]) =>
      sources.map((src, index) => loadFrame(src, moneyDartShootFrames[team][direction], index))
    )
  );
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
  return Promise.all([...staticImages, ...ninjuImages, ...atkUpImages, ...regenHpSmallImages, ...regenHpLargeImages, ...smallThunderSummonImages, ...smallThunderDamagedImages, ...smallFireSummonImages, ...smallFireDamagedImages, ...smallIceSummonImages, ...smallIceDamagedImages, ...smallIceBreakImages, ...damageFailImages, ...faintedImages, ...damageSuccessSmallImages, ...damageSuccessMiddleImages, ...chargeRedImages, ...chargeYellowImages, ...readyImages, ...pickupImages, ...respawnPointerImages, ...dragArrowImages, ...movePrearriveImages, ...moveArriveImages, ...useNinjuImages, ...weaponImages, ...shootImages]);
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
  state.ninjuDamageEffects = [];
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
  return { id, name, team, x, y, hp: hpMax, maxHp: hpMax, skill: maxSkill, soulSteps: 0, facing: team === "blue" ? "right" : "left", alive: true, moveT: 1, fromX: x, fromY: y, moveTrail: null, hitFlash: 0, respawning: false, respawnTipUntil: 0, aiNextThink, aiActionAt: 0, aiPlanKey: "", ninju: null, steelUntil: 0, hotBloodUntil: 0, buffAuraType: "", disabledUntil: 0, invincibleUntil: 0, moneyDart: null, ninjuLockedUntil: 0, weaponKey, controlMode, weaponReadyAt: 0, kills: 0, damageDone: 0, damageTaken: 0 };
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
    <option value="player" selected>玩家</option>
    <option value="ai_beginner">初心者</option>
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
        if (levelEl) levelEl.textContent = "";
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
    updateRestartHold(now);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackdrop();
    drawBoard();
    drawDrag();
    drawMapObjects();
    drawMoveTrails(now);
    drawUnits();
    drawNinjuEffects(now);
    drawMoneyDartShootAnimations(now);
    drawProjectiles(now);
    drawAttacks();
    drawGameHud();
    drawNinjuBar();
    drawFrame();
    drawCountdownOverlay(now);
    drawResultOverlay();
    updatePanel();
  } catch (error) {
    console.error("Render loop recovered", error);
    state.moneyDartCasts = [];
    state.projectiles = [];
    state.ninjuDamageEffects = [];
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
  const mapDrawRect = {
    x: grid.left + battleMapDrawInset.left,
    y: grid.top + battleMapDrawInset.top,
    w: grid.cols * grid.cell - battleMapDrawInset.left - battleMapDrawInset.right,
    h: grid.rows * grid.cell - battleMapDrawInset.top - battleMapDrawInset.bottom,
  };
  if (images.arena) {
    ctx.drawImage(images.arena, mapDrawRect.x, mapDrawRect.y, mapDrawRect.w, mapDrawRect.h);
  } else if (images.bg) {
    ctx.globalAlpha = 0.8;
    ctx.drawImage(images.bg, mapDrawRect.x, mapDrawRect.y, mapDrawRect.w, mapDrawRect.h);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = "#74ad7f";
    ctx.fillRect(mapDrawRect.x, mapDrawRect.y, mapDrawRect.w, mapDrawRect.h);
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

    const isPlayer = unit.id === playerUnitId;

    // 玩家單位改用白色手指指示，不顯示黃色選取圓圈。
    if (selected && !isPlayer) {
      ctx.strokeStyle = "#ffe06d";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y + 4, 31, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (state.charging && state.pressedUnit === unit) {
      drawChargeEffect(p, "back", unit);
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

    const useNinjuSprite = unitUseNinjuSprite(unit);
    const sprite = useNinjuSprite || unitSprite(unit);
    // arrive 動畫播放期間隱藏靜態 sprite，由 drawMoveTrails 負責顯示殘影。
    const isMoving = unit.moveTrail && (performance.now() - unit.moveTrail.startedAt) < ARRIVE_TOTAL;
    if (!activeMoneyDartCast(unit) && !isMoving && !unit.moneyDart && sprite) {
      const auraType = activeBuffAuraType(unit);
      if (auraType === "steel") drawSteelSpriteOutline(sprite, p, bob);
      if (auraType === "hotBlood") drawHotBloodSpriteOutline(sprite, p, bob);
      const spritePoint = useNinjuSprite
        ? { x: p.x + useNinjuSpriteOffset.x, y: p.y + useNinjuSpriteOffset.y }
        : p;
      drawUnitImage(sprite, spritePoint, bob);
      if (useNinjuSprite) drawUnitEyes({ ...unit, facing: "down" }, p, bob);
      else drawUnitEyes(unit, p, bob);
    } else if (!activeMoneyDartCast(unit) && !isMoving && !unit.moneyDart && !isPlayer) {
      // 玩家單位不顯示色圓佔位，其他單位仍顯示。
      ctx.fillStyle = unit.team === "blue" ? "#5bb8ff" : "#b5b9b3";
      ctx.beginPath();
      ctx.arc(p.x, p.y - 12 + bob, 24, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state.charging && state.pressedUnit === unit) {
      drawChargeEffect(p, "front", unit);
    }

    // 拿標備彈時的 buff 光圈：依當前動畫階段選用對應 sprite，確保光圈形狀與角色一致
    if (unit.moneyDart && !activeMoneyDartCast(unit) && !isMoving) {
      const auraType = activeBuffAuraType(unit);
      if (auraType) {
        const elapsed = performance.now() - unit.moneyDart.startedAt;
        const pickupMs = 300;
        const key = unit.team === "blue" ? "b" : "g";
        let auraSprite;
        if (elapsed < pickupMs) {
          // pickup 階段：角色本體是 idle sprite，光圈用標準位置
          auraSprite = unitSprite(unit);
          if (auraSprite) {
            if (auraType === "steel") drawSteelSpriteOutline(auraSprite, p, bob);
            if (auraType === "hotBlood") drawHotBloodSpriteOutline(auraSprite, p, bob);
          }
        } else {
          // ready 備彈階段：b_dart 幀 + 補正偏移，光圈對齊補正後位置
          auraSprite = moneyDartReadyFrame(unit.facing, unit.team) || unitSprite(unit);
          const auraOff = moneyDartReadyOffsets[unit.facing] || { dx: 0, dy: 0 };
          const drawAt = { x: p.x - 31 + auraOff.dx, y: p.y - 47 + auraOff.dy + bob, w: 62, h: 62 };
          if (auraSprite) {
            if (auraType === "steel") drawSteelSpriteOutline(auraSprite, p, bob, drawAt);
            if (auraType === "hotBlood") drawHotBloodSpriteOutline(auraSprite, p, bob, drawAt);
          }
        }
      }
    }

    drawHeldMoneyDart(unit, p);
    drawRespawnPointer(unit, p);

    if (isPlayer) {
      drawPlayerArrow(p);
    } else {
      drawHp(unit, p.x, p.y - 70);
      drawUnitName(unit, p.x, p.y - 50);
    }
  }
}

// 集技時繪製藍色外圈與紅/黃火焰。unit 用來根據面向決定火焰位置。
function drawChargeEffect(p, layer = "all", unit = null) {
  const now = performance.now();
  const redFrame = chargeRedFrames[Math.floor(now / 120) % chargeRedFrames.length];
  const yellowFrame = chargeYellowFrames[Math.floor(now / 120) % chargeYellowFrames.length];

  // 根據角色面向決定火焰中心偏移（x/y）與傾斜角度（rot，弧度，正值順時針）。
  const facing = unit ? (unit.facing || "down") : "down";
  const fireOff = {
    up:           { x: 0,  y: -35, rot: 0    },
    down:         { x: 0,  y: -35, rot: 0    },
    right:        { x: -5, y: -35, rot: -0.3 },  // 約 17° 逆時針（向左傾）
    left:         { x: 5,  y: -35, rot: 0.3  },  // 約 17° 順時針（向右傾）
    "up-right":   { x: -3, y: -35, rot: 0.15 },
    "up-left":    { x: 3,  y: -35, rot: -0.15 },
    "down-right": { x: -3, y: -35, rot: 0.2  },
    "down-left":  { x: 3,  y: -35, rot: -0.2 },
  };
  const off = fireOff[facing] || fireOff["down"];
  const fx = p.x + off.x;
  const fy = p.y + off.y;
  const rot = off.rot;

  ctx.save();
  ctx.globalAlpha = 0.82;
  if ((layer === "all" || layer === "back") && images.chargeOuter) {
    ctx.drawImage(images.chargeOuter, p.x - 39, p.y - 55, 78, 78);
  }
  if ((layer === "all" || layer === "front") && redFrame) {
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(rot);
    ctx.drawImage(redFrame, -25, -30, 50, 60);
    ctx.restore();
  }
  if ((layer === "all" || layer === "front") && yellowFrame) {
    ctx.globalAlpha = 0.72;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(rot);
    ctx.drawImage(yellowFrame, -16, -19, 32, 38);
    ctx.restore();
  }
  ctx.restore();
}

// 鋼鐵防禦的藍光描邊：用角色 sprite 本身當遮罩，往外偏移 3px 畫出貼角色輪廓的細線。
function drawSteelSpriteOutline(sprite, p, bob = 0, drawAt = null) {
  drawBuffSpriteOutline(sprite, p, bob, steelOutlineCache, "#5feeff", "#39e8ff", 2, 7, drawAt); // 鋼鐵外圈：fill 顏色、shadow 顏色、線寬、發光強度。
}

function drawHotBloodSpriteOutline(sprite, p, bob = 0, drawAt = null) {
  drawBuffSpriteOutline(sprite, p, bob, hotBloodOutlineCache, "#ff2d24", "#ff1f1a", 2, 7, drawAt); // 熱血外圈：紅色系，線寬目前跟鋼鐵一致。
}

// drawAt: 可選的自訂繪製區域 { x, y, w, h }，供射出動畫等非標準位置使用。
function drawBuffSpriteOutline(sprite, p, bob, cache, fill, shadow, outlineWidth, shadowBlur, drawAt = null) {
  const mask = spriteColorMask(sprite, cache, fill);
  if (!mask) return;
  let x, y, w, h;
  if (drawAt) {
    ({ x, y, w, h } = drawAt);
  } else {
    const offset = { x: -31, y: 47 }; // 外圈 offset：x 正值往右、y 正值往上。
    const at = applyOffset({ x: p.x, y: p.y + bob }, offset);
    x = at.x; y = at.y; w = 62; h = 62;
  }
  const pulse = 0.66 + Math.sin(performance.now() / 170) * 0.1; // 透明度脈動強度/速度。

  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.shadowColor = shadow;
  ctx.shadowBlur = shadowBlur;
  for (let dx = -outlineWidth; dx <= outlineWidth; dx++) {
    for (let dy = -outlineWidth; dy <= outlineWidth; dy++) {
      const distance = Math.hypot(dx, dy);
      if (distance <= 0 || distance > outlineWidth) continue;
      ctx.drawImage(mask, x + dx, y + dy, w, h);
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

// 繪製拿標角色 sprite：前 300ms 播放 pickup 起身動畫，之後在 idle 上疊錢標圖示。
function drawHeldMoneyDart(unit, p) {
  if (!unit.moneyDart) return;
  const now = performance.now();
  const elapsed = now - unit.moneyDart.startedAt;
  const pickupMs = 300;
  const key = unit.team === "blue" ? "b" : "g";

  ctx.save();
  if (elapsed < pickupMs) {
    // pickup 階段：顯示 idle 角色，dart 從小到完整疊加在手部位置
    const idleSprite = unitSprite(unit);
    if (idleSprite) ctx.drawImage(idleSprite, p.x - 31, p.y - 47, 62, 62);
    if (moneyDartPickupFrames.length > 0) {
      const idx = Math.min(moneyDartPickupFrames.length - 1, Math.floor(elapsed / pickupMs * moneyDartPickupFrames.length));
      const dartFrame = moneyDartPickupFrames[idx];
      // 36×36 的 dart 疊加在角色手部中央位置
      if (dartFrame) ctx.drawImage(dartFrame, p.x - 18, p.y - 25, 36, 36);
    }
    // 眼睛：依面向使用正常 eyeOffsets
    drawUnitEyes(unit, p, 0);
  } else {
    // ready 備彈階段：依面向方向顯示 b_dart 幀，套用補正偏移對齊 idle 視覺位置
    const frame = moneyDartReadyFrame(unit.facing, unit.team);
    const readyOff = moneyDartReadyOffsets[unit.facing] || { dx: 0, dy: 0 };
    if (frame) ctx.drawImage(frame, p.x - 31 + readyOff.dx, p.y - 47 + readyOff.dy, 62, 62);
    drawUnitEyes(unit, p, 0, moneyDartEyeOffsets);
  }
  ctx.restore();
}

// 依照面向方向取得對應隊伍的錢鏢備彈靜態影格。
function moneyDartReadyFrame(facing, team) {
  const dirIndex = { right: 0, left: 1, up: 2, down: 3 }[facing] ?? 0;
  const key = team === "blue" ? "b" : "g";
  return (moneyDartReadyFrames[key] || [])[dirIndex] || null;
}

// 前 300ms 播放拿標起身動畫（dart 出現），之後顯示面向對應的備彈靜態幀。
function moneyDartPickupOrReadyFrame(unit, elapsed) {
  const pickupMs = 300;
  if (elapsed < pickupMs && moneyDartPickupFrames.length > 0) {
    const frameMs = pickupMs / moneyDartPickupFrames.length;
    const idx = Math.min(moneyDartPickupFrames.length - 1, Math.floor(elapsed / frameMs));
    return moneyDartPickupFrames[idx] || null;
  }
  return moneyDartReadyFrame(unit.facing, unit.team);
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

// 錢鏢飛行 projectile 僅保留狀態清理，不繪製視覺（視覺由 b_dart_shoot 動畫負責）。
function drawProjectiles(now) {
  if (!state.projectiles) return;
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const projectile = state.projectiles[i];
    const age = Math.min(1, (now - projectile.startedAt) / projectile.duration);
    if (!Number.isFinite(age) || !projectile.from || !projectile.to) {
      state.projectiles.splice(i, 1);
      continue;
    }
    try {
      // 不繪製投射物圖片
    } catch (error) {
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
    const teamKey = unit.team === "blue" ? "b" : "g";
    const frames = ((moneyDartShootFrames[teamKey] || {})[cast.dir] || []).filter(f => f && f.naturalWidth > 0);
    if (frames.length === 0) continue; // 圖片未載入時跳過這幀，保留 cast
    const frameIdx = Math.max(0, Math.min(frames.length - 1, Math.floor(progress * frames.length)));
    const frame = frames[frameIdx];
    const p = unitPosition(unit);
    const placement = moneyDartShootPlacement(cast.dir, frame, p, frameIdx);

    // 射出時 buff 光圈：使用當前 shoot 幀作為遮罩來源，並對齊 shoot 幀的位置與大小
    const shootAuraType = activeBuffAuraType(unit);
    if (shootAuraType) {
      const drawAt = { x: placement.x, y: placement.y, w: placement.w, h: placement.h };
      if (shootAuraType === "steel") drawSteelSpriteOutline(frame, p, 0, drawAt);
      if (shootAuraType === "hotBlood") drawHotBloodSpriteOutline(frame, p, 0, drawAt);
    }
    ctx.save();
    ctx.globalAlpha = 0.98;
    ctx.drawImage(frame, placement.x, placement.y, placement.w, placement.h);
    ctx.restore();
    // 射出動畫期間補上眼睛：依當前幀的逐幀頭部座標，換算至 placement 座標系
    const headCfg = moneyDartShootFrameHeads[cast.dir] || moneyDartShootFrameHeads.down;
    const headFrameIdx = Math.max(0, Math.min(headCfg.frames.length - 1, frameIdx));
    const headPx = headCfg.frames[headFrameIdx];
    const scale = moneyDartVisualOffsets.shoot.scale;
    const eyeAnchor = {
      x: placement.x + headPx.x * scale - headCfg.w / 2,
      y: placement.y + headPx.y * scale - headCfg.h / 2,
    };
    drawMoneyDartShootEye(unit.facing, eyeAnchor, headCfg);
  }
}

// 取得角色目前仍在播放的錢鏢出手動畫。
function activeMoneyDartCast(unit) {
  if (!state.moneyDartCasts) return null;
  const now = performance.now();
  return state.moneyDartCasts.find((cast) => cast.unitId === unit.id && now - cast.startedAt < cast.duration) || null;
}

// 依方向決定錢鏢出手動畫的位置與尺寸。
// frameIdx：用於左右方向的逐幀 Y 補正，抵消投擲動作造成的視覺重心下移。
function moneyDartShootPlacement(direction, frame, p, frameIdx = 0) {
  const offsets = moneyDartVisualOffsets.shoot;
  const offset = offsets[direction] || offsets.down;
  const scale = offsets.scale;
  const w = frame.width * scale;
  const h = frame.height * scale;
  if (direction === "right") {
    const yCorr = (moneyDartShootYCorrection[frameIdx] || 0) * scale;
    return { x: p.x + offset.x, y: p.y - offset.y + 10 + yCorr, w, h };
  }
  if (direction === "left") {
    const yCorr = (moneyDartShootYCorrection[frameIdx] || 0) * scale;
    return { x: p.x + offset.x - w, y: p.y - offset.y + 10 + yCorr, w, h };
  }
  if (direction === "up") return { x: p.x + offset.x - w / 2, y: p.y - offset.y - h+20, w, h };
  return { x: p.x + offset.x - w / 2, y: p.y - offset.y, w, h };
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

// 繪製角色頭上的血條（原版金框樣式）。
function drawHp(unit, x, y) {
  const W = 50, H = 8;
  const hpMax = unit.maxHp || maxHp;
  const ratio = Math.max(0, unit.hp / hpMax);
  // 底層背景圖
  if (images.barBackground) {
    ctx.drawImage(images.barBackground, x - W / 2, y, W, H);
  } else {
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(x - W / 2, y, W, H);
  }
  // 血量填色（紅色）
  ctx.fillStyle = "#e02020";
  ctx.fillRect(x - W / 2, y, W * ratio, H);
  // 金框外框
  ctx.save();
  ctx.strokeStyle = "#e8c000";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x - W / 2, y, W, H);
  // 內層細框
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 0.6;
  ctx.strokeRect(x - W / 2 + 1, y + 1, W - 2, H - 2);
  ctx.restore();
}

// 繪製角色名稱標籤（name_bar 背景 + 居中文字）。
function drawUnitName(unit, x, y) {
  ctx.save();
  ctx.font = "700 11px Microsoft JhengHei, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const textW = ctx.measureText(unit.name).width;
  const NW = Math.max(66, textW + 22);
  const NH = 16;
  if (images.nameBar) {
    ctx.drawImage(images.nameBar, x - NW / 2, y - NH / 2, NW, NH);
  } else {
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(x - NW / 2, y - NH / 2, NW, NH);
  }
  ctx.fillStyle = "#fffde7";
  ctx.fillText(unit.name, x, y);
  ctx.restore();
}

// 在玩家角色頭上繪製白色手指指示器（bob 動畫）。
function drawPlayerArrow(p) {
  const img = images.playerPointer;
  if (!img) return;
  const now = performance.now();
  const bob = Math.sin(now / 350) * 3;
  const w = img.width, h = img.height;
  ctx.drawImage(img, p.x - w / 2, p.y - 47 - h - 4 + bob, w, h);
}

// 射出動畫專用眼睛繪製：錨點已由 placement 推算好，直接依面向畫眼睛。
function drawMoneyDartShootEye(facing, anchor, cfg) {
  if (!cfg) return;
  if (facing === "left" || facing === "right") {
    const img = images.eyeSide || images.eyesFront;
    if (!img) return;
    ctx.save();
    if (facing === "left") {
      ctx.translate(anchor.x + cfg.w, anchor.y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, cfg.w, cfg.h);
    } else {
      ctx.drawImage(img, anchor.x, anchor.y, cfg.w, cfg.h);
    }
    ctx.restore();
  } else if (facing === "down") {
    const img = images.eyesFront;
    if (!img) return;
    ctx.drawImage(img, anchor.x, anchor.y, cfg.w, cfg.h);
  }
  // up 不顯示眼睛
}

// 疊加角色眼睛。左右只顯示單眼；上下顯示雙眼。
function drawUnitEyes(unit, p, bob = 0, offsetTable = eyeOffsets) {
  const facing = unit.facing || "down";
  const offset = Object.prototype.hasOwnProperty.call(offsetTable, facing) ? offsetTable[facing] : offsetTable.down;
  if (!offset) return;

  if (facing === "left" || facing === "right") {
    const sideEye = images.eyeSide || images.eyesFront;
    if (!sideEye) return;
    ctx.save();
    if (facing === "left") {
      // 左向改用鏡像（依目前素材方向做對調）。
      ctx.translate(p.x + offset.x + offset.w, p.y - offset.y + bob);
      ctx.scale(-1, 1);
      ctx.drawImage(sideEye, 0, 0, offset.w, offset.h);
    } else {
      // 右向改用原圖（依目前素材方向做對調）。
      ctx.drawImage(sideEye, p.x + offset.x, p.y - offset.y + bob, offset.w, offset.h);
    }
    ctx.restore();
    return;
  }

  const frontEyes = images.eyesFront;
  if (!frontEyes) return;
  ctx.drawImage(frontEyes, p.x + offset.x, p.y - offset.y + bob, offset.w, offset.h);
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

// 用整理後的 drag-arrow 組合圖繪製拖曳移動方向。
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
      const frames = ninjuCastFrames(unit.ninju.type);
      const frame = frames[Math.floor(progress * frames.length)];
      if (frame) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        const size = attackNinjuConfigs[unit.ninju.type] ? 184 : 92;
        ctx.drawImage(frame, p.x - size / 2, p.y - 22 - size / 2, size, size);
        ctx.restore();
      }
    }
  }
  drawNinjuDamageEffects(now);
}

function ninjuCastFrames(type) {
  if (attackNinjuConfigs[type]) return attackNinjuConfigs[type].summonFrames;
  if (type === "hotBlood") return atkUpFrames;
  if (type === "genki") return regenHpSmallFrames;
  if (type === "kakki" || type === "shinki") return regenHpLargeFrames;
  return defUpFrames;
}

function drawNinjuDamageEffects(now) {
  if (!state.ninjuDamageEffects) return;
  for (let i = state.ninjuDamageEffects.length - 1; i >= 0; i--) {
    const effect = state.ninjuDamageEffects[i];
    if (now < effect.startedAt) continue;
    const frames = ninjuDamageFrames(effect.type);
    const elapsed = now - effect.startedAt;
    if (elapsed >= effect.duration || frames.length === 0) {
      state.ninjuDamageEffects.splice(i, 1);
      continue;
    }
    const frameDuration = effect.frameDuration || effect.duration;
    const progress = Math.min(0.999, elapsed / frameDuration);
    const frame = frames[Math.floor(progress * frames.length)];
    if (!frame) continue;
    const target = state.units.find((unit) => unit.id === effect.targetId);
    const p = target && (target.alive || target.respawning) ? unitPosition(target) : effect.at;
    const placement = ninjuDamageEffectPlacement(effect.type);
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.drawImage(frame, p.x + placement.x - placement.w / 2, p.y - placement.y - placement.h / 2, placement.w, placement.h);
    ctx.restore();
  }
}

function ninjuDamageFrames(type) {
  if (attackNinjuConfigs[type]) return attackNinjuConfigs[type].hitFrames;
  if (type === "freezeBreak") return smallIceBreakFrames;
  if (type === "flashMiss") return damageFailFrames;
  if (type === "flashHit") return faintedFrames;
  if (type === "flashHitHead") return damageSuccessSmallFrames;
  if (type === "wildfireMiddleHitHead") return damageSuccessMiddleFrames;
  return [];
}

function ninjuDamageEffectPlacement(type) {
  if (type === "flashMiss") return { x: 0, y: 76, w: 87, h: 57 };
  if (type === "flashHitHead") return { x: 0, y: 78, w: 87, h: 57 };
  if (type === "wildfireMiddleHitHead") return { x: 0, y: 78, w: 87, h: 57 };
  if (type === "flashHit") return { x: 0, y: 35, w: 74, h: 74 };
  return { x: 0, y: 22, w: 138, h: 138 };
}

function addNinjuDamageEffect(type, target, now = performance.now(), duration = 0, options = {}) {
  if (!target) return;
  if (!state.ninjuDamageEffects) state.ninjuDamageEffects = [];
  const frames = ninjuDamageFrames(type);
  state.ninjuDamageEffects.push({
    type,
    targetId: target.id,
    at: unitPosition(target),
    startedAt: now,
    duration: duration || Math.max(300, frames.length * 40),
    frameDuration: options.frameDuration || 0,
  });
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
  drawSoulHud();
  drawTopHud();
  drawBottomPlayerHud();
  drawInventoryHud();
}

// Draws the soul HUD over the map, above the HP bar area.
function drawSoulHud() {
  const x = 16; // soul HUD X: bigger moves right.
  const y = 470; // soul HUD Y: bigger moves down.
  const w = 284; // soul HUD width.
  const h = 66; // soul HUD height.
  const barY = y + 44; // soul fill Y: bigger moves down.
  const barH = 7; // soul fill height.
  const tickXs = [61, 101, 154, 214, 275]; // soul tick X offsets: 0, soul1, soul2, soul3, soul4.
  const unit = selectedHudUnit();
  const soulSteps = Math.min(soulStepsPerLevel * soulMaxLevel, Math.max(0, unit?.soulSteps || 0));
  const totalProgress = soulSteps / (soulStepsPerLevel * soulMaxLevel);
  const completedLevel = Math.min(soulMaxLevel, Math.floor(soulSteps / soulStepsPerLevel));
  const segmentProgress = completedLevel >= soulMaxLevel ? 1 : (soulSteps % soulStepsPerLevel) / soulStepsPerLevel;
  const imageLevel = completedLevel <= 0 ? 1 : completedLevel + 1;
  const imageKey = `soulHud${Math.min(5, imageLevel)}`;
  const fillColors = ["#1b7a2d", "#1b7a2d", "#20248b", "#8c178e", "#c92116"]; // soul bar colors by completed level.
  ctx.save();
  if (images[imageKey]) {
    ctx.drawImage(images[imageKey], x, y, w, h);
  }
  if (totalProgress > 0) {
    const fromTick = tickXs[completedLevel];
    const toTick = tickXs[Math.min(soulMaxLevel, completedLevel + 1)];
    const fillEndOffset = completedLevel >= soulMaxLevel ? tickXs[soulMaxLevel] : fromTick + (toTick - fromTick) * segmentProgress;
    const barX = x + tickXs[0];
    const fillEndX = x + fillEndOffset;
    const fill = Math.max(0, fillEndX - barX);
    ctx.fillStyle = fillColors[completedLevel] || fillColors[0];
    ctx.fillRect(barX, barY, fill, barH);
  }
  ctx.restore();
}

// 繪製上方玩家名稱、段數與段位文字。
function drawTopHud() {
  ctx.save();
  ctx.fillStyle = "rgba(6, 47, 55, .5)"; // 上方藍底顏色/透明度：最後的 .7 是透明度，0 完全透明，1 完全不透明。
  ctx.fillRect(0, 0, canvas.width, 32); // 上方藍底位置/大小：第一個數字 X，第二個數字 Y，第四個數字高度；數字變大會往右/往下/變高。
  ctx.textBaseline = "middle";
  drawIconImage(images.blueIcon, 38, 5, 35, 25); // 左上人頭位置/大小：X=38 往右，Y=18 往下，W=42 寬度，H=31 高度。
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

  for (const button of currentNinjuButtonList()) {
    drawNinjuSlot(button.x, button.y, button.w, button.h, button.label, button.type);
  }

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
  const isAttackNinju = Boolean(attackNinjuConfigs[type]);
  const isHeal = type === "genki" || type === "kakki" || type === "shinki";
  const isMoneyDart = type === "moneyDart";
  const isStatusButton = isSteel || isHotBlood || isHeal || isAttackNinju;
  const statusRule = isStatusButton ? statusButtonRule(type) : null;
  const active = unit && (isStatusButton ? ((unit.ninju?.type === type && (isUnitCastingNinju(unit) || isUnitInNinjuGap(unit))) || (isSteel ? isSteelDefenseActive(unit) : isHotBlood ? isHotBloodActive(unit) : false)) : false);
  const hasAttackSoul = !isAttackNinju || Math.floor((unit?.soulSteps || 0) / soulStepsPerLevel) >= 1;
  const hasRequiredSkill = !isStatusButton || isAttackNinju || unit.skill >= statusRule.cost;
  // 錢鏢：拿標中、射後鎖定期間、移動動畫中 → 暗色不可用；否則亮色可用
  const moneyDartMoving = unit.moveTrail && (performance.now() - unit.moveTrail.startedAt) < ARRIVE_TOTAL;
  const moneyDartReady = isMoneyDart && !unit.moneyDart && !activeMoneyDartCast(unit) && !moneyDartMoving && performance.now() >= (unit.ninjuLockedUntil || 0);
  const ready = !unit || (unit.alive && !isUnitDisabled(unit) && (isStatusButton ? statusRule.available !== false && hasRequiredSkill && hasAttackSoul : moneyDartReady));
  ctx.save();
  if (isAttackNinju && images.flashButton) {
    ctx.globalAlpha = ready ? 1 : 0.55;
    ctx.drawImage(images.flashButton, x, y, w, h);
    ctx.globalAlpha = 1;
    const textAt = applyOffset({ x: x + w / 2, y: y + h / 2 }, { x: -1, y: -1 }); // text offset: x positive moves right, y positive moves up.
    drawNinjuButtonText(text, textAt.x, textAt.y, 16, "#232323f8", "center");
  } else if ((isSteel || isHotBlood) && images.steelButton) {
    ctx.globalAlpha = ready ? 1 : 0.55;
    ctx.drawImage(images.steelButton, x, y, w, h);
    ctx.globalAlpha = 1;
    const textAt = applyOffset({ x: x + w / 2, y: y + h / 2 }, { x: -1, y: -1 }); // 忍術字 offset：x 正值往右、y 正值往上。
    drawNinjuButtonText(text, textAt.x, textAt.y, 16, "#232323f8", "center");
  } else if (isHeal && images.healButton) {
    ctx.globalAlpha = ready ? 1 : 0.55;
    ctx.drawImage(images.healButton, x, y, w, h);
    ctx.globalAlpha = 1;
    const textAt = applyOffset({ x: x + w / 2, y: y + h / 2 }, { x: -1, y: -1 }); // 忍術字 offset：x 正值往右、y 正值往上。
    drawNinjuButtonText(text, textAt.x, textAt.y, 16, "#232323f8", "center");
  } else if (isMoneyDart && images.moneyDartButton) {
    ctx.globalAlpha = ready ? 1 : 0.55;
    ctx.drawImage(images.moneyDartButton, x, y, w, h);
    ctx.globalAlpha = 1;
    const textAt = applyOffset({ x: x + w / 2, y: y + h / 2 }, { x: -1, y: -1 }); // 忍術字 offset：x 正值往右、y 正值往上。
    drawNinjuButtonText(text, textAt.x, textAt.y, 16, "#232323f8", "center");
  } else {
    ctx.fillStyle = text ? "#c78e42" : "#2d3d38";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#77bec6";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    if (text) drawOutlinedText(text, x + w / 2, y + h / 2 + 1, 15, "#ffe6a6", "center");
  }
  if (active) {
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.fillRect(x, y, w, h);
  }
  if ((isSteel || isHotBlood || isHeal || isAttackNinju) && unit && unit.ninju?.type === type && unit.ninju.queue > 0) {
    drawOutlinedText(`x${unit.ninju.queue + 1}`, x + w - 10, y + 8, 12, "#fff2a8", "center");
  }
  ctx.restore();
}

function currentNinjuButtonRects() {
  return {
    moneyDart: typeof moneyDartButtonRect !== "undefined" ? moneyDartButtonRect : { x: 508, y: 600, w: 65, h: 30 },
    steel: typeof steelButtonRect !== "undefined" ? steelButtonRect : { x: 582, y: 600, w: 65, h: 30 },
    hotBlood: typeof hotBloodButtonRect !== "undefined" ? hotBloodButtonRect : { x: 656, y: 600, w: 65, h: 30 },
    genki: typeof genkiButtonRect !== "undefined" ? genkiButtonRect : { x: 730, y: 600, w: 65, h: 30 },
    kakki: typeof kakkiButtonRect !== "undefined" ? kakkiButtonRect : { x: 804, y: 600, w: 65, h: 30 },
    shinki: typeof shinkiButtonRect !== "undefined" ? shinkiButtonRect : { x: 878, y: 600, w: 65, h: 30 },
  };
}

function currentNinjuButtonList() {
  const slots = currentNinjuSlotRects();
  return selectedNinjuLoadout.map((type, index) => {
    if (!type || !ninjuByType[type]) return null;
    const source = slots[index] || slots[0];
    const ninju = ninjuByType[type] || { label: type };
    return {
      ...source,
      // Slot offset is intentional: user-tuned +0/+1/+2/+3/+4/+5 alignment.
      x: source.x + index,
      type,
      label: ninju.label,
    };
  }).filter(Boolean);
}

function currentNinjuSlotRects() {
  const rects = currentNinjuButtonRects();
  return [rects.moneyDart, rects.steel, rects.hotBlood, rects.genki, rects.kakki, rects.shinki];
}

function statusButtonRule(type) {
  if (attackNinjuConfigs[type]) return attackNinjuRule(type);
  if (type === "hotBlood" && typeof hotBloodRule === "function") return hotBloodRule();
  if ((type === "genki" || type === "kakki" || type === "shinki") && typeof healNinjuRule === "function") return healNinjuRule(type);
  if (typeof steelRule === "function") return steelRule();
  return { cost: 7 };
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
  ctx.fillRect(814, 636, 62, 30);
  const buffUntil = Math.max(unit.steelUntil || 0, unit.hotBloodUntil || 0);
  const text = active ? "施放中" : gap ? "可移動" : buff ? `${Math.ceil((buffUntil - performance.now()) / 1000)}秒` : `技 ${steelRule().cost}`;
  drawOutlinedText(text, 845, 651, 14, "#f7f6d7", "center");
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

function unitMoveDirection(unit) {
  const dx = unit.x - unit.fromX;
  const dy = unit.y - unit.fromY;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  if (dy !== 0) return dy > 0 ? "down" : "up";
  return unit.facing || "down";
}

function unitMoveSprite(unit, direction, progress) {
  const team = unit.team === "blue" ? "blue" : "grey";
  const frameSet = progress < 0.35 ? movePrearriveFrames : moveArriveFrames;
  const frames = frameSet[team]?.[direction] || [];
  const available = frames.filter(Boolean);
  if (!available.length) return null;
  const localProgress = progress < 0.35 ? progress / 0.35 : (progress - 0.35) / 0.65;
  const index = Math.min(available.length - 1, Math.floor(localProgress * available.length));
  return available[index];
}

function unitUseNinjuSprite(unit) {
  if (!unit || unit.moneyDart || !isUnitCastingNinju(unit)) return null;
  const team = unit.team === "blue" ? "blue" : "grey";
  const frames = (useNinjuFrames[team] || []).filter(Boolean);
  if (!frames.length) return null;
  const progress = Math.min(0.999, (performance.now() - unit.ninju.startedAt) / unit.ninju.duration);
  return frames[Math.floor(progress * frames.length)];
}

function moveEffectPhase(progress) {
  return progress < 0.35 ? "prearrive" : "arrive";
}

function drawUnitImage(sprite, p, bob = 0, naturalSize = false, direction = "down", phase = "arrive") {
  if (!naturalSize) {
    ctx.drawImage(sprite, p.x - 31, p.y - 47 + bob, 62, 62);
    return;
  }
  const offset = moveEffectOffsets[phase]?.[direction] || { x: 0, y: 0 };
  const yOffset = sprite.height > sprite.width ? 78 : 26;
  ctx.drawImage(sprite, p.x - sprite.width / 2 + offset.x, p.y - yOffset + bob - offset.y);
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
  for (const button of currentNinjuButtonList()) {
    if (pointInRect(state.pointer.x, state.pointer.y, button)) {
      useNinjuByType(button.type);
      return;
    }
  }
  if (!cell || state.gameOver) return;

  const unitRaw = unitAt(cell.x, cell.y);
  // 移動動畫播放中視為不可點擊，等動畫結束才能再次操作。
  const unitMoving = unitRaw && unitRaw.moveTrail && (performance.now() - unitRaw.moveTrail.startedAt) < ARRIVE_TOTAL;
  const unit = unitMoving ? null : unitRaw;
  const selected = selectedUnit();
  state.pressedUnit = unit && canControlUnit(unit) && !unit.moneyDart ? unit : null;
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

function useNinjuByType(type) {
  if (type === "moneyDart") useMoneyDart();
  else if (type === "steel") useSteelNinju();
  else if (type === "hotBlood") useHotBloodNinju();
  else if (attackNinjuConfigs[type]) useAttackNinju(type);
  else if (type === "genki") useGenkiNinju();
  else if (type === "kakki") useKakkiNinju();
  else if (type === "shinki") useShinkiNinju();
}

// 處理滑鼠移動並更新目前指向的格子。
function pointerMove(event) {
  const rect = canvas.getBoundingClientRect();
  state.pointer.x = (event.clientX - rect.left) * canvas.width / rect.width;
  state.pointer.y = (event.clientY - rect.top) * canvas.height / rect.height;
  state.pointer.cell = pointToCell(state.pointer.x, state.pointer.y);

  const lookUnit = state.pressedUnit || selectedUnit();
  if (lookUnit && canControlUnit(lookUnit) && lookUnit.alive && !isUnitDisabled(lookUnit)) {
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

// 取得錢鏢飛行圖片（方向無關，統一使用 projectile 圖）。
function moneyDartProjectileImage() {
  return images.moneyDartProjectile || null;
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
  resetRestartHold();
  resetGame();
  syncBgm();
  startBgm();
}

function returnToRoom() {
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
  state.ninjuDamageEffects = [];
  state.moneyDartCasts = [];
  clearDragState();
  resetRestartHold();
  document.body.classList.add("room-mode");
  syncBgm();
  startBgm();
  setMessage("Back to room.");
}

// 結算畫面點一下回房間，並保留房間原本配置（卡片啟用、武器、控制模式、HP）。
function returnToRoomFromResult() {
  returnToRoom();
}

function updateRuleModeUi() {
  if (!ruleModeToggle || !ruleModeCheckbox) return;
  const checked = state.useOriginalMode;
  ruleModeToggle.setAttribute("aria-pressed", checked ? "true" : "false");
  ruleModeToggle.classList.toggle("checked", checked);
}

function startRestartHold(event) {
  if (event.code !== "KeyR" || state.inRoom) return;
  if (!restartHoldStartedAt) restartHoldStartedAt = performance.now();
}

function stopRestartHold(event) {
  if (event.code !== "KeyR") return;
  resetRestartHold();
}

function resetRestartHold() {
  restartHoldStartedAt = 0;
  restartHoldTriggered = false;
}

function updateRestartHold(now) {
  if (!restartHoldStartedAt || restartHoldTriggered || state.inRoom) return;
  if (now - restartHoldStartedAt < 3000) return;
  restartHoldTriggered = true;
  returnToRoom();
}

function toggleRuleMode() {
  state.useOriginalMode = !state.useOriginalMode;
  updateRuleModeUi();
}

function openNinjuEditor() {
  if (!ninjuEditorEl) return;
  editNinjuDraft = [...selectedNinjuLoadout];
  editNinjuSlotIndex = 0;
  renderNinjuEditor();
  ninjuEditorEl.hidden = false;
}

function closeNinjuEditor() {
  if (ninjuEditorEl) ninjuEditorEl.hidden = true;
}

function saveNinjuEditor() {
  selectedNinjuLoadout = normalizedNinjuLoadout(editNinjuDraft);
  window.localStorage.setItem(ninjuLoadoutStorageKey, JSON.stringify(selectedNinjuLoadout));
  closeNinjuEditor();
}

function loadSavedNinjuLoadout() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(ninjuLoadoutStorageKey) || "null");
    if (Array.isArray(saved) && saved.length === 6 && saved.every((type) => !type || ninjuByType[type])) return normalizedNinjuLoadout(saved);
  } catch (_) {
    // Ignore broken localStorage data and fall back to the default six slots.
  }
  return [...defaultNinjuLoadout];
}

function normalizedNinjuLoadout(loadout) {
  return Array.from({ length: 6 }, (_, index) => (ninjuByType[loadout[index]] ? loadout[index] : null));
}

function resetNinjuEditorLoadout() {
  editNinjuDraft = Array(6).fill(null);
  editNinjuSlotIndex = 0;
  renderNinjuEditor();
}

function renderNinjuEditor() {
  if (!ninjuEditorSlotsEl || !ninjuEditorListEl) return;
  ninjuEditorSlotsEl.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const type = editNinjuDraft[i];
    const ninju = ninjuByType[type] || { label: "空" };
    const button = document.createElement("button");
    button.type = "button";
    button.className = `ninju-slot-choice${i === editNinjuSlotIndex ? " selected" : ""}${type ? "" : " empty"}`;
    if (type) button.dataset.ninjuType = type;
    button.textContent = ninju.label;
    button.addEventListener("click", () => {
      editNinjuDraft[i] = null;
      editNinjuSlotIndex = i;
      renderNinjuEditor();
    });
    ninjuEditorSlotsEl.appendChild(button);
  }

  ninjuEditorListEl.innerHTML = "";
  for (const ninju of ninjuEditorCatalog) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `ninju-option ${ninju.group}${editNinjuDraft.includes(ninju.type) ? " selected" : ""}`;
    button.dataset.ninjuType = ninju.type;
    button.dataset.editorRow = ninju.editorRow;
    button.style.setProperty("--editor-order", ninju.editorOrder);
    button.textContent = ninju.label;
    button.addEventListener("click", () => {
      const existingIndex = editNinjuDraft.indexOf(ninju.type);
      if (existingIndex >= 0) editNinjuDraft[existingIndex] = null;
      const emptyIndex = editNinjuDraft.findIndex((type) => !type);
      if (emptyIndex < 0) return;
      editNinjuDraft[emptyIndex] = ninju.type;
      const nextEmptyIndex = editNinjuDraft.findIndex((type) => !type);
      editNinjuSlotIndex = nextEmptyIndex >= 0 ? nextEmptyIndex : emptyIndex;
      renderNinjuEditor();
    });
    ninjuEditorListEl.appendChild(button);
  }
}

canvas.addEventListener("pointerdown", pointerDown);
canvas.addEventListener("pointermove", pointerMove);
window.addEventListener("pointerup", pointerUp);
window.addEventListener("keydown", startRestartHold);
window.addEventListener("keyup", stopRestartHold);
resetBtn.addEventListener("click", resetGame);
resetBtn.addEventListener("click", startBgm);
setupWeaponSelects();
setupControlSelects();
setupHpInputs();
setupRoomSlots();
if (battleStartBtn) battleStartBtn.addEventListener("click", startBattleFromRoom);
if (teamEditBtn) teamEditBtn.addEventListener("click", openNinjuEditor);
if (ninjuEditorResetBtn) ninjuEditorResetBtn.addEventListener("click", resetNinjuEditorLoadout);
if (ninjuEditorCancelBtn) ninjuEditorCancelBtn.addEventListener("click", closeNinjuEditor);
if (ninjuEditorSaveBtn) ninjuEditorSaveBtn.addEventListener("click", saveNinjuEditor);
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

