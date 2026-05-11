// Rule-mode profiles for modified and original balance values.
// Future weapon / ninjutsu differences should be configured here.
const modeRuleProfiles = {
  modified: {
    weapons: {
      weapon4: { damage: 40 }, // 伊賀密刀
      weapon6: { damage: 13 }, // 鐵扇不知火
    },
    ninjutsu: {
      steel: {
        cost: 7,
        castDurationMs: 1500,
        durationMs: 12000,
        defenseMultiplier: 1.7,
      },
      hotBlood: {
        cost: 7,
        castDurationMs: 1500,
        durationMs: 12000,
        weaponDamageMultiplier: 2,
      },
      moneyDart: {
        damage: 70,
      },
    },
  },
  original: {
    weapons: {
      weapon4: { damage: 50 }, // 伊賀密刀
      weapon6: { damage: 25 }, // 鐵扇不知火
    },
    ninjutsu: {
      steel: {
        cost: 7,
        castDurationMs: 1500,
        durationMs: 12000,
        defenseMultiplier: 2,
      },
      hotBlood: {
        cost: 7,
        castDurationMs: 1500,
        durationMs: 12000,
        weaponDamageMultiplier: 2,
      },
      moneyDart: {
        damage: 100,
      },
    },
  },
};

function currentRuleModeKey() {
  if (typeof state !== "undefined" && state?.useOriginalMode) return "original";
  return "modified";
}

function currentRuleProfile() {
  return modeRuleProfiles[currentRuleModeKey()] || modeRuleProfiles.modified;
}

function weaponDamageForMode(weaponKey, fallbackDamage) {
  const weaponRule = currentRuleProfile().weapons?.[weaponKey];
  return weaponRule?.damage ?? fallbackDamage;
}

function steelRule() {
  const fallback = {
    cost: steelNinjuCost,
    castDurationMs: steelCastDuration,
    durationMs: steelNinjuDuration,
    defenseMultiplier: steelDefenseMultiplier,
  };
  return { ...fallback, ...(currentRuleProfile().ninjutsu?.steel || {}) };
}

function hotBloodRule() {
  const fallback = {
    cost: steelNinjuCost,
    castDurationMs: steelCastDuration,
    durationMs: steelNinjuDuration,
    weaponDamageMultiplier: 2,
  };
  return { ...fallback, ...(currentRuleProfile().ninjutsu?.hotBlood || {}) };
}

function moneyDartRule() {
  const fallback = { damage: moneyDartDamage };
  return { ...fallback, ...(currentRuleProfile().ninjutsu?.moneyDart || {}) };
}

