// Shared gameplay constants. Keep this file data-only so it can move to Phaser later.
const grid = {
  cols: 22,
  rows: 12,
  cell: 44.5, // 地圖整體縮放：數字變大會等比例放大背景格、物件、角色位置。
  left: -9, // 地圖整體 X 位置：數字變大往右；放大後可用負數讓左右平均裁切。
  top: 5, // 地圖整體 Y 位置：數字變大往下；目前讓上排樹貼近上緣。
};
const battleMapDrawInset = {
  left: 5, // 地圖背景左邊界：數字越小越往左。
  top: 5, // 地圖背景上邊界：數字越小越往上，讓上方 HUD 蓋在地圖物件上。
  right: 5, // 地圖背景右邊界：數字越小越往右。
  bottom: 5, // 地圖背景下邊界：數字越小越往下。
};
const maxSkill = 18; // 18
const holdSeconds = 0;
const chargePerSecond = 18 / 6.5;
const maxHp = 300;
const weaponDamage = 50;
const collisionDamage = 40;
const weaponCooldownMs = 1000;
const objectHp = 100;
const respawnMs = 3000;
const respawnPointerDuration = 1000;
const playerUnitId = 1;
const unitsPerTeam = 3;
const aiSkillRegenPerSecond = 0.42;
const soulStepsPerLevel = 27;
const soulMaxLevel = 4;
const soulCombatGainSteps = soulStepsPerLevel / 5;
const soulDeathGainSteps = soulStepsPerLevel;
const flashHitChance = 0.6;
const flashDamage = 50;
const flashMissDisableMs = 1500;
const flashHitDisableMs = 3500;
const freezeHitDisableMs = 6000;

const steelNinjuCost = 7;
const steelCastDuration = 1500;
const steelNinjuDuration = 12000;
const genkiHealAmount = 100;
const kakkiHealAmount = 200;
const shinkiHealAmount = 9999;
const ninjuChainGap = 500;
const ninjuChainMaxGap = 500;
const ninjuFollowupMoveAllowance = 2;
const steelDefenseMultiplier = 1.7;

const moneyDartButtonRect = { x: 508, y: 600, w: 65, h: 30 };
const steelButtonRect = { x: 582, y: 600, w: 65, h: 30 };
const hotBloodButtonRect = { x: 656, y: 600, w: 65, h: 30 };
const genkiButtonRect = { x: 730, y: 600, w: 65, h: 30 };
const kakkiButtonRect = { x: 804, y: 600, w: 65, h: 30 };
const shinkiButtonRect = { x: 878, y: 600, w: 65, h: 30 };
const flashNinjuCost = 7;
const flashCastDuration = 1500;

const moneyDartReadyMs = 250;
const moneyDartPostThrowNinjuLockMs = 250;
const moneyDartDamage = 70;
const moneyDartSpeed = 1500;
const countdownTotalMs = 2500;

const ui = {
  top: 0,
  bottomTop: 542,
  bottomHeight: 138,
  leftPanelW: 446,
  midX: 446,
};

const startingAreas = {
  // Internal grid coordinates. Display coordinates are converted elsewhere.
  blue: { xMin: 2, xMax: 3, yMin: 3, yMax: 7 },
  grey: { xMin: 16, xMax: 17, yMin: 3, yMax: 7 },
};

