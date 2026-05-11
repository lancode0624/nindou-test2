// Shared gameplay constants. Keep this file data-only so it can move to Phaser later.
const grid = { cols: 22, rows: 12, cell: 40, left: 40, top: 42 };
const maxSkill = 18; //18
const holdSeconds = 0;
const chargePerSecond = 1.45;
const maxHp = 300;
const weaponDamage = 50;
const weaponCooldownMs = 1000;
const objectHp = 100;
const respawnMs = 3000;
const respawnPointerDuration = 1000;
const playerUnitId = 1;
const unitsPerTeam = 3;
const aiSkillRegenPerSecond = 0.42;

const steelNinjuCost = 7; 
const steelCastDuration = 1500;
const steelNinjuDuration = 12000;
const ninjuChainGap = 500;
const ninjuChainMaxGap = 500;
const ninjuFollowupMoveAllowance = 2;
const steelDefenseMultiplier = 1.7;

// 忍術按鈕位置/大小：x,y 控位置；w,h 控尺寸。
const moneyDartButtonRect = { x: 508, y: 600, w: 65, h: 30 }; // 錢鏢按鈕
const steelButtonRect = { x: 582, y: 600, w: 65, h: 30 }; // 鋼鐵按鈕
const hotBloodButtonRect = { x: 656, y: 600, w: 65, h: 30 }; // 熱血按鈕
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
