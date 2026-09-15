import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayTitle,
  extractCalendars,
  mapPracticeEvents,
  parseRoster,
} from "./calendar-map.ts";

describe("parseRoster", () => {
  it("reads the morning teching line", () => {
    assert.deepEqual(parseRoster("Ale, Becca, Kaycee teching"), [
      "alejandro",
      "becca",
      "kaycee",
    ]);
    assert.deepEqual(parseRoster("Alej, Becca, Kaycee teching"), [
      "alejandro",
      "becca",
      "kaycee",
    ]);
    assert.deepEqual(parseRoster("Ale teching"), ["alejandro"]);
    assert.deepEqual(parseRoster("AA tech"), ["alejandro"]);
  });
});

describe("displayTitle", () => {
  it("strips checkmarks, phones, and emails", () => {
    assert.equal(
      displayTitle("✔️King- Gambler  +18638736167  trainer@example.com"),
      "King- Gambler",
    );
  });
});

describe("extractCalendars", () => {
  it("hides holidays and prefers Appointments", () => {
    const calendars = extractCalendars({
      calendars: [
        { id: "hol", summary: "Holidays in United States", primary: false },
        {
          id: "6mqdrfigc0u3cv64bl0r5770vg@group.calendar.google.com",
          summary: "Appointments",
          primary: false,
        },
        { id: "me", summary: "arceyuzllc@gmail.com", primary: true },
      ],
    });
    assert.equal(calendars.length, 2);
    assert.equal(calendars[0]?.name, "Appointments");
  });
});

describe("mapPracticeEvents", () => {
  it("uses Provider lines, skips office, and never copies notes", () => {
    const mapped = mapPracticeEvents([
      {
        event_id: "tech",
        summary: "Ale, Becca, Kaycee teching",
        start_time: "2026-09-15T05:00:00-04:00",
        end_time: "2026-09-15T05:00:00-04:00",
      },
      {
        event_id: "todo",
        summary: "Tuesday To do:",
        start_time: "2026-09-15T07:00:00-04:00",
        end_time: "2026-09-15T08:00:00-04:00",
      },
      {
        event_id: "oncall",
        summary: "SC on call",
        start_time: "2026-09-15T07:00:00-04:00",
        end_time: "2026-09-15T08:00:00-04:00",
      },
      {
        event_id: "sidney",
        summary: "Wilberg- Hannah Montana lameness",
        description: "Provider: SC\nMEDICAL NOTES\nDo not show this.",
        location: "Parkland",
        start_time: "2026-09-15T09:30:00-04:00",
        end_time: "2026-09-15T13:30:00-04:00",
      },
      {
        event_id: "weston",
        summary: "Helgstrand-Benny Repeat blocking",
        description: "Provider: WD",
        location: "Wellington",
        start_time: "2026-09-14T09:00:00-04:00",
        end_time: "2026-09-14T11:00:00-04:00",
      },
      {
        event_id: "sx",
        summary: "Serda- Jazzy 7 site kissing spine",
        start_time: "2026-09-15T09:00:00-04:00",
        end_time: "2026-09-15T12:00:00-04:00",
      },
      {
        event_id: "md",
        summary: "Md to sedate lip for Valdo",
        description: "Provider: MD",
        location: "clinic",
        start_time: "2026-09-14T09:00:00-04:00",
        end_time: "2026-09-14T10:15:00-04:00",
      },
      {
        event_id: "denmark",
        summary: "Denmark",
        start_time: "2026-09-18T16:00:00-04:00",
        end_time: "2026-09-20T17:00:00-04:00",
      },
      {
        event_id: "sid-off",
        summary: "Sid off",
        start_time: "2026-09-16T08:00:00-04:00",
        end_time: "2026-09-16T09:00:00-04:00",
      },
    ]);

    assert.deepEqual(mapped.roster, [
      { date: "2026-09-15", personIds: ["alejandro", "becca", "kaycee"] },
    ]);

    const byId = Object.fromEntries(mapped.appointments.map((a) => [a.id, a]));
    assert.equal(byId.sidney?.vetId, "sidney");
    assert.equal(byId.weston?.vetId, "weston");
    assert.equal(byId.md?.vetId, "michaela");
    assert.equal(byId.sx?.vetId, "unknown");
    assert.equal(byId.sx?.service, "surgery");
    assert.equal(byId.sidney?.notes, undefined);
    assert.ok(!JSON.stringify(mapped.appointments).includes("MEDICAL"));
    assert.equal(byId.todo, undefined);
    assert.equal(byId.oncall, undefined);
    assert.equal(byId.denmark, undefined);
    assert.equal(byId["sid-off"], undefined);
  });
});
