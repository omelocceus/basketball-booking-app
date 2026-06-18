const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

function scheduleCountsFromSeed(filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  const rows = [...sql.matchAll(/\('([^']+)', '([^']+)'\)/g)];
  const weekdays = new Set([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
  ]);

  return rows.reduce((counts, row) => {
    const day = row[1];
    if (!weekdays.has(day)) return counts;

    counts[day] = (counts[day] || 0) + 1;
    return counts;
  }, {});
}

test("schema schedule seed matches real weekly availability", () => {
  assert.deepEqual(scheduleCountsFromSeed("db/schema.sql"), {
    Monday: 11,
    Tuesday: 11,
    Wednesday: 11,
    Thursday: 11,
    Friday: 9,
    Saturday: 9,
    Sunday: 9
  });
});

test("refresh schedule seed matches schema schedule seed", () => {
  assert.deepEqual(
    scheduleCountsFromSeed("db/seed-schedule.sql"),
    scheduleCountsFromSeed("db/schema.sql")
  );
});
