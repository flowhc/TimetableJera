const fs = require("fs");
const path = require("path");

const workspace = path.resolve(__dirname, "..");
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
  const performances = [];
  const rowRegex =
    /<div class="stage-row\s+([^"\s]+)"[\s\S]*?style="[^"]*">([\s\S]*?)<\/div>\s*(?=<div class="stage-row|<\/div>\s*<\/div>\s*<\/div>)/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(html))) {
    const stage = rowMatch[1][0].toUpperCase() + rowMatch[1].slice(1);
    const performanceRegex =
      /<button class="performance[^"]*"\s+style="([^"]+)"\s+data-band="([^"]+)">([\s\S]*?)<\/button>/g;
    let performanceMatch;

    while ((performanceMatch = performanceRegex.exec(rowMatch[2]))) {
      const body = performanceMatch[3];
      const bandMatch = body.match(/<span class="band-name">([\s\S]*?)<\/span>/);
      const timeMatch = body.match(/<span class="time-range">([\s\S]*?)<\/span>/);

      if (!bandMatch || !timeMatch) {
        continue;
      }

      const artist = clean(bandMatch[1]);
      const range = clean(timeMatch[1]).replace(/\s*-\s*/g, " - ");
      const [start, end] = range.split(" - ").map((part) => part.trim());

      performances.push({
        bandId: performanceMatch[2],
        day,
        artist,
        stage,
        start,
        end,
        sort: sortMinutes(start),
      });
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

const moduleText = `window.JERA_TIMETABLE = {
  source: {
    name: "Jera On Air 2026",
    url: "https://www.jeraonair.nl/de/timetable/",
    fetchedAt: "2026-06-03",
  },
  dayMeta: {
    THU: { label: "Donnerstag", shortLabel: "THU", date: "25.06.2026" },
    FRI: { label: "Freitag", shortLabel: "FRI", date: "26.06.2026" },
    SAT: { label: "Samstag", shortLabel: "SAT", date: "27.06.2026" },
  },
  stages: ["Eagle", "Vulture", "Buzzard", "Hawk", "Sparrow", "Raven"],
  performances: ${JSON.stringify(performances, null, 2)}
};
`;

fs.writeFileSync(path.join(workspace, "src", "timetable-data.js"), moduleText);
console.log(`${performances.length} performances written to src/timetable-data.js`);
