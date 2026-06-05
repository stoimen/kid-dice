const pipMap = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

const diceField = document.querySelector("#diceField");
const resultLine = document.querySelector("#resultLine");
const historyList = document.querySelector("#history");
const battleScore = document.querySelector("#battleScore");
const soundToggle = document.querySelector("#soundToggle");

const state = {
  mode: localStorage.getItem("kid-dice-mode") || "quick",
  muted: localStorage.getItem("kid-dice-muted") === "true",
  history: readHistory(),
};

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem("kid-dice-history") || "[]");
  } catch {
    return [];
  }
}

function randomInt(sides) {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] % sides) + 1;
}

function roll(count, sides = 6) {
  return Array.from({ length: count }, () => randomInt(sides));
}

function setMode(mode) {
  state.mode = mode;
  localStorage.setItem("kid-dice-mode", mode);

  document.querySelectorAll(".mode-tab").forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  document.querySelectorAll(".mode-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${mode}Panel`);
  });
}

function renderDice(values, sides = 6, groups = []) {
  diceField.innerHTML = "";
  values.forEach((value, index) => {
    const die = document.createElement("div");
    const group = groups[index];
    die.className = sides === 6 ? "die rolling" : "die number-die rolling";
    die.style.setProperty("--tilt", `${[-7, 5, -3, 8, -5][index % 5]}deg`);
    die.style.setProperty("--pip", group === "defense" ? "var(--blue)" : group === "attack" ? "var(--coral)" : "var(--teal-dark)");
    die.setAttribute("aria-label", `Rolled ${value}`);

    if (sides === 6) {
      for (let i = 1; i <= 9; i += 1) {
        const pip = document.createElement("span");
        pip.className = "pip";
        pip.hidden = !pipMap[value].includes(i);
        die.appendChild(pip);
      }
    } else {
      die.textContent = value;
    }

    diceField.appendChild(die);
  });
}

function addHistory(title, detail) {
  state.history.unshift({ title, detail, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
  state.history = state.history.slice(0, 8);
  localStorage.setItem("kid-dice-history", JSON.stringify(state.history));
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";
  state.history.forEach((item) => {
    const row = document.createElement("li");
    row.innerHTML = `<span><b>${item.title}</b> ${item.detail}</span><time>${item.time}</time>`;
    historyList.appendChild(row);
  });
}

function playClick() {
  if (state.muted) return;
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) return;
  const context = new AudioEngine();
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.frequency.value = 180;
  gain.gain.setValueAtTime(0.04, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start();
  osc.stop(context.currentTime + 0.08);
}

function handleQuick(count) {
  const values = roll(count);
  const total = values.reduce((sum, value) => sum + value, 0);
  renderDice(values);
  resultLine.textContent = count === 1 ? `Rolled ${values[0]}` : `Total ${total}`;
  battleScore.textContent = "";
  addHistory(`${count}d6`, values.join(" + ") + (count > 1 ? ` = ${total}` : ""));
  playClick();
}

function handleBattle() {
  const attackCount = Number(document.querySelector("#attackDice").value);
  const defenseCount = Number(document.querySelector("#defenseDice").value);
  const attack = roll(attackCount).sort((a, b) => b - a);
  const defense = roll(defenseCount).sort((a, b) => b - a);
  const pairs = Math.min(attack.length, defense.length);
  let attackerLosses = 0;
  let defenderLosses = 0;

  for (let i = 0; i < pairs; i += 1) {
    if (attack[i] > defense[i]) defenderLosses += 1;
    else attackerLosses += 1;
  }

  renderDice([...attack, ...defense], 6, [...Array(attack.length).fill("attack"), ...Array(defense.length).fill("defense")]);
  resultLine.textContent = `Attack ${attack.join(", ")} · Defend ${defense.join(", ")}`;
  battleScore.textContent = `Attacker loses ${attackerLosses}; defender loses ${defenderLosses}`;
  addHistory(`${attackCount}v${defenseCount}`, `A ${attack.join(", ")} / D ${defense.join(", ")} · -${attackerLosses} / -${defenderLosses}`);
  playClick();
}

function handleCustom() {
  const count = Math.min(12, Math.max(1, Number(document.querySelector("#customCount").value) || 1));
  const sides = Math.min(100, Math.max(2, Number(document.querySelector("#customSides").value) || 6));
  const values = roll(count, sides);
  const total = values.reduce((sum, value) => sum + value, 0);
  renderDice(values, sides);
  resultLine.textContent = `Total ${total}`;
  battleScore.textContent = "";
  addHistory(`${count}d${sides}`, `${values.join(" + ")} = ${total}`);
  playClick();
}

document.querySelectorAll(".mode-tab").forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});

document.querySelectorAll("[data-roll]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.roll === "quick") handleQuick(Number(button.dataset.count));
    if (button.dataset.roll === "battle") handleBattle();
    if (button.dataset.roll === "custom") handleCustom();
  });
});

soundToggle.addEventListener("click", () => {
  state.muted = !state.muted;
  soundToggle.classList.toggle("muted", state.muted);
  soundToggle.setAttribute("aria-label", state.muted ? "Turn sound on" : "Turn sound off");
  localStorage.setItem("kid-dice-muted", String(state.muted));
});

document.querySelector("#clearHistory").addEventListener("click", () => {
  state.history = [];
  localStorage.removeItem("kid-dice-history");
  renderHistory();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
}

setMode(state.mode);
soundToggle.classList.toggle("muted", state.muted);
renderDice([1, 2]);
renderHistory();
