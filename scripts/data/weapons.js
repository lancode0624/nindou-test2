// Weapon data is kept declarative so new weapons can be added without changing combat code.
const defaultWeaponKey = "weapon1";
const weaponDefinitions = [
  { key: "weapon1", label: "苦無", folder: "1苦無", frameCount: 12, cooldownMs: 500, area: "single", damage: 50 },
  { key: "weapon3", label: "忍太刀", folder: "3忍太刀", frameCount: 24, cooldownMs: 1000, area: "nodachi", damage: 50 },
  { key: "weapon4", label: "伊賀密刀", folder: "4伊賀密刀", frameCount: 13, cooldownMs: 500, area: "line2", damage: 50 },
  { key: "weapon6", label: "鐵扇不知火", folder: "6鐵扇不知火", frameCount: 9, cooldownMs: 300, area: "fan", damage: 25 },
];
const weaponDefinitionByKey = Object.fromEntries(weaponDefinitions.map((weapon) => [weapon.key, weapon]));
const weaponFrames = Object.fromEntries(weaponDefinitions.map((weapon) => [
  weapon.key,
  {
    hand: { right: [], left: [], up: [], down: [] },
    attack: { right: [], left: [], up: [], down: [] },
  },
]));
