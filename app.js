/* ===== Golfpott — app.js ===== */
"use strict";

// ---- State ----
const STORAGE_KEY = "golfpott_data_v2";

const defaultTemplates = [
  { id: "tpl-1", name: "1 Pristagare", type: "percentage", values: [100], sebastianPot: 0 },
  { id: "tpl-2", name: "2 Pristagare", type: "percentage", values: [65, 35], sebastianPot: 0 },
  { id: "tpl-3", name: "3 Pristagare", type: "percentage", values: [50, 30, 20], sebastianPot: 0 },
  { id: "tpl-4", name: "4 Pristagare", type: "percentage", values: [40, 30, 20, 10], sebastianPot: 0 },
  { id: "tpl-5", name: "5 Pristagare", type: "percentage", values: [35, 25, 20, 12, 8], sebastianPot: 0 },
  { id: "tpl-6", name: "6 Pristagare", type: "percentage", values: [30, 25, 18, 12, 8, 7], sebastianPot: 0 },
];

const SEBASTIAN_NAME = "Sebastian-pott";

let state = {
  roundDate: "",
  buyIn: 3,
  players: [],
  templates: [...defaultTemplates.map(t => ({ ...t, values: [...t.values] }))],
  selectedTemplateId: "tpl-2",
  ladiesPrizeEnabled: false,
  ladiesPrizeType: "fixed",
  ladiesPrizeAmount: 5,
  ladiesPrizePercent: 20,
  ladiesMinCount: 1,
  sebastianPot: 0,
  savedNames: [],
};

// ---- DOM refs ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---- Persistence ----
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Kunde inte spara:", e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...state, ...parsed };
      // Ensure templates exist
      if (!state.templates || state.templates.length === 0) {
        state.templates = defaultTemplates.map(t => ({ ...t, values: [...t.values], sebastianPot: t.sebastianPot || 0 }));
      }
      // Migrate old template names ("Antal spelare X" -> "X Pristagare")
      const nameMap = {
        "Antal spelare 2": "2 Pristagare",
        "Antal spelare 3": "3 Pristagare",
        "Antal spelare 4": "4 Pristagare",
        "Antal spelare 5": "5 Pristagare",
        "Antal spelare 6": "6 Pristagare",
      };
      state.templates.forEach(t => {
        if (nameMap[t.name]) t.name = nameMap[t.name];
        if (t.sebastianPot && typeof t.sebastianPot === "object") {
          t.sebastianPot = (t.sebastianPot.enabled && t.sebastianPot.value) ? t.sebastianPot.value : 0;
        }
        if (t.sebastianPot === null || t.sebastianPot === undefined || isNaN(t.sebastianPot)) t.sebastianPot = 0;
      });
      // Ensure "1 Pristagare" template exists
      if (!state.templates.find(t => t.id === "tpl-1")) {
        state.templates.unshift({ id: "tpl-1", name: "1 Pristagare", type: "percentage", values: [100], sebastianPot: 0 });
      }
      // Sync fixed templates to default values (removes extra rows and zero-value rows)
      state.templates.forEach(t => {
        const def = defaultTemplates.find(d => d.id === t.id) || defaultTemplates.find(d => d.name === t.name);
        if (def) {
          t.values = [...def.values];
        }
      });
      // Ensure savedNames exists
      if (!Array.isArray(state.savedNames)) state.savedNames = [];
    }
  } catch (e) {
    console.error("Kunde inte ladda:", e);
  }
}

// ---- Number parsing (handles comma and dot) ----
function parseNum(val) {
  if (val === null || val === undefined) return NaN;
  const s = String(val).trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return NaN;
  return parseFloat(s);
}

function formatEuro(n) {
  if (isNaN(n) || n === null) return "0,00";
  return n.toFixed(2).replace(".", ",");
}

function formatPoints(n) {
  if (isNaN(n) || n === null) return "–";
  return String(n);
}

function formatHcp(n) {
  if (isNaN(n) || n === null) return "–";
  return n.toFixed(1).replace(".", ",");
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = String(s);
  return div.innerHTML;
}

// ---- Player CRUD ----
let editingPlayerId = null;
let lastCategory = "herr";

function addPlayer(name, hcp, points, category) {
  const id = "p" + Date.now() + Math.random().toString(36).slice(2, 6);
  state.players.push({
    id,
    name: name.trim(),
    handicap: hcp,
    points: points,
    category: category,
  });
  addSavedName(name);
  saveState();
  renderAll();
}

function updatePlayer(id, name, hcp, points, category) {
  const p = state.players.find(p => p.id === id);
  if (!p) return;
  p.name = name.trim();
  p.handicap = hcp;
  p.points = points;
  p.category = category;
  addSavedName(name);
  saveState();
  renderAll();
}

function deletePlayer(id) {
  state.players = state.players.filter(p => p.id !== id);
  saveState();
  renderAll();
}

// ---- Saved names (autocomplete history) ----
function addSavedName(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  if (!state.savedNames.includes(trimmed)) {
    state.savedNames.push(trimmed);
    saveState();
  }
}

function removeSavedName(name) {
  state.savedNames = state.savedNames.filter(n => n !== name);
  saveState();
  renderNameSuggestions();
}

function getMatchingNames(query) {
  const q = query.trim().toLowerCase();
  if (!q) return state.savedNames.slice().sort((a, b) => a.localeCompare(b, "sv"));
  return state.savedNames
    .filter(n => n.toLowerCase().includes(q))
    .sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aStarts = aLower.startsWith(q);
      const bStarts = bLower.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b, "sv");
    });
}

function renderNameSuggestions() {
  const container = $("#name-suggestions");
  if (!container) return;
  const input = $("#player-name");
  const query = input ? input.value : "";
  const matches = getMatchingNames(query);

  if (matches.length === 0) {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }

  container.classList.remove("hidden");
  container.innerHTML = matches.map(name => `
    <div class="name-suggestion-item" data-name="${escapeHtml(name)}">
      <span class="name-suggestion-text">${escapeHtml(name)}</span>
      <button type="button" class="name-suggestion-remove" data-remove="${escapeHtml(name)}" aria-label="Ta bort namn">&times;</button>
    </div>
  `).join("");
}

function hideNameSuggestions() {
  const container = $("#name-suggestions");
  if (!container) return;
  container.classList.add("hidden");
  container.innerHTML = "";
}

// ---- Prize calculation ----
function getTemplate() {
  return state.templates.find(t => t.id === state.selectedTemplateId) || state.templates[0];
}

function getWinnerCount() {
  const tpl = getTemplate();
  return Math.min(tpl.values.length, state.players.length);
}

function getPayingPlayerCount() {
  return state.players.length;
}

function getTotalPot() {
  return state.buyIn * getPayingPlayerCount();
}

function calculatePrizes() {
  const tpl = getTemplate();
  const totalPot = getTotalPot();
  const winnerCount = getWinnerCount();
  const sorted = [...state.players].sort((a, b) => {
    const ptsA = a.points || 0;
    const ptsB = b.points || 0;
    if (ptsB !== ptsA) return ptsB - ptsA;
    const hcpA = a.handicap ?? 999;
    const hcpB = b.handicap ?? 999;
    if (hcpA !== hcpB) return hcpA - hcpB;
    return 0;
  });

  const prizes = new Map();
  const ladiesPrizes = new Map();

  // Determine winners (needed for ladies eligibility before pot calculation)
  const winnerIds = new Set();
  for (let i = 0; i < winnerCount && i < sorted.length; i++) {
    winnerIds.add(sorted[i].id);
  }

  // ---- Step 1: Check if ladies prize will actually be assigned ----
  // No ladies prize if any lady already won a main prize
  let ladiesPot = 0;
  if (state.ladiesPrizeEnabled) {
    const ladies = sorted.filter(p => p.category === "dam");
    if (ladies.length >= state.ladiesMinCount) {
      const ladiesWithMainPrize = ladies.filter(p => winnerIds.has(p.id));
      const eligibleLadies = ladies.filter(p => !winnerIds.has(p.id));
      if (ladiesWithMainPrize.length === 0 && eligibleLadies.length > 0) {
        if (state.ladiesPrizeType === "fixed") {
          ladiesPot = Math.min(state.ladiesPrizeAmount, totalPot);
        } else {
          ladiesPot = (totalPot * state.ladiesPrizePercent) / 100;
        }
      }
    }
  }

  // ---- Step 2: Sebastian-pott (manual amount, capped to remaining after ladies) ----
  const sebastianManual = Math.max(0, Math.min(
    state.sebastianPot > 0 ? state.sebastianPot : 0,
    totalPot - ladiesPot
  ));

  // ---- Step 3: Pot for actual prize distribution ----
  const potForPrizes = Math.max(0, totalPot - ladiesPot - sebastianManual);

  // ---- Step 4: Calculate main prizes (percentage only) ----
  // When fewer winners than template slots, renormalize percentages to sum to 100%
  const activePcts = tpl.values.slice(0, winnerCount);
  const pctSum = activePcts.reduce((s, v) => s + v, 0);
  const normalizedPcts = pctSum > 0 ? activePcts.map(v => (v / pctSum) * 100) : activePcts;
  for (let i = 0; i < winnerCount && i < sorted.length; i++) {
    const pct = normalizedPcts[i] || 0;
    prizes.set(sorted[i].id, (potForPrizes * pct) / 100);
  }

  // ---- Step 5: Detect ties ----
  const ties = new Set();
  for (let i = 1; i < sorted.length; i++) {
    const ptsA = sorted[i].points || 0;
    const ptsB = sorted[i - 1].points || 0;
    const hcpA = sorted[i].handicap ?? 999;
    const hcpB = sorted[i - 1].handicap ?? 999;
    if (ptsA === ptsB && hcpA === hcpB) {
      ties.add(sorted[i].id);
      ties.add(sorted[i - 1].id);
    }
  }

  // ---- Step 6: Assign ladies prize ----
  if (ladiesPot > 0) {
    const ladies = sorted.filter(p => p.category === "dam");
    const eligibleLadies = ladies.filter(p => !winnerIds.has(p.id));
    if (eligibleLadies.length > 0) {
      ladiesPrizes.set(eligibleLadies[0].id, ladiesPot);
    }
  }

  // ---- Step 7: Floor all amounts to whole euros ----
  const flooredPrizes = new Map();
  for (const [id, amt] of prizes) {
    flooredPrizes.set(id, Math.floor(amt));
  }
  const flooredLadies = new Map();
  for (const [id, amt] of ladiesPrizes) {
    flooredLadies.set(id, Math.floor(amt));
  }
  const flooredSebastian = Math.floor(sebastianManual);

  // ---- Step 8: Leftover goes to Sebastian pot ----
  const mainPayoutFloored = Array.from(flooredPrizes.values()).reduce((s, v) => s + v, 0);
  const ladiesPayoutFloored = Array.from(flooredLadies.values()).reduce((s, v) => s + v, 0);
  const leftover = totalPot - mainPayoutFloored - ladiesPayoutFloored - flooredSebastian;
  const finalSebastian = flooredSebastian + Math.max(0, leftover);

  const totalPayout = mainPayoutFloored + ladiesPayoutFloored + finalSebastian;
  const remaining = totalPot - totalPayout;

  return {
    sorted,
    prizes: flooredPrizes,
    ladiesPrizes: flooredLadies,
    ties,
    totalPot,
    mainPayout: mainPayoutFloored,
    ladiesPayout: ladiesPayoutFloored,
    sebastianAmount: finalSebastian,
    sebastianEnabled: sebastianManual > 0 || leftover > 0,
    sebastianManual,
    totalPayout,
    remaining,
    winnerCount,
    overPayout: totalPayout > totalPot,
    template: tpl,
  };
}

// ---- Rendering ----
function renderPotSummary() {
  const calc = calculatePrizes();
  const el = $("#pot-summary");
  if (state.players.length === 0) {
    el.innerHTML = `<span class="pot-label">Inga spelare</span>`;
    return;
  }
  el.innerHTML = `
    <div class="pot-item"><span class="pot-label">Spelare:</span><span class="pot-value">${state.players.length}</span></div>
    <div class="pot-item"><span class="pot-label">Pott:</span><span class="pot-value">${formatEuro(calc.totalPot)} €</span></div>
    <div class="pot-item"><span class="pot-label">Utdelning:</span><span class="pot-value ${calc.overPayout ? "over" : ""}">${formatEuro(calc.totalPayout)} €</span></div>
    <div class="pot-item"><span class="pot-label">Kvar:</span><span class="pot-value ${calc.remaining < 0 ? "over" : ""}">${formatEuro(calc.remaining)} €</span></div>
  `;
}

function renderPlayerList() {
  const list = $("#player-list");
  const empty = $("#no-players");
  const count = $("#player-count");
  count.textContent = state.players.length;

  if (state.players.length === 0) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  list.innerHTML = state.players.map(p => {
    if (p.id === editingPlayerId) {
      return `
        <div class="player-card editing" data-id="${p.id}">
          <form class="player-edit-form" data-edit-id="${p.id}">
            <div class="form-row">
              <input type="text" class="input-field edit-name" value="${escapeHtml(p.name)}" placeholder="Namn">
            </div>
            <div class="form-row form-row-2">
              <input type="text" class="input-field edit-pts" inputmode="numeric" value="${p.points !== null && p.points !== undefined ? p.points : ""}" placeholder="Poäng">
              <input type="text" class="input-field edit-hcp" inputmode="decimal" value="${p.handicap !== null && p.handicap !== undefined ? formatHcp(p.handicap) : ""}" placeholder="Handicap">
            </div>
            <div class="form-row form-category">
              <label class="cat-option"><input type="radio" name="edit-cat-${p.id}" value="herr" ${p.category === "herr" ? "checked" : ""}><span>Herr</span></label>
              <label class="cat-option"><input type="radio" name="edit-cat-${p.id}" value="dam" ${p.category === "dam" ? "checked" : ""}><span>Dam</span></label>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary btn-small">Spara</button>
              <button type="button" class="btn btn-secondary btn-small edit-cancel">Avbryt</button>
            </div>
          </form>
        </div>
      `;
    }
    const hasPts = p.points !== null && p.points !== undefined && !isNaN(p.points);
    return `
      <div class="player-card cat-${p.category}" data-id="${p.id}">
        <div class="player-info">
          <div class="player-name">${escapeHtml(p.name)}</div>
          ${hasPts ? `<div class="player-points">${formatPoints(p.points)} p</div>` : ""}
          ${(p.handicap !== null && p.handicap !== undefined && !isNaN(p.handicap)) ? `<div class="player-meta"><span class="meta-tag">Hcp ${formatHcp(p.handicap)}</span></div>` : ""}
        </div>
        <div class="player-actions">
          <button class="icon-btn edit-btn" data-id="${p.id}" aria-label="Redigera">✎</button>
          <button class="icon-btn danger del-btn" data-id="${p.id}" aria-label="Ta bort">✕</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderResults() {
  const list = $("#results-list");
  const empty = $("#results-empty");
  const calc = calculatePrizes();

  // Summary box
  let summaryHtml = "";
  {
    const tpl = calc.template;
    const activePcts = tpl.values.slice(0, calc.winnerCount);
    const pctSum = activePcts.reduce((s, v) => s + v, 0);
    const displayPcts = pctSum > 0 && pctSum !== 100
      ? activePcts.map(v => Math.round(v / pctSum * 100))
      : activePcts;
    const tplDesc = displayPcts.map(v => v + "%").join(" / ");
    const renormNote = pctSum > 0 && pctSum !== 100
      ? ` <span style="font-size:.8rem;color:#888;">(omskalat från ${activePcts.join("/")}%)</span>`
      : "";

    summaryHtml = `<div class="summary-box">
      <h3>Prissammanfattning</h3>
      <div class="summary-row summary-row-stack"><span class="sr-label">Mall</span><span class="sr-value sr-value-text">${escapeHtml(tpl.name)}</span></div>
      <div class="summary-row"><span class="sr-label">Utdelning</span><span class="sr-value">${tplDesc}${renormNote}</span></div>
      <div class="summary-row"><span class="sr-label">Pristagare</span><span class="sr-value">${calc.winnerCount}</span></div>
      <div class="summary-row"><span class="sr-label">Total pott</span><span class="sr-value">${formatEuro(calc.totalPot)} €</span></div>
      <div class="summary-row"><span class="sr-label">Huvudutdelning</span><span class="sr-value">${formatEuro(calc.mainPayout)} €</span></div>
      ${state.ladiesPrizeEnabled ? `<div class="summary-row"><span class="sr-label">Dampris</span><span class="sr-value">${formatEuro(calc.ladiesPayout)} €</span></div>` : ""}
      <div class="summary-row"><span class="sr-label">Sebastian-pott</span><span class="sr-value">${formatEuro(calc.sebastianAmount)} €</span></div>
      <div class="summary-row sr-total"><span class="sr-label">Total utdelning</span><span class="sr-value ${calc.overPayout ? "over" : ""}">${formatEuro(calc.totalPayout)} €</span></div>
      <div class="summary-row"><span class="sr-label">Återstående</span><span class="sr-value ${calc.remaining < 0 ? "over" : ""}">${formatEuro(calc.remaining)} €</span></div>
    </div>`;

    if (calc.overPayout) {
      const msg = `Varning: Utdelningen överstiger potten med ${formatEuro(Math.abs(calc.remaining))} €. Kontrollera procenterna.`;
      summaryHtml += `<div class="warning-msg">${msg}</div>`;
    }
  }

  // Results list
  const hasPoints = state.players.some(p => p.points !== null && p.points !== undefined && !isNaN(p.points));
  if (state.players.length === 0 || !hasPoints) {
    list.innerHTML = summaryHtml;
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  let prevPts = null, prevHcp = null, rank = 0;
  const resultCards = calc.sorted.map((p, i) => {
    const pts = p.points || 0;
    const hcp = p.handicap ?? 999;
    const isTied = (prevPts !== null && pts === prevPts && hcp === prevHcp);
    if (!isTied) {
      rank = i + 1;
    }
    prevPts = pts;
    prevHcp = hcp;

    const prize = calc.prizes.get(p.id) || 0;
    const ladiesPrize = calc.ladiesPrizes.get(p.id) || 0;
    const hasPrize = prize > 0;
    const hasLadiesPrize = ladiesPrize > 0;
    const tieMark = calc.ties.has(p.id) ? `<span class="tied-mark">=</span>` : "";
    const ladiesBadge = hasLadiesPrize ? `<span class="ladies-badge">Dampris</span>` : "";
    const hasPts = p.points !== null && p.points !== undefined && !isNaN(p.points);
    const ptsDisplay = hasPts ? `${formatPoints(p.points)} p` : "";
    const prizeText = hasPrize
      ? formatEuro(prize) + " €"
      : (hasLadiesPrize ? "" : (hasPts ? "–" : ""));
    const ladiesPrizeText = hasLadiesPrize ? `<div class="result-prize ladies-prize">${formatEuro(ladiesPrize)} €</div>` : "";

    return `
      <div class="result-card cat-${p.category} ${hasPrize ? "has-prize" : "no-prize"} ${calc.ties.has(p.id) ? "tied" : ""}">
        <div class="result-rank">${rank}${tieMark}</div>
        <div class="result-body">
          <div class="result-name">${escapeHtml(p.name)} ${ladiesBadge}</div>
          <div class="result-stats">
            <span class="result-points">${ptsDisplay}</span>
            <span class="result-prize">${prizeText}</span>
          </div>
          ${(p.handicap !== null && p.handicap !== undefined && !isNaN(p.handicap)) ? `<div class="result-meta"><span>Hcp ${formatHcp(p.handicap)}</span></div>` : ""}
        </div>
        ${ladiesPrizeText}
      </div>
    `;
  }).join("");

  // Sebastian-pott card (always shown, last)
  const hasManual = calc.sebastianManual > 0;
  const roundingAmount = Math.max(0, calc.sebastianAmount - Math.floor(calc.sebastianManual));
  const manualAmount = Math.floor(calc.sebastianManual);
  const sebBreakdown = [];
  sebBreakdown.push(`<div class="seb-row"><span>Avrundning</span><span>${formatEuro(roundingAmount)} €</span></div>`);
  if (hasManual) {
    sebBreakdown.push(`<div class="seb-row"><span>Manuellt</span><span>${formatEuro(manualAmount)} €</span></div>`);
  }
  sebBreakdown.push(`<div class="seb-total"><span>Totalt</span><span>${formatEuro(calc.sebastianAmount)} €</span></div>`);
  const sebCard = `
    <div class="result-card sebastian-card">
      <div class="result-rank sebastian-rank"><span class="sebastian-icon">\u269B</span></div>
      <div class="result-body">
        <div class="result-name">${SEBASTIAN_NAME}</div>
        <div class="seb-breakdown">${sebBreakdown.join("")}</div>
      </div>
    </div>`;

  // Ladies' results — only show the winning lady
  let ladiesHtml = "";
  if (state.ladiesPrizeEnabled && calc.ladiesPayout > 0) {
    const winnerId = Array.from(calc.ladiesPrizes.keys()).find(id => (calc.ladiesPrizes.get(id) || 0) > 0);
    const winner = calc.sorted.find(p => p.id === winnerId);
    if (winner) {
      ladiesHtml = `<div class="summary-box" style="border-color:#d63384;background:#fdf2f8;">
        <h3 style="color:#a02060;">Dampris</h3>
        <div class="ladies-result-list">
          <div class="ladies-result-card">
            <div class="lr-rank">1</div>
            <div class="lr-name">${escapeHtml(winner.name)} <span style="font-size:.8rem;color:#999;">${formatPoints(winner.points)} p${(winner.handicap !== null && winner.handicap !== undefined && !isNaN(winner.handicap)) ? ` · Hcp ${formatHcp(winner.handicap)}` : ""}</span></div>
            <div class="lr-prize">${formatEuro(calc.ladiesPayout)} €</div>
          </div>
        </div>
      </div>`;
    }
  }

  list.innerHTML = summaryHtml + resultCards + sebCard + ladiesHtml;
}

function renderTemplateSelect() {
  const sel = $("#template-select");
  sel.innerHTML = state.templates.map(t =>
    `<option value="${t.id}" ${t.id === state.selectedTemplateId ? "selected" : ""}>${escapeHtml(t.name)}</option>`
  ).join("");
}

function renderTemplateEditor() {
  const container = $("#template-editor");
  const tpl = getTemplate();
  if (!tpl) { container.innerHTML = ""; return; }

  let html = `<div class="template-rows" style="margin-top:.5rem;">`;
  for (let i = 0; i < tpl.values.length; i++) {
    const val = tpl.values[i];
    html += `<div class="template-row">
      <span class="tpl-rank">${i + 1}.</span>
      <input type="text" class="input-field tpl-val" data-idx="${i}" inputmode="decimal" value="${val}">
      <span class="tpl-suffix">%</span>
    </div>`;
  }
  html += `</div>`;

  container.innerHTML = html;
}

function renderLadiesPrizeSettings() {
  const container = $("#ladies-prize-settings");
  if (!state.ladiesPrizeEnabled) {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }
  container.classList.remove("hidden");

  const typeOptions = state.ladiesPrizeType === "fixed"
    ? `<input type="text" id="ladies-amount" inputmode="decimal" class="input-field" value="${formatEuro(state.ladiesPrizeAmount)}">`
    : `<input type="text" id="ladies-percent" inputmode="decimal" class="input-field" value="${state.ladiesPrizePercent}">`;

  container.innerHTML = `
    <div class="form-row form-category">
      <label class="cat-option"><input type="radio" name="ladies-type" value="fixed" ${state.ladiesPrizeType === "fixed" ? "checked" : ""}><span>Belopp i €</span></label>
      <label class="cat-option"><input type="radio" name="ladies-type" value="percentage" ${state.ladiesPrizeType === "percentage" ? "checked" : ""}><span>Andel i %</span></label>
    </div>
    <div class="setting-group">
      <label>${state.ladiesPrizeType === "fixed" ? "Belopp i €" : "Andel i %"}</label>
      ${typeOptions}
    </div>
    <div class="setting-group">
      <label>Minsta antal damer</label>
      <input type="number" id="ladies-min" min="1" max="20" class="input-field" value="${state.ladiesMinCount}">
    </div>
  `;
}

function renderAll() {
  renderPotSummary();
  renderPlayerList();
  renderResults();
  renderTemplateSelect();
  renderTemplateEditor();
  renderLadiesPrizeSettings();
}

// ---- Event Handlers ----

function handlePlayerFormSubmit(e) {
  e.preventDefault();
  const name = $("#player-name").value.trim();
  const hcpRaw = $("#player-handicap").value.trim();
  const ptsRaw = $("#player-points").value.trim();
  const category = document.querySelector('input[name="category"]:checked')?.value || "herr";
  const errEl = $("#form-error");

  errEl.classList.add("hidden");
  errEl.textContent = "";

  if (!name) {
    showFormError("Ange spelarens namn.");
    $("#player-name").focus();
    return;
  }

  const hcp = hcpRaw === "" ? null : parseNum(hcpRaw);
  if (hcpRaw !== "" && (isNaN(hcp) || hcp < -10 || hcp > 60)) {
    showFormError("Handicap måste vara ett tal mellan -10 och 60 (använd komma eller punkt).");
    $("#player-handicap").focus();
    return;
  }

  const pts = ptsRaw === "" ? null : parseNum(ptsRaw);
  if (ptsRaw !== "" && (isNaN(pts) || pts < 0 || pts > 100 || !Number.isInteger(pts))) {
    showFormError("Poäng måste vara ett heltal mellan 0 och 100.");
    $("#player-points").focus();
    return;
  }

  addPlayer(name, hcp, pts, category);
  lastCategory = category;

  // Reset form — always default back to herr
  $("#player-form").reset();
  hideNameSuggestions();
  const herrRadio = document.querySelector('input[name="category"][value="herr"]');
  if (herrRadio) herrRadio.checked = true;
  $("#player-name").focus();
}

function showFormError(msg) {
  const el = $("#form-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

function handlePlayerListClick(e) {
  const editBtn = e.target.closest(".edit-btn");
  const delBtn = e.target.closest(".del-btn");
  const editCancel = e.target.closest(".edit-cancel");

  if (editBtn) {
    editingPlayerId = editBtn.dataset.id;
    renderPlayerList();
    const nameInput = document.querySelector(`.player-edit-form[data-edit-id="${editingPlayerId}"] .edit-name`);
    if (nameInput) nameInput.focus();
    return;
  }

  if (delBtn) {
    const player = state.players.find(p => p.id === delBtn.dataset.id);
    if (player && confirm(`Ta bort ${player.name}?`)) {
      deletePlayer(delBtn.dataset.id);
    }
    return;
  }

  if (editCancel) {
    editingPlayerId = null;
    renderPlayerList();
    return;
  }
}

function handlePlayerListSubmit(e) {
  const form = e.target.closest(".player-edit-form");
  if (!form) return;
  e.preventDefault();
  const id = form.dataset.editId;
  const name = form.querySelector(".edit-name").value.trim();
  const hcpRaw = form.querySelector(".edit-hcp").value.trim();
  const ptsRaw = form.querySelector(".edit-pts").value.trim();
  const category = form.querySelector(`input[name="edit-cat-${id}"]:checked`)?.value || "herr";

  if (!name) {
    alert("Ange spelarens namn.");
    return;
  }

  const hcp = hcpRaw === "" ? null : parseNum(hcpRaw);
  if (hcpRaw !== "" && (isNaN(hcp) || hcp < -10 || hcp > 60)) {
    alert("Handicap måste vara ett tal mellan -10 och 60.");
    return;
  }

  const pts = ptsRaw === "" ? null : parseNum(ptsRaw);
  if (ptsRaw !== "" && (isNaN(pts) || pts < 0 || pts > 100 || !Number.isInteger(pts))) {
    alert("Poäng måste vara ett heltal mellan 0 och 100.");
    return;
  }

  editingPlayerId = null;
  updatePlayer(id, name, hcp, pts, category);
}

function handleSettingsChange(e) {
  const target = e.target;

  if (target.id === "round-date") {
    state.roundDate = target.value;
    saveState();
    return;
  }

  if (target.id === "buy-in") {
    const val = parseNum(target.value);
    if (!isNaN(val) && val >= 0) {
      state.buyIn = val;
      saveState();
      renderAll();
    }
    return;
  }

  if (target.id === "template-select") {
    state.selectedTemplateId = target.value;
    saveState();
    renderAll();
    return;
  }

  if (target.id === "ladies-prize-enabled") {
    state.ladiesPrizeEnabled = target.checked;
    saveState();
    renderAll();
    return;
  }

  if (target.id === "sebastian-pot-input") {
    const val = parseNum(target.value);
    state.sebastianPot = (isNaN(val) || val < 0) ? 0 : val;
    saveState();
    renderAll();
    return;
  }
}

function handleLadiesPrizeChange(e) {
  const target = e.target;

  if (target.name === "ladies-type") {
    state.ladiesPrizeType = target.value;
    saveState();
    renderLadiesPrizeSettings();
    renderAll();
    return;
  }

  if (target.id === "ladies-amount") {
    const val = parseNum(target.value);
    if (!isNaN(val) && val >= 0) {
      state.ladiesPrizeAmount = val;
      saveState();
      renderAll();
    }
    return;
  }

  if (target.id === "ladies-percent") {
    const val = parseNum(target.value);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      state.ladiesPrizePercent = val;
      saveState();
      renderAll();
    }
    return;
  }

  if (target.id === "ladies-min") {
    const val = parseInt(target.value, 10);
    if (!isNaN(val) && val >= 1) {
      state.ladiesMinCount = val;
      saveState();
      renderAll();
    }
    return;
  }


}

function handleTemplateEditorChange(e) {
  const target = e.target;

  if (target.classList.contains("tpl-val")) {
    const idx = parseInt(target.dataset.idx, 10);
    const val = parseNum(target.value);
    if (!isNaN(val) && val >= 0) {
      const tpl = getTemplate();
      if (tpl) {
        tpl.values[idx] = val;
        saveState();
        renderAll();
      }
    }
    return;
  }

}

function handleTemplateEditorClick(e) {
  const target = e.target;

  if (target.id === "reset-templates-btn") {
    if (confirm("Återställ alla mallar till standardvärden? Eventuella egna procentändringar går förlorade.")) {
      state.templates = defaultTemplates.map(t => ({ ...t, values: [...t.values] }));
      state.selectedTemplateId = "tpl-1";
      saveState();
      renderAll();
    }
    return;
  }
}

function csvField(val) {
  const s = String(val);
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvNum(n) {
  if (isNaN(n) || n === null) return "0";
  return n.toFixed(2).replace(".", ",");
}

function handleExportCSV() {
  if (state.players.length === 0) {
    alert("Inga spelare att exportera.");
    return;
  }
  const calc = calculatePrizes();
  const dateStr = state.roundDate || new Date().toISOString().slice(0, 10);

  const rows = [];

  // Summary section
  rows.push(["Golfpott — Resultat", ""]);
  rows.push(["Datum", dateStr]);
  rows.push(["Insats per spelare (€)", csvNum(state.buyIn)]);
  rows.push(["Antal spelare", state.players.length]);
  rows.push(["Mall", calc.template.name]);
  rows.push(["Total pott (€)", csvNum(calc.totalPot)]);
  rows.push(["Huvudutdelning (€)", csvNum(calc.mainPayout)]);
  if (state.ladiesPrizeEnabled) {
    rows.push(["Dampris (€)", csvNum(calc.ladiesPayout)]);
  }
  rows.push(["Sebastian-pott (€)", csvNum(calc.sebastianAmount)]);
  rows.push(["Total utdelning (€)", csvNum(calc.totalPayout)]);
  rows.push(["Återstående (€)", csvNum(calc.remaining)]);
  rows.push(["", ""]);
  rows.push(["", ""]);

  // Player results header
  const header = ["Datum", "Placering", "Namn", "Handicap", "Poäng", "Kategori", "Prispengar (€)", "Dampris (€)", "Totalt (€)"];
  rows.push(header);

  let prevPts = null, prevHcp = null, rank = 0;
  calc.sorted.forEach((p, i) => {
    const pts = p.points || 0;
    const hcp = p.handicap ?? 999;
    const isTied = (prevPts !== null && pts === prevPts && hcp === prevHcp);
    if (!isTied) rank = i + 1;
    prevPts = pts;
    prevHcp = hcp;

    const prize = calc.prizes.get(p.id) || 0;
    const ladiesPrize = calc.ladiesPrizes.get(p.id) || 0;
    const total = prize + ladiesPrize;
    const rankStr = rank + (calc.ties.has(p.id) ? "=" : "");
    const catStr = p.category === "dam" ? "Dam" : "Herr";

    rows.push([
      dateStr,
      rankStr,
      p.name,
      p.handicap !== null && p.handicap !== undefined ? formatHcp(p.handicap) : "",
      p.points !== null && p.points !== undefined ? formatPoints(p.points) : "",
      catStr,
      csvNum(prize),
      csvNum(ladiesPrize),
      csvNum(total),
    ]);
  });

  // Sebastian row
  rows.push([
    dateStr,
    "",
    SEBASTIAN_NAME,
    "",
    "",
    "",
    csvNum(calc.sebastianAmount),
    csvNum(0),
    csvNum(calc.sebastianAmount),
  ]);

  const csv = rows.map(r => r.map(csvField).join(";")).join("\r\n");
  downloadFile(csv, `golfpott-resultat-${dateStr}.csv`, "text/csv;charset=utf-8");
}

function handleNewRound() {
  if (state.players.length > 0) {
    const msg = "Starta ny runda? Alla nuvarande spelare och resultat kommer att raderas. Detta går inte att ångra.";
    if (!confirm(msg)) return;
  }
  state.players = [];
  state.roundDate = new Date().toISOString().slice(0, 10);
  editingPlayerId = null;
  saveState();
  $("#round-date").value = state.roundDate;
  renderAll();
}

// ---- Share via URL ----
function encodeShareData() {
  const data = {
    d: state.roundDate,
    b: state.buyIn,
    p: state.players.map(p => [p.name, p.handicap, p.points, p.category]),
    t: state.selectedTemplateId,
    tv: getTemplate() ? getTemplate().values : [],
    le: state.ladiesPrizeEnabled,
    lt: state.ladiesPrizeType,
    la: state.ladiesPrizeAmount,
    lp: state.ladiesPrizePercent,
    lm: state.ladiesMinCount,
    s: state.sebastianPot,
  };
  const json = JSON.stringify(data);
  return btoa(unescape(encodeURIComponent(json)));
}

function decodeShareData(encoded) {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const data = JSON.parse(json);
    return data;
  } catch (e) {
    return null;
  }
}

function applyShareData(data) {
  if (!data) return false;
  if (data.d) state.roundDate = data.d;
  if (typeof data.b === "number") state.buyIn = data.b;
  if (Array.isArray(data.p)) {
    state.players = data.p.map(arr => ({
      id: "p" + Date.now() + Math.random().toString(36).slice(2, 6),
      name: arr[0],
      handicap: arr[1],
      points: arr[2],
      category: arr[3] || "herr",
    }));
  }
  if (data.t) state.selectedTemplateId = data.t;
  if (Array.isArray(data.tv) && data.tv.length > 0) {
    const tpl = getTemplate();
    if (tpl) tpl.values = data.tv;
  }
  if (typeof data.le === "boolean") state.ladiesPrizeEnabled = data.le;
  if (data.lt) state.ladiesPrizeType = data.lt;
  if (typeof data.la === "number") state.ladiesPrizeAmount = data.la;
  if (typeof data.lp === "number") state.ladiesPrizePercent = data.lp;
  if (typeof data.lm === "number") state.ladiesMinCount = data.lm;
  if (typeof data.s === "number") state.sebastianPot = data.s;

  // Merge saved names without duplicates
  state.players.forEach(p => addSavedName(p.name));

  saveState();
  return true;
}

function handleShare() {
  if (state.players.length === 0) {
    alert("Inga spelare att dela än.");
    return;
  }
  const encoded = encodeShareData();
  const url = window.location.origin + window.location.pathname + "#d=" + encoded;
  if (navigator.share) {
    navigator.share({
      title: "Golfpott",
      text: "Här är resultaten från golfrundan — öppna länken för att se och komplettera.",
      url: url,
    }).catch(() => {
      copyShareLink(url);
    });
  } else {
    copyShareLink(url);
  }
}

function copyShareLink(url) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      alert("Länken kopierad! Klistra in i SMS eller mail och skicka till tävlingsledaren.");
    }).catch(() => {
      prompt("Kopiera länken nedan och skicka till tävlingsledaren:", url);
    });
  } else {
    prompt("Kopiera länken nedan och skicka till tävlingsledaren:", url);
  }
}

// ---- File download ----
function downloadFile(content, filename, mimeType) {
  const blob = new Blob(["\uFEFF" + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ---- Build version badge ----
const APP_VERSION = (typeof __APP_VERSION__ !== "undefined") ? __APP_VERSION__ : "1.0.0";
const BUILD_TIME = (typeof __BUILD_TIME__ !== "undefined") ? __BUILD_TIME__ : "";

function renderBuildBadge() {
  const el = $("#build-badge");
  if (!el) return;
  let label = `v${APP_VERSION}`;
  if (BUILD_TIME) {
    const d = new Date(BUILD_TIME);
    const day = d.toLocaleDateString("sv-SE", { day: "2-digit", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
    label += ` · ${day} ${time}`;
  }
  el.textContent = label;
}

// ---- Voice input (Web Speech API) ----
let voiceRecognition = null;
let voiceListening = false;

// Swedish number words → digits
const swedishNumbers = {
  noll: 0, ett: 1, en: 1, två: 2, tva: 2, tre: 3, fyra: 4, fem: 5,
  sex: 6, sju: 7, åtta: 8, atta: 8, nio: 9, tio: 10, elva: 11, tolv: 12,
  tretton: 13, fjorton: 14, femton: 15, sexton: 16, sjutton: 17, arton: 18,
  nitton: 19, tjugo: 20, trettio: 30, fyrtio: 40, femtio: 50, sextio: 60,
  sjuttio: 70, åttio: 80, nittio: 90, hundra: 100,
};

function swedishWordsToNumbers(text) {
  let result = text;
  // Replace compound numbers like "trettiosex" → "36", "fyrtiofem" → "45"
  for (const [word, val] of Object.entries(swedishNumbers)) {
    if (val >= 20 && val < 100) {
      const tens = Math.floor(val / 10);
      const ones = val % 10;
      if (ones === 0) continue;
      const tensWord = Object.entries(swedishNumbers).find(([w, v]) => v === tens * 10)?.[0];
      const onesWord = Object.entries(swedishNumbers).find(([w, v]) => v === ones)?.[0];
      if (tensWord && onesWord) {
        const compound = tensWord + onesWord;
        result = result.replace(new RegExp(compound, "gi"), String(val));
      }
    }
  }
  // Replace standalone number words — use lookarounds instead of \b because
  // \b does not recognize å/ä/ö as word characters, so "två", "åtta", "åttio"
  // would never match. (?:^|...) and (?=$|...) cover all boundaries including
  // Swedish characters.
  result = result.replace(/(?<![a-zåäö0-9])(noll|ett|en|två|tva|tre|fyra|fem|sex|sju|åtta|atta|nio|tio|elva|tolv|tretton|fjorton|femton|sexton|sjutton|arton|nitton|tjugo|trettio|fyrtio|femtio|sextio|sjuttio|åttio|nittio|hundra)(?![a-zåäö0-9])/gi,
    (m) => String(swedishNumbers[m.toLowerCase()] ?? m));
  // Replace "komma" (spoken comma in decimals) → ","
  result = result.replace(/(?<![a-zåäö0-9])komma(?![a-zåäö0-9])/gi, ",");
  return result;
}

function parseVoiceCommand(transcript) {
  let text = transcript.trim();
  if (!text) return null;

  // Convert Swedish number words to digits first
  text = swedishWordsToNumbers(text);

  let name = null;
  let hcp = null;
  let points = null;
  let category = null;

  // Detect "dam" or "herr" in the phrase
  if (/(?:^|[^a-zåäö0-9])dam(?:$|[^a-zåäö0-9])/i.test(text)) category = "dam";
  else if (/(?:^|[^a-zåäö0-9])herr(?:$|[^a-zåäö0-9])/i.test(text)) category = "herr";

  // Build keyword regexes (case-insensitive, flexible spacing)
  const hcpKeywords = /(?:handicap|handikapp|hcp|hc|hcpe|h\s?c\s?p|h\.c\.p)/i;
  const ptsKeywords = /(?:po[aä]ng|points?|p[oa]äng)/i;

  // Try to find a number near a handicap keyword — number can be before OR after
  // "handicap 3" / "hcp 4,2" / "3 handicap"
  const hcpAfter = text.match(/(?:handicap|handikapp|hcp|hc|hcpe|h\s?c\s?p|h\.c\.p)\s*[:\-]?\s*([0-9]+(?:[,.][0-9]+)?)/i);
  const hcpBefore = text.match(/([0-9]+(?:[,.][0-9]+)?)\s*(?:handicap|handikapp|hcp|hc|hcpe|h\s?c\s?p|h\.c\.p)/i);
  if (hcpAfter) {
    hcp = parseNum(hcpAfter[1]);
  } else if (hcpBefore) {
    hcp = parseNum(hcpBefore[1]);
  }

  // Try to find a number near a points keyword — number can be before OR after
  // "36 poäng" / "poäng 42"
  const ptsAfter = text.match(/(?:po[aä]ng|points?)\s*[:\-]?\s*([0-9]+)/i);
  const ptsBefore = text.match(/([0-9]+)\s*(?:po[aä]ng|points?)/i);
  if (ptsAfter) {
    points = parseNum(ptsAfter[1]);
  } else if (ptsBefore) {
    points = parseNum(ptsBefore[1]);
  }

  // Fallback: if we found HCP but no points, look for a standalone integer after HCP value
  // e.g. "Olle handicap 3 36" where "36" is points
  if (hcp !== null && points === null) {
    const hcpNumStr = String(hcp).replace(".", ",");
    const afterHcp = text.slice(text.search(hcpKeywords));
    const remaining = afterHcp.replace(/.*[0-9]+(?:[,.][0-9]+)?\s*/, "");
    const fallbackPts = remaining.match(/([0-9]+)/);
    if (fallbackPts) {
      const candidate = parseNum(fallbackPts[1]);
      if (candidate !== hcp) {
        points = candidate;
      }
    }
  }

  // Fallback: if no keywords at all, try comma-separated format: "Olle, 3, 36"
  if (hcp === null && points === null) {
    const parts = text.split(/[,]/).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
      // Last item might be points, second-to-last might be hcp
      const possiblePts = parseNum(parts[parts.length - 1]);
      const possibleHcp = parseNum(parts[parts.length - 2]);
      if (!isNaN(possiblePts) && possiblePts >= 0 && possiblePts <= 100) {
        points = possiblePts;
      }
      if (!isNaN(possibleHcp) && possibleHcp >= -10 && possibleHcp <= 60) {
        hcp = possibleHcp;
      }
      name = parts.slice(0, parts.length - 2).join(" ").trim();
    }
  }

  // Extract name: everything before the first recognized keyword,
  // with any identified hcp/points numbers stripped from the name
  if (!name) {
    const keywordIdx = text.search(/(?:handicap|handikapp|hcp|hc|hcpe|h\s?c\s?p|h\.c\.p|po[aä]ng|points?|(?:^|[^a-zåäö0-9])dam(?:$|[^a-zåäö0-9])|(?:^|[^a-zåäö0-9])herr(?:$|[^a-zåäö0-9]))/i);
    if (keywordIdx > 0) {
      name = text.slice(0, keywordIdx).trim().replace(/[,]/g, "").trim();
    } else if (keywordIdx === -1) {
      name = text.replace(/[,]/g, "").trim();
    }
    if (name) {
      if (hcp !== null && !isNaN(hcp)) {
        const hcpStr = String(hcp);
        const hcpComma = hcpStr.replace(".", ",");
        name = name.split(hcpComma).join(" ");
        name = name.split(hcpStr).join(" ");
      }
      if (points !== null && !isNaN(points)) {
        name = name.split(String(points)).join(" ");
      }
      name = name.replace(/\s+/g, " ").trim();
    }
  }

  // Clean up name: remove leading/trailing punctuation, extra spaces
  if (name) {
    name = name.replace(/^[,\s]+|[,\s]+$/g, "").trim();
    // Capitalize first letter of each word
    name = name.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }

  return { name, hcp, points, category };
}

function setVoiceStatus(msg, listening) {
  const el = $("#voice-status");
  if (!el) return;
  if (msg) {
    el.classList.remove("hidden");
    el.innerHTML = (listening ? '<span class="voice-dot"></span>' : "") + escapeHtml(msg);
    if (listening) el.classList.add("listening");
    else el.classList.remove("listening");
  } else {
    el.classList.add("hidden");
    el.classList.remove("listening");
  }
}

// Continuous voice mode: auto-restarts after each result so the user can
// add multiple players without tapping the button again. Solves iPhone
// instability where stop/start cycles hang.
let voiceContinuous = false;
let voiceRestartTimer = null;

function createRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const rec = new SpeechRecognition();
  rec.lang = "sv-SE";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.continuous = true;
  return rec;
}

function startVoiceRecognition(isRestart) {
  const btn = $("#voice-add-btn");
  const rec = createRecognition();
  if (!rec) {
    setVoiceStatus("Röstigenkänning stöds inte i den här webbläsaren. Testa Chrome eller Safari.", false);
    setTimeout(() => setVoiceStatus(null, false), 4000);
    return;
  }

  rec.onstart = () => {
    voiceListening = true;
    btn.classList.add("listening");
    btn.textContent = voiceContinuous ? "■ Stoppa röst" : "● Lyssnar...";
    if (voiceContinuous && isRestart) {
      setVoiceStatus("Lyssnar igen — säg nästa spelare", true);
    } else {
      setVoiceStatus("Säg t.ex: Olle, poäng 45, handikapp 0 (herr är default)", true);
    }
  };

  rec.onresult = (e) => {
    // In continuous mode, multiple results may accumulate — process the last one
    const lastResult = e.results[e.results.length - 1];
    const transcript = lastResult[0].transcript;
    setVoiceStatus("Hörde: \"" + transcript + "\" — tolkar...", false);

    const parsed = parseVoiceCommand(transcript);
    if (!parsed || !parsed.name) {
      setVoiceStatus("Kunde inte tolka namnet. Försök igen: \"Olle, poäng 36, handikapp 3\" eller \"Olle, 36, 3\"", false);
      return;
    }

    $("#player-name").value = parsed.name;
    if (parsed.hcp !== null && !isNaN(parsed.hcp)) {
      $("#player-handicap").value = formatHcp(parsed.hcp);
    }
    if (parsed.points !== null && !isNaN(parsed.points)) {
      $("#player-points").value = String(parsed.points);
    }
    // Always default to herr unless explicitly said "dam"
    if (parsed.category) {
      const radio = document.querySelector(`input[name="category"][value="${parsed.category}"]`);
      if (radio) radio.checked = true;
    } else {
      const radio = document.querySelector('input[name="category"][value="herr"]');
      if (radio) radio.checked = true;
    }

    setVoiceStatus("Tillagt: " + parsed.name + (parsed.hcp != null ? ", Hcp " + formatHcp(parsed.hcp) : "") + (parsed.points != null ? ", " + parsed.points + " p" : ""), false);
    $("#player-form").dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  rec.onerror = (e) => {
    let msg = "Röstfel: " + e.error;
    if (e.error === "no-speech") msg = voiceContinuous ? "Hörde ingenting — säg en spelare eller tryck Stoppa" : "Hörde ingenting. Försök igen.";
    if (e.error === "not-allowed") msg = "Mikrofonåtkomst nekad. Tillåt mikrofon i webbläsaren.";
    if (e.error === "audio-capture") msg = "Kunde inte komma åt mikrofonen. Kontrollera att ingen annan app använder den.";
    if (e.error === "network") msg = "Nätverksfel vid röstigenkänning. Försök igen.";
    setVoiceStatus(msg, false);
    if (e.error === "not-allowed" || e.error === "audio-capture") {
      voiceContinuous = false;
    }
  };

  rec.onend = () => {
    voiceListening = false;
    voiceRecognition = null;

    if (voiceContinuous) {
      // Safari/iOS sometimes ends the session unexpectedly — restart once
      clearTimeout(voiceRestartTimer);
      voiceRestartTimer = setTimeout(() => {
        if (voiceContinuous) startVoiceRecognition(true);
      }, 300);
    } else {
      btn.classList.remove("listening");
      btn.textContent = "🎤 Röst";
      setTimeout(() => setVoiceStatus(null, false), 3000);
    }
  };

  voiceRecognition = rec;
  try {
    rec.start();
  } catch (err) {
    // iOS sometimes throws "recognition has already started" — retry once
    clearTimeout(voiceRestartTimer);
    voiceRestartTimer = setTimeout(() => {
      if (voiceContinuous) startVoiceRecognition(true);
    }, 500);
  }
}

async function toggleVoiceInput() {
  clearTimeout(voiceRestartTimer);

  if (voiceListening || voiceContinuous) {
    // Stop everything
    voiceContinuous = false;
    voiceListening = false;
    if (voiceRecognition) {
      try { voiceRecognition.stop(); } catch (e) {}
      voiceRecognition = null;
    }
    const btn = $("#voice-add-btn");
    btn.classList.remove("listening");
    btn.textContent = "🎤 Röst";
    setVoiceStatus("Röst avstängd", false);
    setTimeout(() => setVoiceStatus(null, false), 2000);
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setVoiceStatus("Röstigenkänning stöds inte i den här webbläsaren. Testa Chrome eller Safari.", false);
    setTimeout(() => setVoiceStatus(null, false), 4000);
    return;
  }

  // Warm up microphone permission first — iOS won't capture the first
  // utterance if the permission dialog is still showing when recognition starts
  setVoiceStatus("Hämtar mikrofonåtkomst...", true);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
  } catch (err) {
    setVoiceStatus("Mikrofonåtkomst nekad. Tillåt mikrofon i webbläsaren.", false);
    setTimeout(() => setVoiceStatus(null, false), 4000);
    return;
  }

  // Start continuous mode — keeps listening until user taps to stop
  voiceContinuous = true;
  startVoiceRecognition(false);
}

// ---- Init ----
function init() {
  loadState();

  // Set default date
  if (!state.roundDate) {
    state.roundDate = new Date().toISOString().slice(0, 10);
  }
  $("#round-date").value = state.roundDate;
  $("#buy-in").value = formatEuro(state.buyIn);
  $("#ladies-prize-enabled").checked = state.ladiesPrizeEnabled;
  const sebInput = $("#sebastian-pot-input");
  if (sebInput) sebInput.value = state.sebastianPot > 0 ? formatEuro(state.sebastianPot) : "";

  // Check for shared data in URL
  const hashMatch = window.location.hash.match(/d=([^&]+)/);
  if (hashMatch) {
    const shared = decodeShareData(hashMatch[1]);
    if (shared) {
      if (state.players.length > 0) {
        if (confirm("Ersätt nuvarande spelare med inkommande data?")) {
          applyShareData(shared);
        }
      } else {
        applyShareData(shared);
      }
      window.history.replaceState(null, "", window.location.pathname);
      $("#round-date").value = state.roundDate;
      $("#buy-in").value = formatEuro(state.buyIn);
      $("#ladies-prize-enabled").checked = state.ladiesPrizeEnabled;
      if (sebInput) sebInput.value = state.sebastianPot > 0 ? formatEuro(state.sebastianPot) : "";
    }
  }

  renderAll();

  // Events
  $("#player-form").addEventListener("submit", handlePlayerFormSubmit);
  $("#player-form-cancel").addEventListener("click", () => {
    $("#player-form").reset();
    $("#form-error").classList.add("hidden");
  });
  $("#voice-add-btn").addEventListener("click", toggleVoiceInput);

  // Name autocomplete
  const nameInput = $("#player-name");
  if (nameInput) {
    nameInput.addEventListener("input", renderNameSuggestions);
    nameInput.addEventListener("focus", renderNameSuggestions);
  }
  const suggestionsEl = $("#name-suggestions");
  if (suggestionsEl) {
    suggestionsEl.addEventListener("click", (e) => {
      const removeBtn = e.target.closest(".name-suggestion-remove");
      if (removeBtn) {
        e.stopPropagation();
        const name = removeBtn.dataset.remove;
        if (name) removeSavedName(name);
        return;
      }
      const item = e.target.closest(".name-suggestion-item");
      if (item) {
        const name = item.dataset.name;
        if (name && nameInput) {
          nameInput.value = name;
          hideNameSuggestions();
          const ptsInput = $("#player-points");
          if (ptsInput) ptsInput.focus();
        }
      }
    });
  }
  // Hide suggestions when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".name-autocomplete-wrap")) {
      hideNameSuggestions();
    }
  });

  $("#player-list").addEventListener("click", handlePlayerListClick);
  $("#player-list").addEventListener("submit", handlePlayerListSubmit);

  // Settings — use delegation on main
  document.querySelector(".app-main").addEventListener("change", (e) => {
    handleSettingsChange(e);
    handleLadiesPrizeChange(e);
    handleTemplateEditorChange(e);
  });

  // Input events for live update
  document.querySelector(".app-main").addEventListener("input", (e) => {
    if (e.target.id === "buy-in") {
      const val = parseNum(e.target.value);
      if (!isNaN(val) && val >= 0) {
        state.buyIn = val;
        saveState();
        renderPotSummary();
        renderResults();
      }
    }
    if (e.target.id === "round-date") {
      state.roundDate = e.target.value;
      saveState();
    }
    if (e.target.id === "sebastian-pot-input") {
      const val = parseNum(e.target.value);
      state.sebastianPot = (isNaN(val) || val < 0) ? 0 : val;
      saveState();
      renderPotSummary();
      renderResults();
    }
    if (e.target.classList.contains("tpl-val")) {
      const idx = parseInt(e.target.dataset.idx, 10);
      const val = parseNum(e.target.value);
      const tpl = getTemplate();
      if (tpl && !isNaN(val) && val >= 0) {
        tpl.values[idx] = val;
        saveState();
        renderPotSummary();
        renderResults();
      }
    }
  });

  // Click delegation for template editor and new template
  document.querySelector(".app-main").addEventListener("click", (e) => {
    handleTemplateEditorClick(e);
  });

$("#export-csv-btn").addEventListener("click", handleExportCSV);
  $("#new-round-btn").addEventListener("click", handleNewRound);
  const shareBtn = $("#share-btn");
  if (shareBtn) shareBtn.addEventListener("click", handleShare);

  renderBuildBadge();

  // Keep category selection for quick entry
  const catRadios = document.querySelectorAll('input[name="category"]');
  catRadios.forEach(r => {
    r.addEventListener("change", () => {
      lastCategory = r.value;
    });
  });
}

document.addEventListener("DOMContentLoaded", init);
