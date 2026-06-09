const fs = require("fs");
const path = require("path");

const workspace = path.resolve(__dirname, "..");
const fetchedAt = process.env.TIMETABLE_FETCHED_AT || "2026-06-09";
const sourceFiles = {
  THU: "/private/tmp/jera_THU.html",
  FRI: "/private/tmp/jera_FRI.html",
  SAT: "/private/tmp/jera_SAT.html",
};

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

function minutes(time) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function sortMinutes(time) {
  const value = minutes(time);
  return value < 12 * 60 ? value + 24 * 60 : value;
}

function parseDay(html, day) {
  const lines = html.split(/\n/);
  const performances = [];
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

      performances.push({
        bandId,
        day,
        artist,
        stage,
        start,
        end,
        sort: sortMinutes(start),
      });

      inButton = false;
      button = "";
    }
  }

  return performances.sort(
    (a, b) => a.sort - b.sort || a.stage.localeCompare(b.stage),
  );
}

const seen = new Map();
const rows = Object.entries(sourceFiles).flatMap(([day, file]) =>
  parseDay(fs.readFileSync(file, "utf8"), day),
);

const performances = rows.map(({ sort, ...item }) => {
  const base = `${item.day}-${item.bandId}-${item.stage.toLowerCase()}-${item.start.replace(":", "")}`;
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);

  return {
    id: count ? `${base}-${count + 1}` : base,
    ...item,
  };
});
const stages = [...new Set(performances.map((performance) => performance.stage))];

const moduleText = `window.JERA_TIMETABLE = {
  source: {
    name: "Jera On Air 2026",
    url: "https://www.jeraonair.nl/de/timetable/",
    fetchedAt: "${fetchedAt}",
  },
  dayMeta: {
    THU: { label: "Donnerstag", shortLabel: "THU", date: "25.06.2026" },
    FRI: { label: "Freitag", shortLabel: "FRI", date: "26.06.2026" },
    SAT: { label: "Samstag", shortLabel: "SAT", date: "27.06.2026" },
  },
  stages: ${JSON.stringify(stages)},
  performances: ${JSON.stringify(performances, null, 2)}
};
`;

fs.writeFileSync(path.join(workspace, "src", "timetable-data.js"), moduleText);
console.log(`${performances.length} performances written to src/timetable-data.js`);
