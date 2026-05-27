// ===== Match Flow =====
function checkVictory() {
  if (state.result) return;
  const blueLeft = state.units.some((u) => u.team === "blue" && (u.alive || u.respawning));
  const greyLeft = state.units.some((u) => u.team === "grey" && (u.alive || u.respawning));
  if (!blueLeft) {
    finishMatch("grey");
  } else if (!greyLeft) {
    finishMatch("blue");
  }
}

function finishMatch(winner) {
  const now = performance.now();
  state.gameOver = true;
  state.matchEnd = now;
  state.result = {
    winner,
    durationMs: Math.max(0, now - (state.matchStart || state.countdownStart || now)),
  };
  state.resultClickableAt = now + 2000;
  clearDragState();
  syncBgm();
  if (!state.endSoundPlayed) {
    state.endSoundInstance = playSound(winner === "blue" ? "win" : "lose");
    state.endSoundPlayed = true;
  }
  setMessage(winner === "blue" ? "Victory." : "Defeat.");
}
