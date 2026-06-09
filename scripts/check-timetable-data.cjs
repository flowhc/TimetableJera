const fs = require("fs");
const vm = require("vm");

const sourceFiles = {
  THU: "/private/tmp/jera_THU.html",
  FRI: "/private/tmp/jera_FRI.html",
  SAT: "/private/tmp/jera_SAT.html",
};

const ignoredSourceRows = [
  {
    day: "SAT",
    bandId: "60",
    artist: "End It",
    stage: "Buzzard",
    start: "17:00",
    end: "17:50",
    reason: "Duplicate CMS row overlapping Doodseskader; End It also has the 19:00 slot.",
  },
];

function matchesIgnoredSourceRow(row, ignored) {
  return (
    row.day === ignored.day &&
    row.bandId === ignored.bandId &&
    row.artist === ignored.artist &&
    row.stage === ignored.stage &&
    row.start === ignored.start &&
    row.end === ignored.end
  );
}

function splitIgnoredSourceRows(rows) {
  return rows.reduce(
    (result, row) => {
      const ignored = ignoredSourceRows.find((ignoredRow) =>
        matchesIgnoredSourceRow(row, ignoredRow),
      );

      if (ignored) {
        result.ignored.push({ ...row, reason: ignored.reason });
      } else {
        result.kept.push(row);
      }

      return result;
    },
    { kept: [], ignored: [] },
  );
}

function clean(text) {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function parseSourceFile(file, day) {
  const lines = fs.readFileSync(file, "utf8").split(/\n/);
  const rows = [];
  let stage = "";
  let inButton = false;
  let button = "";

  for (const line of lines) {
    const stageMatch = line.match(/<div class="stage-row\s+([^"\s]+)"/);
    if (stageMatch) {
      stage = stageMatch[1][0].toUpperCase() + stageMatch[1].slice(1);
    }

    if (line.includes('<button class="performance')) {
      inButton = true;
      button = `${line}\n`;
    } else if (inButton) {
      button += `${line}\n`;
    }

    if (inButton && line.includes("</button>")) {
      const bandId = button.match(/data-band="([^"]+)"/)?.[1];
      const artist = clean(
        button.match(/<span class="band-name">([\s\S]*?)<\/span>/)?.[1] || "",
      );
      const range = clean(
        button.match(/<span class="time-range">([\s\S]*?)<\/span>/)?.[1] || "",
      ).replace(/\s*-\s*/g, " - ");
      const [start, end] = range.split(" - ").map((part) => part.trim());

      if (!bandId || !artist || !stage || !start || !end) {
        throw new Error(`Could not parse performance for ${day}: ${button.slice(0, 160)}`);
      }

      rows.push({ day, bandId, artist, stage, start, end });
      inButton = false;
      button = "";
    }
  }

  return rows;
}

function loadCurrentData() {
  const context = { window: {} };
  const code = fs.readFileSync("src/timetable-data.js", "utf8");
  vm.runInNewContext(code, context);
  return context.window.JERA_TIMETABLE.performances.map(({ id, ...row }) => row);
}

function addOccurrenceKeys(rows) {
  const seen = new Map();

  return rows.map((row) => {
    const base = `${row.day}|${row.bandId}|${row.artist}|${row.stage}`;
    const occurrence = (seen.get(base) || 0) + 1;
    seen.set(base, occurrence);
    return { ...row, key: `${base}|${occurrence}` };
  });
}

function countsByDay(rows) {
  return rows.reduce((counts, row) => {
    counts[row.day] = (counts[row.day] || 0) + 1;
    return counts;
  }, {});
}

const rawFresh = Object.entries(sourceFiles).flatMap(([day, file]) =>
  parseSourceFile(file, day),
);
const { kept: fresh, ignored } = splitIgnoredSourceRows(rawFresh);
const current = loadCurrentData();
const freshMap = new Map(addOccurrenceKeys(fresh).map((row) => [row.key, row]));
const currentMap = new Map(addOccurrenceKeys(current).map((row) => [row.key, row]));
const changes = [];

for (const [key, freshRow] of freshMap) {
  const currentRow = currentMap.get(key);
  if (!currentRow) {
    changes.push({ type: "missingInApp", fresh: freshRow });
    continue;
  }

  if (currentRow.start !== freshRow.start || currentRow.end !== freshRow.end) {
    changes.push({
      type: "timeMismatch",
      day: freshRow.day,
      artist: freshRow.artist,
      stage: freshRow.stage,
      bandId: freshRow.bandId,
      app: `${currentRow.start}-${currentRow.end}`,
      site: `${freshRow.start}-${freshRow.end}`,
    });
  }
}

for (const [key, currentRow] of currentMap) {
  if (!freshMap.has(key)) {
    changes.push({ type: "extraInApp", app: currentRow });
  }
}

console.log(
  JSON.stringify(
    {
      currentTotal: current.length,
      rawFreshTotal: rawFresh.length,
      freshTotal: fresh.length,
      currentCounts: countsByDay(current),
      freshCounts: countsByDay(fresh),
      ignoredSourceRows: ignored,
      changes,
    },
    null,
    2,
  ),
);
