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
        cost: 6,
        castDurationMs: 1500,
        durationMs: 12000,
        defenseMultiplier: 1.7,
      },
      hotBlood: {
        cost: 6,
        castDurationMs: 1500,
        durationMs: 12000,
        weaponDamageMultiplier: 2,
      },
      genki: {
        cost: 2,
        castDurationMs: 1500,
        healAmount: 0,
        effect: "steelNoDefense",
      },
      kakki: {
        available: false,
        cost: 6,
        castDurationMs: 1500,
        healAmount: 100,
        effect: "selfHeal",
      },
      shinki: {
        available: false,
        cost: 10,
        castDurationMs: 1500,
        healAmount: 100,
        effect: "teamHeal",
      },
      flash: {
        cost: 7,
        castDurationMs: 1500,
        hitChance: 0.3,
        damage: flashDamage,
        missDisableMs: flashMissDisableMs,
        hitDisableMs: flashHitDisableMs,
      },
      wildfire: {
        cost: 7,
        castDurationMs: 1500,
        hitChance: flashHitChance,
        damage: flashDamage,
        missDisableMs: flashMissDisableMs,
        hitDisableMs: flashHitDisableMs,
      },
      freeze: {
        cost: 7,
        castDurationMs: 1500,
        hitChance: 0.35,
        damage: 50,
        missDisableMs: flashMissDisableMs,
        hitDisableMs: freezeHitDisableMs,
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
      genki: {
        available: false,
        cost: 3,
        castDurationMs: 1500,
        healAmount: 50,
        effect: "selfHeal",
      },
      kakki: {
        available: false,
        cost: 6,
        castDurationMs: 1500,
        healAmount: 100,
        effect: "selfHeal",
      },
      shinki: {
        available: false,
        cost: 10,
        castDurationMs: 1500,
        healAmount: 100,
        effect: "teamHeal",
      },
      flash: {
        cost: 7,
        castDurationMs: 1500,
        hitChance: flashHitChance,
        damage: flashDamage,
        missDisableMs: flashMissDisableMs,
        hitDisableMs: flashHitDisableMs,
      },
      wildfire: {
        cost: 7,
        castDurationMs: 1500,
        hitChance: flashHitChance,
        damage: flashDamage,
        missDisableMs: flashMissDisableMs,
        hitDisableMs: flashHitDisableMs,
      },
      freeze: {
        cost: 7,
        castDurationMs: 1500,
        hitChance: 0.35,
        damage: 50,
        missDisableMs: flashMissDisableMs,
        hitDisableMs: freezeHitDisableMs,
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

function healNinjuRule(type) {
  const fallbackAmounts = {
    genki: genkiHealAmount,
    kakki: kakkiHealAmount,
    shinki: shinkiHealAmount,
  };
  const fallback = {
    cost: 3,
    castDurationMs: steelCastDuration,
    healAmount: type === "genki" ? 50 : (fallbackAmounts[type] ?? genkiHealAmount),
    effect: "selfHeal",
  };
  return { ...fallback, ...(currentRuleProfile().ninjutsu?.[type] || {}) };
}

function moneyDartRule() {
  const fallback = { damage: moneyDartDamage };
  return { ...fallback, ...(currentRuleProfile().ninjutsu?.moneyDart || {}) };
}

function flashRule() {
  return attackNinjuRule("flash");
}

function wildfireRule() {
  return attackNinjuRule("wildfire");
}

function freezeRule() {
  return attackNinjuRule("freeze");
}

function attackNinjuRule(type) {
  const fallback = {
    cost: flashNinjuCost,
    castDurationMs: flashCastDuration,
    hitChance: flashHitChance,
    damage: flashDamage,
    missDisableMs: flashMissDisableMs,
    hitDisableMs: flashHitDisableMs,
  };
  return { ...fallback, ...(currentRuleProfile().ninjutsu?.[type] || {}) };
}
