// Asset paths and frame buffers. Loading still happens in game.js for now.
const roomBgm = new Audio("assets/audio/lobby.mp3");
const battleBgm = new Audio("assets/audio/bgm.mp3");

const soundSources = {
  move: "assets/sfx/ninja/normalmove.ogg",
  runOver: "assets/sfx/ninja/run_over/3.ogg",
  respawn: "assets/sfx/ninja/respawn_tips_1.ogg",
  weaponDamaged: "assets/sfx/ninja/weapon_damaged.ogg",
  death: "assets/sfx/ninja/death/1.ogg",
  slash: "assets/sfx/weapon/1.ogg",
  useNinju: "assets/sfx/ninja/useninju.ogg",
  takeDart: "assets/sfx/ninja/takedart.ogg",
  shootDart: "assets/sfx/ninja/shootdart.ogg",
  statusEnergyUp1: "assets/sfx/ninja/status/energy_up_1.ogg",
  statusEnergyUp2: "assets/sfx/ninja/status/energy_up_2.ogg",
  gameStarted: "assets/sfx/in_game/game_started.ogg",
  win: "assets/sfx/in_game/game_end/win.ogg",
  lose: "assets/sfx/in_game/game_end/lose1.ogg",
  breakDefault: "assets/sfx/break_item/1.ogg",
  breakVase: "assets/sfx/break_item/2.ogg",
  breakChest: "assets/sfx/break_item/3.ogg",
};

const images = {};
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
  bg: "assets/map/bg.png",
  arena: "assets/map/arena-base.png",
  blueDown: "assets/ninja-blue/idleDown.png",
  blueLeft: "assets/ninja-blue/idleLeft.png",
  blueRight: "assets/ninja-blue/idleRight.png",
  blueUp: "assets/ninja-blue/idleUp.png",
  greyDown: "assets/ninja-grey/idleDown.png",
  greyLeft: "assets/ninja-grey/idleLeft.png",
  greyRight: "assets/ninja-grey/idleRight.png",
  greyUp: "assets/ninja-grey/idleUp.png",
  tree: "assets/map-objects/tree.png",
  hay: "assets/map-objects/hay.png",
  vase: "assets/map-objects/vase.png",
  barrel: "assets/map-objects/barrel.png",
  chest: "assets/map-objects/chest.png",
  flower: "assets/map-objects/flower.png",
  rock: "assets/map-objects/rock.png",
  stump: "assets/map-objects/stump.png",
  steelButton: "assets/ninju/buttons/2.png",
  moneyDartButton: "assets/ninju/money_mark/button_base/3.png",
  moneyDartHold: "assets/ninju/money_mark/projectile_candidates/images_weapon_93/taking.png",
  moneyDartDown: "assets/ninju/money_mark/projectile_candidates/images_weapon_93/goldpanD.png",
  moneyDartLeft: "assets/ninju/money_mark/projectile_candidates/images_weapon_93/goldpanL.png",
  moneyDartRight: "assets/ninju/money_mark/projectile_candidates/images_weapon_93/goldpanR.png",
  moneyDartUp: "assets/ninju/money_mark/projectile_candidates/images_weapon_93/goldpanU.png",
  blueIcon: "assets/ui/b_icon.png",
  greyIcon: "assets/ui/g_icon.png",
  blueTeam: "assets/ui/b_team.png",
  greyTeam: "assets/ui/g_team.png",
  barBackground: "assets/ui/bar/bar_background.png",
  barFrame: "assets/ui/bar/bar.png",
  barLight: "assets/ui/bar/bar_light.png",
  playerOutline: "assets/ui/playerpanel_outline.png",
  moneyPanel: "assets/ui/money_panel.png",
  itemButton: "assets/ui/item_button.png",
  ninjutsuBox: "assets/ninju/buttons/ninjutsuBox.png",
  ninjuIcon1: "assets/ninju/consumables/1.png",
  ninjuIcon2: "assets/ninju/consumables/2.png",
  ninjuIcon3: "assets/ninju/consumables/3.png",
  ninjuIcon4: "assets/ninju/consumables/4.png",
  ninjuIcon5: "assets/ninju/consumables/5.png",
  ninjuIcon6: "assets/ninju/consumables/6.png",
  chargeOuter: "assets/charge-effect-candidates/matched-charge-ring/final-candidate/outer_moving.png",
  eyesFront: "assets/ninja-composite-parts/eyes-middle/11.png",
  eyeSide: "assets/ninja-composite-parts/eyes-look-right/11.png",
};

const defUpFrameSources = Array.from({ length: 31 }, (_, index) => `assets/ninju/status/def_up/${index + 1}.png`);
const defUpFrames = [];
const atkUpFrameSources = Array.from({ length: 31 }, (_, index) => `assets/ninju/status/atk_up/${index + 1}.png`);
const atkUpFrames = [];
const chargeRedFrameSources = Array.from({ length: 4 }, (_, index) => `assets/charge-effect-candidates/matched-charge-ring/final-candidate/inner_fire/${index + 1}.png`);
const chargeYellowFrameSources = Array.from({ length: 4 }, (_, index) => `assets/charge-effect-candidates/matched-charge-ring/final-candidate/inner_fire/${index + 5}.png`);
const chargeRedFrames = [];
const chargeYellowFrames = [];
const respawnPointerFrameSources = Array.from({ length: 32 }, (_, index) => `assets/respawn-pointer-candidates/ninja_back_pointer/${index + 1}.png`);
const respawnPointerFrames = [];
const dragArrowFrameSources = {
  right: Array.from({ length: 6 }, (_, index) => `assets/respawn-pointer-candidates/ninja_arrow_0/${index + 1}.png`),
  left: Array.from({ length: 6 }, (_, index) => `assets/respawn-pointer-candidates/ninja_arrow_1/${index + 1}.png`),
  up: Array.from({ length: 6 }, (_, index) => `assets/respawn-pointer-candidates/ninja_arrow_2/${index + 1}.png`),
  down: Array.from({ length: 6 }, (_, index) => `assets/respawn-pointer-candidates/ninja_arrow_3/${index + 1}.png`),
};
const dragArrowFrames = { right: [], left: [], up: [], down: [] };

const moneyDartReadyFrameSources = Array.from({ length: 10 }, (_, index) => `assets/ninju/money_mark/projectile_candidates/images_ninja_dart/${index + 1}.png`);
const moneyDartReadyFrames = [];
const moneyDartShootFrameSources = {
  right: Array.from({ length: 7 }, (_, index) => `assets/ninju/money_mark/shoot_dart_exact/b_shoot_dart_0/${String(index + 1).padStart(2, "0")}_${index + 1}.png`),
  left: Array.from({ length: 7 }, (_, index) => `assets/ninju/money_mark/shoot_dart_exact/b_shoot_dart_1/${String(index + 1).padStart(2, "0")}_${index + 1}.png`),
  down: Array.from({ length: 7 }, (_, index) => `assets/ninju/money_mark/shoot_dart_exact/b_shoot_dart_3/${String(index + 1).padStart(2, "0")}_${index + 1}.png`),
  up: Array.from({ length: 7 }, (_, index) => `assets/ninju/money_mark/shoot_dart_exact/b_shoot_dart_2/${String(index + 1).padStart(2, "0")}_${index + 1}.png`),
};
const moneyDartShootFrames = { right: [], left: [], down: [], up: [] };
