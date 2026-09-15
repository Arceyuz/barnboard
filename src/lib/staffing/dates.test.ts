import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addWorkingDays,
  clockFromIso,
  dateFromIso,
  datesForSpan,
  dayWindows,
  fetchWindows,
  monthGridDates,
  rfcRangeForWeek,
  shiftAnchor,
  skipSunday,
  weekDatesFor,
} from "./dates.ts";

describe("week windows", () => {
  it("splits a Mon–Sat range into six New York days", () => {
    const range = rfcRangeForWeek([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
    ]);
    const windows = dayWindows(range.timeMin, range.timeMax);
    assert.equal(windows.length, 6);
    assert.equal(windows[0]?.timeMin.slice(0, 10), "2026-09-14");
    assert.equal(windows[5]?.timeMax.slice(0, 10), "2026-09-20");
    assert.match(range.timeMin, /[+-]\d{2}:\d{2}$/);
  });
});

describe("clock parsing", () => {
  it("keeps America/New_York wall time", () => {
    assert.equal(clockFromIso("2026-09-15T09:30:00-04:00"), "09:30");
    assert.equal(dateFromIso("2026-09-15T09:30:00-04:00"), "2026-09-15");
  });
});

describe("calendar spans", () => {
  it("builds Mon–Sat for a Tuesday", () => {
    assert.deepEqual(weekDatesFor("2026-09-15"), [
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
    ]);
  });

  it("maps Sunday to the prior Mon–Sat week", () => {
    assert.equal(weekDatesFor("2026-09-20")[0], "2026-09-14");
    assert.equal(skipSunday("2026-09-20", 1), "2026-09-21");
    assert.equal(skipSunday("2026-09-20", -1), "2026-09-19");
  });

  it("skips Sunday when stepping working days", () => {
    assert.equal(addWorkingDays("2026-09-19", 1), "2026-09-21");
    assert.equal(addWorkingDays("2026-09-21", -1), "2026-09-19");
  });

  it("builds a Mon–Sat September 2026 month grid with padding", () => {
    const grid = monthGridDates("2026-09-15");
    assert.equal(grid[0], "2026-08-31");
    assert.equal(grid[grid.length - 1], "2026-10-03");
    assert.equal(grid.length, 30);
    assert.ok(!grid.includes("2026-09-13"));
    assert.ok(!grid.includes("2026-09-20"));
    assert.ok(grid.includes("2026-09-14"));
    assert.ok(grid.includes("2026-09-19"));
  });

  it("returns one day, a week, or a month from datesForSpan", () => {
    assert.deepEqual(datesForSpan("day", "2026-09-15"), ["2026-09-15"]);
    assert.equal(datesForSpan("week", "2026-09-15").length, 6);
    assert.equal(datesForSpan("month", "2026-09-15").length, 30);
  });

  it("shifts day, week, and month anchors", () => {
    assert.equal(shiftAnchor("2026-09-15", "day", 1), "2026-09-16");
    assert.equal(shiftAnchor("2026-09-19", "day", 1), "2026-09-21");
    assert.equal(shiftAnchor("2026-09-15", "week", 1), "2026-09-22");
    assert.equal(shiftAnchor("2026-09-15", "month", 1), "2026-10-15");
    assert.equal(shiftAnchor("2026-01-31", "month", 1), "2026-02-28");
  });

  it("chunks a month range into week-sized fetch windows", () => {
    const range = rfcRangeForWeek(monthGridDates("2026-09-15"));
    const windows = fetchWindows(range.timeMin, range.timeMax);
    assert.ok(windows.length >= 4 && windows.length <= 6);
    assert.equal(windows[0]?.timeMin.slice(0, 10), "2026-08-31");
    assert.equal(windows[windows.length - 1]?.timeMax.slice(0, 10), "2026-10-04");
  });
});
