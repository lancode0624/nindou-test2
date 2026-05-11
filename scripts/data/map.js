// Current arena object placement. Coordinates here use the player-facing grid.
function buildMapObjects() {
  const objects = [];
  const addInternal = (type, x, y, breakable = true, scale = 1.15, hp = objectHp) => {
    objects.push({ type, x, y, hp: breakable ? hp : Infinity, maxHp: breakable ? hp : Infinity, breakable, scale, alive: true });
  };
  const add = (type, displayX, displayY, breakable = true, scale = 1.15, hp = objectHp) => {
    const internal = internalCellCoord({ x: displayX, y: displayY });
    addInternal(type, internal.x, internal.y, breakable, scale, hp);
  };

  for (let x = 1; x <= 18; x++) {
    add("hay", x, 9, true, 1.08);
    add("hay", x, 2, true, 1.08);
  }

  for (let y = 3; y <= 4; y++) {
    add("hay", 1, y, true, 1.08);
    add("hay", 18, y, true, 1.08);
  }
  [[1, 10], [18, 10], [1, 1], [18, 1], [1, 8], [18, 8]].forEach(([x, y]) => add("hay", x, y, true, 1.08));

  [[3, 10], [4, 10], [15, 10], [16, 10], [3, 1], [4, 1], [15, 1], [16, 1]].forEach(([x, y]) => add("barrel", x, y, true, 1.05));
  [[2, 10], [5, 10], [14, 10], [17, 10], [2, 1], [5, 1], [14, 1], [17, 1], [1, 7], [1, 6], [1, 5], [18, 7], [18, 6], [18, 5]].forEach(([x, y]) => add("vase", x, y, true, 1.05));
  [[9, 10], [10, 10], [9, 1], [10, 1]].forEach(([x, y]) => add("stump", x, y, true, 1.04, 200));
  [[9, 6], [10, 5]].forEach(([x, y]) => add("chest", x, y, true, 1.08, 200));
  [[10, 6], [9, 5]].forEach(([x, y]) => add("rock", x, y, false, 1.08));
  [[2, 8], [17, 8]].forEach(([x, y]) => add("flower", x, y, true, 1.04));

  for (let y = 1; y <= 10; y++) {
    add("tree", 0, y, false, 1.08);
    add("tree", 19, y, false, 1.08);
  }
  for (let x = 1; x <= 18; x++) {
    add("tree", x, 11, false, 1.08);
    add("tree", x, 0, false, 1.08);
  }
  [[0, 11], [19, 11], [0, 0], [19, 0]].forEach(([x, y]) => add("tree", x, y, false, 1.08));

  return objects;
}
