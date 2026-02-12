// ====== Config ======
const MAX_GUESSES = 8;

// Weight class ordering (small -> big). Adjust if you want Women's-specific logic later.
const WEIGHT_ORDER = [
  "Strawweight",
  "Flyweight",
  "Bantamweight",
  "Featherweight",
  "Lightweight",
  "Welterweight",
  "Middleweight",
  "Light Heavyweight",
  "Heavyweight"
];

// ====== DOM ======
const guessInput = document.getElementById("guessInput");
const fighterList = document.getElementById("fighterList");
const guessBtn = document.getElementById("guessBtn");
const resetBtn = document.getElementById("resetBtn");
const shareBtn = document.getElementById("shareBtn");
const rowsEl = document.getElementById("rows");
const statusEl = document.getElementById("status");

// ====== State ======
let fighters = [];
let secret = null;

const todayKey = () => {
  // local date (simple). If you want strict timezone control later, we can lock to America/Denver.
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `fightguess_${yyyy}-${mm}-${dd}`;
};

const loadSave = () => {
  try {
    return JSON.parse(localStorage.getItem(todayKey())) || { guesses: [], done: false, win: false };
  } catch {
    return { guesses: [], done: false, win: false };
  }
};

const saveState = (s) => localStorage.setItem(todayKey(), JSON.stringify(s));

// ====== Helpers ======
function hashStringToInt(str) {
  // small deterministic hash
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

function pickDailySecret(list) {
  const key = todayKey(); // includes date
  const idx = hashStringToInt(key) % list.length;
  return list[idx];
}

function calcAge(dobISO) {
  const dob = new Date(dobISO);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

function compareNumber(guessVal, secretVal) {
  if (guessVal === secretVal) return { symbol: "✓", cls: "ok" };
  // If your guess is LOWER than secret, tell player to go UP
  if (guessVal < secretVal) return { symbol: "↑", cls: "up" };
  return { symbol: "↓", cls: "down" };
}

function compareWeight(guessClass, secretClass) {
  const g = WEIGHT_ORDER.indexOf(guessClass);
  const s = WEIGHT_ORDER.indexOf(secretClass);
  if (g === -1 || s === -1) {
    // Unknown values => just do equality check
    return guessClass === secretClass ? { symbol: "✓", cls: "ok" } : { symbol: "✗", cls: "no" };
  }
  if (g === s) return { symbol: "✓", cls: "ok" };
  if (g < s) return { symbol: "↑", cls: "up" };   // your guess is lighter -> go up
  return { symbol: "↓", cls: "down" };            // your guess is heavier -> go down
}

function compareYesNo(guessVal, secretVal) {
  return guessVal === secretVal ? { symbol: "✓", cls: "ok" } : { symbol: "✗", cls: "no" };
}

function findFighterByName(name) {
  const n = name.trim().toLowerCase();
  return fighters.find(f => f.name.toLowerCase() === n) || null;
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

function clearInput() {
  guessInput.value = "";
  guessInput.focus();
}

// ====== Rendering ======
function badge({ symbol, cls }, extraText = "") {
  return `<span class="badge ${cls}" title="${extraText}">${symbol}</span>`;
}

function renderRow(guessFighter) {
  const secretAge = calcAge(secret.dob);
  const guessAge = calcAge(guessFighter.dob);

  const ageCmp = compareNumber(guessAge, secretAge);
  const wtCmp = compareWeight(guessFighter.weightClass, secret.weightClass);
  const genderCmp = compareYesNo(guessFighter.gender, secret.gender);
  const champCmp = compareYesNo(guessFighter.everChampion, secret.everChampion);
  const countryCmp = compareYesNo(guessFighter.birthCountry, secret.birthCountry);

  const row = document.createElement("div");
  row.className = "trow";

  row.innerHTML = `
    <div class="tcell name">${guessFighter.name}</div>
    <div class="tcell">${badge(ageCmp, `${guessAge} vs ${secretAge}`)} <span class="muted">${guessAge}</span></div>
    <div class="tcell">${badge(wtCmp, `${guessFighter.weightClass} vs ${secret.weightClass}`)} <span class="muted">${guessFighter.weightClass}</span></div>
    <div class="tcell">${badge(genderCmp)} <span class="muted">${guessFighter.gender}</span></div>
    <div class="tcell">${badge(champCmp)} <span class="muted">${guessFighter.everChampion ? "Yes" : "No"}</span></div>
    <div class="tcell">${badge(countryCmp)} <span class="muted">${guessFighter.birthCountry}</span></div>
  `;

  rowsEl.prepend(row);
}

function renderFromSave(save) {
  rowsEl.innerHTML = "";
  for (const id of save.guesses) {
    const f = fighters.find(x => x.id === id);
    if (f) renderRow(f);
  }

  if (save.done) {
    guessBtn.disabled = true;
    setStatus(save.win ? `You got it in ${save.guesses.length}!` : `Out of guesses. The answer was: ${secret.name}`);
  } else {
    guessBtn.disabled = false;
    setStatus(`Guesses: ${save.guesses.length}/${MAX_GUESSES}`);
  }
}

// ====== Game Logic ======
function makeGuess() {
  const save = loadSave();
  if (save.done) return;

  const guessName = guessInput.value;
  const fighter = findFighterByName(guessName);

  if (!fighter) {
    setStatus("Pick a name from the list (no creative spelling today).");
    return;
  }

  if (save.guesses.includes(fighter.id)) {
    setStatus("You already guessed that fighter. Try someone else.");
    clearInput();
    return;
  }

  save.guesses.push(fighter.id);
  renderRow(fighter);

  const isWin = fighter.id === secret.id;
  if (isWin) {
    save.done = true;
    save.win = true;
    guessBtn.disabled = true;
    setStatus(`You got it in ${save.guesses.length}!`);
  } else if (save.guesses.length >= MAX_GUESSES) {
    save.done = true;
    save.win = false;
    guessBtn.disabled = true;
    setStatus(`Out of guesses. The answer was: ${secret.name}`);
  } else {
    setStatus(`Guesses: ${save.guesses.length}/${MAX_GUESSES}`);
  }

  saveState(save);
  clearInput();
}

function resetToday() {
  localStorage.removeItem(todayKey());
  rowsEl.innerHTML = "";
  guessBtn.disabled = false;
  setStatus(`Reset. Guesses: 0/${MAX_GUESSES}`);
  clearInput();
}

function shareText() {
  const save = loadSave();
  const dateLabel = todayKey().replace("fightguess_", "");
  const header = `Fight Guess ${dateLabel} — ${save.win ? save.guesses.length : "X"}/${MAX_GUESSES}`;

  // Simple emoji map per cell result, based on current rendered rows (fast + easy).
  // If you want exact logic-based share output, we can compute it from guesses + secret.
  const cells = Array.from(document.querySelectorAll(".badge")).map(b => b.textContent.trim());
  const map = { "✓": "🟩", "✗": "🟥", "↑": "🟨", "↓": "🟦" };

  // Each guess row has 5 badges (Age, Weight, Gender, Champion, Country)
  const lines = [];
  for (let i = 0; i < cells.length; i += 5) {
    const slice = cells.slice(i, i + 5).map(s => map[s] || "⬜").join("");
    lines.push(slice);
  }

  return [header, ...lines].join("\n");
}

// ====== Init ======
async function init() {
  setStatus("Loading fighters…");

  const res = await fetch("data/fighters.json");
  fighters = await res.json();

  // Fill datalist
  fighterList.innerHTML = "";
  fighters
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(f => {
      const opt = document.createElement("option");
      opt.value = f.name;
      fighterList.appendChild(opt);
    });

  secret = pickDailySecret(fighters);

  const save = loadSave();
  renderFromSave(save);

  setStatus(save.done
    ? (save.win ? `You got it in ${save.guesses.length}!` : `Out of guesses. The answer was: ${secret.name}`)
    : `Guesses: ${save.guesses.length}/${MAX_GUESSES}`
  );
}

guessBtn.addEventListener("click", makeGuess);
guessInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") makeGuess();
});
resetBtn.addEventListener("click", resetToday);
shareBtn.addEventListener("click", async () => {
  const text = shareText();
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Share text copied to clipboard.");
  } catch {
    // fallback
    prompt("Copy this:", text);
  }
});

init();
