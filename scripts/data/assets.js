// Asset paths and frame buffers. Loading still happens in game.js for now.
const roomBgm = new Audio("assets/sounds/bgm/lobby.mp3");
const battleBgm = new Audio("assets/sounds/bgm/bgm.mp3");

const soundSources = {
  move: "assets/sounds/ninja/normalmove.ogg",
  runOver: "assets/sounds/ninja/run_over/3.ogg",
  respawn: "assets/sounds/ninja/respawn_tips_1.ogg",
  weaponDamaged: "assets/sounds/ninja/weapon_damaged.ogg",
  death: "assets/sounds/ninja/death/1.ogg",
  slash1: "assets/sounds/weapon/1.ogg",
  slash3: "assets/sounds/weapon/3.ogg",
  slash4: "assets/sounds/weapon/4.ogg",
  slash6: "assets/sounds/weapon/6.ogg",
  useNinju: "assets/sounds/ninja/useninju.ogg",
  takeDart: "assets/sounds/ninja/takedart.ogg",
  shootDart: "assets/sounds/ninja/shootdart.ogg",
  statusEnergyUp1: "assets/sounds/ninja/status/energy_up_1.ogg",
  statusEnergyUp2: "assets/sounds/ninja/status/energy_up_2.ogg",
  regenHpSmall: "assets/sounds/ninja/status/regen_hp_s.ogg",
  regenHpLarge: "assets/sounds/ninja/status/regen_hp_l.ogg",
  summonSmall: "assets/sounds/ninja/status/summon/summon_small.ogg",
  smallThunder: "assets/sounds/ninja/status/damaged/small_thunder.ogg",
  smallFire: "assets/sounds/ninja/status/damaged/small_fire.ogg",
  smallIceHit: "assets/sounds/ninja/status/damaged/small_ice_hit.ogg",
  gameStarted: "assets/sounds/in_game/game_started.ogg",
  soulLevelUp: "assets/sounds/in_game/soul/1.ogg",
  soulMax: "assets/sounds/in_game/soul/3.ogg",
  win: "assets/sounds/in_game/game_end/win.ogg",
  lose: "assets/sounds/in_game/game_end/lose.ogg",
  breakDefault: "assets/sounds/break_item/1.ogg",
  breakVase: "assets/sounds/break_item/2.ogg",
  breakChest: "assets/sounds/break_item/3.ogg",
};

const images = {};
const mapFolder = "assets/map/map/\u68EE\u679710";
const sounds = Object.fromEntries(Object.entries(soundSources).map(([key, src]) => {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.volume = 0.8;
  return [key, audio];
}));
[roomBgm, battleBgm].forEach((audio) => {
  audio.preload = "auto";
  audio.loop = true;
  audio.volume = 0.45;
});

const imageSources = {
  bg: `${mapFolder}/bg.png`,
  arena: `${mapFolder}/arena-base.png`,
  blueDown: "assets/characters/idle/blue/down.png",
  blueLeft: "assets/characters/idle/blue/left.png",
  blueRight: "assets/characters/idle/blue/right.png",
  blueUp: "assets/characters/idle/blue/up.png",
  greyDown: "assets/characters/idle/grey/down.png",
  greyLeft: "assets/characters/idle/grey/left.png",
  greyRight: "assets/characters/idle/grey/right.png",
  greyUp: "assets/characters/idle/grey/up.png",
  tree: `${mapFolder}/tree.png`,
  hay: `${mapFolder}/hay.png`,
  vase: `${mapFolder}/vase.png`,
  barrel: `${mapFolder}/barrel.png`,
  chest: `${mapFolder}/chest.png`,
  flower: `${mapFolder}/flower.png`,
  rock: `${mapFolder}/rock.png`,
  stump: `${mapFolder}/stump.png`,
  flashButton: "assets/ninju/buttons/1.png",
  steelButton: "assets/ninju/buttons/2.png",
  moneyDartButton: "assets/ninju/buttons/3.png",
  healButton: "assets/ninju/buttons/4.png",
  moneyDartProjectile: "assets/images/ninja/dart/10.png",
  blueIcon: "assets/ui/b_icon.png",
  greyIcon: "assets/ui/g_icon.png",
  blueTeam: "assets/ui/b_team.png",
  greyTeam: "assets/ui/g_team.png",
  soulHud1: "assets/ui/soul/1.png",
  soulHud2: "assets/ui/soul/2.png",
  soulHud3: "assets/ui/soul/3.png",
  soulHud4: "assets/ui/soul/4.png",
  soulHud5: "assets/ui/soul/5.png",
  barBackground: "assets/ui/bar/bar_background.png",
  barFrame: "assets/ui/bar/bar.png",
  barLight: "assets/ui/bar/bar_light.png",
  playerOutline: "assets/ui/playerpanel_outline.png",
  playerPointer: "assets/ui/pointer.png",
  nameBar: "assets/room/ui/name_bar.png",
  moneyPanel: "assets/ui/money_panel.png",
  itemButton: "assets/ui/item_button.png",
  ninjutsuBox: "assets/ninju/buttons/ninjutsuBox.png",
  ninjuIcon1: "assets/ninju/consumables/1.png",
  ninjuIcon2: "assets/ninju/consumables/2.png",
  ninjuIcon3: "assets/ninju/consumables/3.png",
  ninjuIcon4: "assets/ninju/consumables/4.png",
  ninjuIcon5: "assets/ninju/consumables/5.png",
  ninjuIcon6: "assets/ninju/consumables/6.png",
  chargeOuter: "assets/characters/charge/outer_moving.png",
  eyesFront: "assets/characters/parts/eyes-middle/11.png",
  eyeSide: "assets/characters/parts/eyes-look-right/11.png",
};

const defUpFrameSources = Array.from({ length: 31 }, (_, index) => `assets/ninju/status/def_up/${index + 1}.png`);
const defUpFrames = [];
const atkUpFrameSources = Array.from({ length: 31 }, (_, index) => `assets/ninju/status/atk_up/${index + 1}.png`);
const atkUpFrames = [];
const regenHpSmallFrameSources = Array.from({ length: 23 }, (_, index) => `assets/ninju/status/regen_hp_s/${String(index + 1).padStart(2, "0")}.png`);
const regenHpSmallFrames = [];
const regenHpLargeFrameSources = Array.from({ length: 24 }, (_, index) => `assets/ninju/status/regen_hp_l/${String(index + 1).padStart(2, "0")}.png`);
const regenHpLargeFrames = [];
const smallThunderSummonFrameSources = Array.from({ length: 25 }, (_, index) => `assets/ninju/status/summon/small_thunder/${index + 1}.png`);
const smallThunderSummonFrames = [];
const smallThunderDamagedFrameSources = Array.from({ length: 36 }, (_, index) => `assets/ninju/status/damaged/small_thunder/${index + 1}.png`);
const smallThunderDamagedFrames = [];
const smallFireSummonFrameSources = Array.from({ length: 23 }, (_, index) => `assets/ninju/status/summon/small_fire/${String(index + 1).padStart(2, "0")}.png`);
const smallFireSummonFrames = [];
const smallFireDamagedFrameSources = Array.from({ length: 43 }, (_, index) => `assets/ninju/status/small_fire/${index + 1}.png`);
const smallFireDamagedFrames = [];
const smallIceSummonFrameSources = Array.from({ length: 23 }, (_, index) => `assets/ninju/status/summon/small_ice/${String(index + 1).padStart(2, "0")}.png`);
const smallIceSummonFrames = [];
const smallIceDamagedFrameSources = Array.from({ length: 40 }, (_, index) => `assets/ninju/status/small_ice/${index + 1}.png`);
const smallIceDamagedFrames = [];
const smallIceBreakFrameSources = Array.from({ length: 2 }, (_, index) => `assets/ninju/status/small_ice/${41 + index}.png`);
const smallIceBreakFrames = [];
const damageFailFrameSources = Array.from({ length: 10 }, (_, index) => `assets/ninju/status/damage_fail/${index + 1}.png`);
const damageFailFrames = [];
const faintedFrameSources = Array.from({ length: 34 }, (_, index) => `assets/ninju/status/fainted/${index + 1}.png`);
const faintedFrames = [];
const damageSuccessSmallFrameSources = Array.from({ length: 10 }, (_, index) => `assets/ninju/status/damage_success/small/Symbol ${3090001 + index}.png`);
const damageSuccessSmallFrames = [];
const damageSuccessMiddleFrameSources = Array.from({ length: 10 }, (_, index) => `assets/ninju/status/damage_success/middle/Symbol ${3090001 + index}.png`);
const damageSuccessMiddleFrames = [];
const attackNinjuConfigs = {
  flash: {
    label: "\u9583\u5149",
    rule: "flashRule",
    summonFrames: smallThunderSummonFrames,
    hitFrames: smallThunderDamagedFrames,
    castSound: "summonSmall",
    hitSound: "smallThunder",
  },
  wildfire: {
    label: "\u91ce\u706b",
    rule: "wildfireRule",
    summonFrames: smallFireSummonFrames,
    hitFrames: smallFireDamagedFrames,
    castSound: "summonSmall",
    hitSound: "smallFire",
    outcomes: [
      { chance: 0.3, damage: 50, headEffect: "flashHitHead" },
      { chance: 0.2, damage: 100, headEffect: "wildfireMiddleHitHead" },
    ],
  },
  freeze: {
    label: "\u6025\u51cd",
    rule: "freezeRule",
    summonFrames: smallIceSummonFrames,
    hitFrames: smallIceDamagedFrames,
    castSound: "summonSmall",
    hitSound: "smallIceHit",
    holdHitLastFrame: true,
    breakEffect: "freezeBreak",
    hitBodyEffect: null,
    outcomes: [
      { chance: 0.35, damage: 50, headEffect: "flashHitHead", hitDisableMs: freezeHitDisableMs },
    ],
  },
};
const chargeRedFrameSources = Array.from({ length: 4 }, (_, index) => `assets/characters/charge/inner_fire/${index + 1}.png`);
const chargeYellowFrameSources = Array.from({ length: 4 }, (_, index) => `assets/characters/charge/inner_fire/${index + 5}.png`);
const chargeRedFrames = [];
const chargeYellowFrames = [];
// 回技角色方向素材：b/g × 4 方向 × 2 幀（1=right, 2=left, 3=up, 4=down）
const chargeDirFrameSources = {
  b: {
    right: [1, 2].map((f) => `assets/images/ninja/b_charge/1/${f}.png`),
    left:  [1, 2].map((f) => `assets/images/ninja/b_charge/2/${f}.png`),
    up:    [1, 2].map((f) => `assets/images/ninja/b_charge/3/${f}.png`),
    down:  [1, 2].map((f) => `assets/images/ninja/b_charge/4/${f}.png`),
  },
  g: {
    right: [1, 2].map((f) => `assets/images/ninja/g_charge/1/${f}.png`),
    left:  [1, 2].map((f) => `assets/images/ninja/g_charge/2/${f}.png`),
    up:    [1, 2].map((f) => `assets/images/ninja/g_charge/3/${f}.png`),
    down:  [1, 2].map((f) => `assets/images/ninja/g_charge/4/${f}.png`),
  },
};
const chargeDirFrames = {
  b: { right: [], left: [], up: [], down: [] },
  g: { right: [], left: [], up: [], down: [] },
};
const respawnPointerFrameSources = Array.from({ length: 32 }, (_, index) => `assets/characters/pointers/respawn/${index + 1}.png`);
const respawnPointerFrames = [];
const dragArrowFrameSources = {
  right: Array.from({ length: 6 }, (_, index) => `assets/characters/pointers/drag-arrow/right/${index + 1}.png`),
  left: Array.from({ length: 6 }, (_, index) => `assets/characters/pointers/drag-arrow/left/${index + 1}.png`),
  up: Array.from({ length: 6 }, (_, index) => `assets/characters/pointers/drag-arrow/up/${index + 1}.png`),
  down: Array.from({ length: 6 }, (_, index) => `assets/characters/pointers/drag-arrow/down/${index + 1}.png`),
};
const dragArrowFrames = { right: [], left: [], up: [], down: [] };

const moveDirections = ["right", "left", "up", "down"];
const movePrearriveFrameSources = {
  blue: Object.fromEntries(moveDirections.map((direction) => [
    direction,
    Array.from({ length: 2 }, (_, index) => `assets/characters/move/blue/prearrive/${direction}/${index + 1}.png`),
  ])),
  grey: Object.fromEntries(moveDirections.map((direction) => [
    direction,
    Array.from({ length: 2 }, (_, index) => `assets/characters/move/grey/prearrive/${direction}/${index + 1}.png`),
  ])),
};
const moveArriveFrameSources = {
  blue: Object.fromEntries(moveDirections.map((direction) => [
    direction,
    Array.from({ length: 5 }, (_, index) => `assets/characters/move/blue/arrive/${direction}/${index + 1}.png`),
  ])),
  grey: Object.fromEntries(moveDirections.map((direction) => [
    direction,
    Array.from({ length: 5 }, (_, index) => `assets/characters/move/grey/arrive/${direction}/${index + 1}.png`),
  ])),
};
const movePrearriveFrames = {
  blue: { right: [], left: [], up: [], down: [] },
  grey: { right: [], left: [], up: [], down: [] },
};
const moveArriveFrames = {
  blue: { right: [], left: [], up: [], down: [] },
  grey: { right: [], left: [], up: [], down: [] },
};
const useNinjuFrameSources = {
  blue: Array.from({ length: 12 }, (_, index) => `assets/characters/use-ninju/blue/${index + 1}.png`),
  grey: Array.from({ length: 12 }, (_, index) => `assets/characters/use-ninju/grey/${index + 1}.png`),
};
const useNinjuFrames = { blue: [], grey: [] };

// 錢鏢備彈靜態幀（b/g_dart，4 幀對應 right/left/up/down）。
const moneyDartReadyFrameSources = {
  b: Array.from({ length: 4 }, (_, i) => `assets/images/ninja/b_dart/${i + 1}.png`),
  g: Array.from({ length: 4 }, (_, i) => `assets/images/ninja/g_dart/${i + 1}.png`),
};
const moneyDartReadyFrames = { b: [], g: [] };

// 拿標起身動畫：dart 由小到完整的出現動畫（10 幀，與隊伍無關）。
const moneyDartPickupFrameSources = Array.from({ length: 10 }, (_, i) => `assets/images/ninja/dart/${i + 1}.png`);
const moneyDartPickupFrames = [];
// 射鏢動畫，依隊伍與方向各 7 幀，按檔案順序播放。
const moneyDartShootFrameSources = {
  b: {
    right: Array.from({ length: 7 }, (_, i) => `assets/images/ninja/b_dart_shoot/1/${i + 1}.png`),
    left:  Array.from({ length: 7 }, (_, i) => `assets/images/ninja/b_dart_shoot/2/${i + 1}.png`),
    up:    Array.from({ length: 7 }, (_, i) => `assets/images/ninja/b_dart_shoot/3/${i + 1}.png`),
    down:  Array.from({ length: 7 }, (_, i) => `assets/images/ninja/b_dart_shoot/4/${i + 1}.png`),
  },
  g: {
    right: Array.from({ length: 7 }, (_, i) => `assets/images/ninja/g_dart_shoot/1/${i + 1}.png`),
    left:  Array.from({ length: 7 }, (_, i) => `assets/images/ninja/g_dart_shoot/2/${i + 1}.png`),
    up:    Array.from({ length: 7 }, (_, i) => `assets/images/ninja/g_dart_shoot/3/${i + 1}.png`),
    down:  Array.from({ length: 7 }, (_, i) => `assets/images/ninja/g_dart_shoot/4/${i + 1}.png`),
  },
};
const moneyDartShootFrames = {
  b: { right: [], left: [], up: [], down: [] },
  g: { right: [], left: [], up: [], down: [] },
};
