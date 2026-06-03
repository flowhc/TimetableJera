const { source, dayMeta, stages, performances } = window.JERA_TIMETABLE;

const storageKey = "jera-favorite-artists";
const stageColors = {
  Eagle: "#f2d35f",
  Vulture: "#f05c4f",
  Buzzard: "#5ed6d1",
  Hawk: "#79d27c",
  Sparrow: "#d78df0",
  Raven: "#9ca3ff",
};

const state = {
  view: "all",
  day: "THU",
  query: "",
  stage: "all",
  favorites: loadFavorites(),
};

const elements = {
  dayTabs: document.querySelector("[data-day-tabs]"),
  search: document.querySelector("[data-search]"),
  stageFilter: document.querySelector("[data-stage-filter]"),
  summaryKicker: document.querySelector("[data-summary-kicker]"),
  summaryTitle: document.querySelector("[data-summary-title]"),
  summaryDetail: document.querySelector("[data-summary-detail]"),
  timeline: document.querySelector("[data-timeline]"),
  favoriteCount: document.querySelector("[data-favorite-count]"),
  viewButtons: document.querySelectorAll("[data-view]"),
};

function loadFavorites() {
  try {
    return new Set(JSON.parse(localStorage.getItem(storageKey)) || []);
  } catch {
    return new Set();
  }
}

function saveFavorites() {
  localStorage.setItem(storageKey, JSON.stringify([...state.favorites]));
}

function minutes(time) {
  const [hours, mins] = time.split(":").map(Number);
  const value = hours * 60 + mins;
  return value < 12 * 60 ? value + 24 * 60 : value;
}

function durationLabel(performance) {
  const start = minutes(performance.start);
  let end = minutes(performance.end);

  if (end <= start) {
    end += 24 * 60;
  }

  return `${end - start} min`;
}

function isFavorite(performance) {
  return state.favorites.has(performance.artist);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dayPerformances() {
  return performances
    .filter((performance) => performance.day === state.day)
    .sort((a, b) => minutes(a.start) - minutes(b.start) || a.stage.localeCompare(b.stage));
}

function visiblePerformances() {
  const query = state.query.trim().toLowerCase();

  return dayPerformances().filter((performance) => {
    const matchesFavorites = state.view === "all" || isFavorite(performance);
    const matchesQuery =
      !query ||
      performance.artist.toLowerCase().includes(query) ||
      performance.stage.toLowerCase().includes(query);
    const matchesStage = state.stage === "all" || performance.stage === state.stage;

    return matchesFavorites && matchesQuery && matchesStage;
  });
}

function groupedByStart(rows) {
  return rows.reduce((groups, performance) => {
    const group = groups.get(performance.start) || [];
    group.push(performance);
    groups.set(performance.start, group);
    return groups;
  }, new Map());
}

function renderDayTabs() {
  elements.dayTabs.innerHTML = Object.entries(dayMeta)
    .map(
      ([day, meta]) => `
        <button
          class="day-tab ${state.day === day ? "active" : ""}"
          type="button"
          data-day="${day}"
          aria-pressed="${state.day === day}"
        >
          ${meta.shortLabel} <span>${meta.date}</span>
        </button>
      `,
    )
    .join("");
}

function renderStageOptions() {
  elements.stageFilter.innerHTML = [
    '<option value="all">Alle Bühnen</option>',
    ...stages.map((stage) => `<option value="${stage}">${stage}</option>`),
  ].join("");
}

function renderViewButtons() {
  elements.viewButtons.forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderSummary(rows) {
  const meta = dayMeta[state.day];
  const favoriteShows = dayPerformances().filter(isFavorite).length;
  const favoriteArtists = state.favorites.size;
  const sourceDate = new Date(`${source.fetchedAt}T00:00:00`).toLocaleDateString("de-DE");

  elements.favoriteCount.textContent = favoriteArtists;
  elements.summaryKicker.textContent =
    state.view === "favorites" ? "Personalisierter Timetable" : "Alle Artists";
  elements.summaryTitle.textContent =
    state.view === "favorites" ? `${meta.label}: deine Favoriten` : meta.label;
  elements.summaryDetail.textContent =
    state.view === "favorites"
      ? `${rows.length} von ${favoriteShows} Favoriten-Shows sichtbar`
      : `${rows.length} Shows aus ${source.name}, Stand ${sourceDate}`;
}

function performanceCard(performance) {
  const active = isFavorite(performance);
  const label = active
    ? `${performance.artist} aus Favoriten entfernen`
    : `${performance.artist} favorisieren`;
  const artist = escapeHtml(performance.artist);
  const stage = escapeHtml(performance.stage);
  const labelText = escapeHtml(label);

  return `
    <article class="performance-card" style="--stage-color: ${stageColors[performance.stage] || "#f2d35f"}">
      <div>
        <div class="performance-meta">
          <span class="stage-pill">${stage}</span>
          <span class="time-pill">${performance.start} - ${performance.end}</span>
          <span class="time-pill">${durationLabel(performance)}</span>
        </div>
        <h3 class="artist-name">${artist}</h3>
      </div>
      <button
        class="favorite-button ${active ? "active" : ""}"
        type="button"
        data-favorite="${artist}"
        aria-label="${labelText}"
        title="${labelText}"
      >
        ${active ? "★" : "☆"}
      </button>
    </article>
  `;
}

function emptyState() {
  if (state.view === "favorites" && state.favorites.size === 0) {
    return `
      <div class="empty-state">
        <strong>Noch keine Favoriten</strong>
        Markiere Artists im Gesamtplan mit dem Stern. Danach erscheint hier dein persönlicher Timetable.
      </div>
    `;
  }

  return `
    <div class="empty-state">
      <strong>Nichts gefunden</strong>
      Passe Suche, Tag oder Bühne an, um wieder Shows zu sehen.
      ${state.view === "favorites" ? '<br><button class="clear-button" type="button" data-clear-filters>Filter zurücksetzen</button>' : ""}
    </div>
  `;
}

function renderTimeline(rows) {
  if (!rows.length) {
    elements.timeline.innerHTML = emptyState();
    return;
  }

  elements.timeline.innerHTML = [...groupedByStart(rows)]
    .map(
      ([time, group]) => `
        <div class="slot-group">
          <div class="time-stamp">${time}</div>
          <div class="performance-list">
            ${group.map(performanceCard).join("")}
          </div>
        </div>
      `,
    )
    .join("");
}

function render() {
  const rows = visiblePerformances();
  renderDayTabs();
  renderViewButtons();
  renderSummary(rows);
  renderTimeline(rows);
}

elements.viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    render();
  });
});

elements.dayTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-day]");
  if (!button) return;

  state.day = button.dataset.day;
  render();
});

elements.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

elements.stageFilter.addEventListener("change", (event) => {
  state.stage = event.target.value;
  render();
});

elements.timeline.addEventListener("click", (event) => {
  const favoriteButton = event.target.closest("[data-favorite]");
  const clearFiltersButton = event.target.closest("[data-clear-filters]");

  if (favoriteButton) {
    const artist = favoriteButton.dataset.favorite;
    if (state.favorites.has(artist)) {
      state.favorites.delete(artist);
    } else {
      state.favorites.add(artist);
    }
    saveFavorites();
    render();
  }

  if (clearFiltersButton) {
    state.query = "";
    state.stage = "all";
    elements.search.value = "";
    elements.stageFilter.value = "all";
    render();
  }
});

renderStageOptions();
render();
