import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clockFromIso, dateFromIso, dayWindows, rfcRangeForWeek } from "./dates.ts";

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
