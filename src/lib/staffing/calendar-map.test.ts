import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  barnKey,
  displayTitle,
  extractCalendars,
  isSurgeryTitle,
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

describe("surgery titles", () => {
  it("treats kissing spine and standing sx as surgery, not consults", () => {
    assert.equal(isSurgeryTitle("Serda- Jazzy 7 site kissing spine"), true);
    assert.equal(isSurgeryTitle("Gore- Gally standing sx"), true);
    assert.equal(isSurgeryTitle("Cantu-Mia stifle catching/sx consult"), false);
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
    assert.deepEqual(mapped.doctorOff, [{ date: "2026-09-16", vetId: "sidney" }]);

    const byId = Object.fromEntries(mapped.appointments.map((a) => [a.id, a]));
    assert.equal(byId.sidney?.vetId, "sidney");
    assert.equal(byId.weston?.vetId, "weston");
    assert.equal(byId.md?.vetId, "michaela");
    assert.equal(byId.sx?.vetId, "weston");
    assert.equal(byId.sx?.service, "surgery");
    assert.equal(byId.sidney?.notes, undefined);
    assert.ok(!JSON.stringify(mapped.appointments).includes("MEDICAL"));
    assert.equal(byId.todo, undefined);
    assert.equal(byId.oncall, undefined);
    assert.equal(byId.denmark, undefined);
    assert.equal(byId["sid-off"], undefined);
  });

  it("uses calendar color when Provider is empty, and stays unknown without color", () => {
    const mapped = mapPracticeEvents([
      {
        event_id: "flamingo",
        summary: "Newclient- Splash lameness",
        colorId: "4",
        start_time: "2026-09-15T14:00:00-04:00",
        end_time: "2026-09-15T17:00:00-04:00",
      },
      {
        event_id: "peacock",
        summary: "Brown- Oliver sarcoid eval",
        color: "Peacock",
        start_time: "2026-09-16T09:00:00-04:00",
        end_time: "2026-09-16T09:30:00-04:00",
      },
      {
        event_id: "dooley",
        summary: "Sedate lip for Valdo",
        colorLabel: "Wisteria",
        start_time: "2026-09-14T09:00:00-04:00",
        end_time: "2026-09-14T10:15:00-04:00",
      },
      {
        event_id: "nocolor",
        summary: "Mystery- Horse recheck",
        start_time: "2026-09-15T13:30:00-04:00",
        end_time: "2026-09-15T14:30:00-04:00",
      },
      {
        event_id: "provider-wins",
        summary: "Wilberg lameness",
        description: "Provider: SC",
        colorId: "7",
        start_time: "2026-09-15T09:30:00-04:00",
        end_time: "2026-09-15T13:30:00-04:00",
      },
    ]);
    const byId = Object.fromEntries(mapped.appointments.map((a) => [a.id, a]));
    assert.equal(byId.flamingo?.vetId, "sidney");
    assert.equal(byId.peacock?.vetId, "weston");
    assert.equal(byId.dooley?.vetId, "michaela");
    assert.equal(byId.nocolor?.vetId, "unknown");
    assert.equal(byId["provider-wins"]?.vetId, "sidney");
  });

  it("tags Alejandro’s own stops from his name, not the morning teching line", () => {
    const mapped = mapPracticeEvents([
      {
        event_id: "tech",
        summary: "Alej, Becca, Kaycee teching",
        start_time: "2026-09-15T05:00:00-04:00",
        end_time: "2026-09-15T05:00:00-04:00",
      },
      {
        event_id: "mine",
        summary: "Alejandro — Steele vax and coggins",
        start_time: "2026-09-15T13:30:00-04:00",
        end_time: "2026-09-15T14:30:00-04:00",
      },
    ]);
    const byId = Object.fromEntries(mapped.appointments.map((a) => [a.id, a]));
    assert.equal(byId.tech, undefined);
    assert.equal(byId.mine?.vetId, "alejandro");
    assert.equal(byId.mine?.service, "tech");
  });

  it("auto-tags from AA, bring meds, barn names, and does not treat notes as surgery", () => {
    const mapped = mapPracticeEvents([
      {
        event_id: "aa",
        summary: "AA Rizvi- Hansel Osphos",
        start_time: "2026-09-16T14:00:00-04:00",
        end_time: "2026-09-16T15:00:00-04:00",
      },
      {
        event_id: "bring",
        summary: "Bring meds Malnik- Charlie shockwave and laser",
        start_time: "2026-09-15T11:00:00-04:00",
        end_time: "2026-09-15T12:00:00-04:00",
      },
      {
        event_id: "renier",
        summary: "Renier-Kensington recheck/flex",
        start_time: "2026-09-15T08:00:00-04:00",
        end_time: "2026-09-15T09:00:00-04:00",
      },
      {
        event_id: "dooley",
        summary: "Ferrier- Clint (Gilday) recheck cellulitis",
        start_time: "2026-09-15T16:45:00-04:00",
        end_time: "2026-09-15T17:45:00-04:00",
      },
      {
        event_id: "wilberg",
        summary: "Wilberg- Hannah Montana lameness",
        description: "Provider: SC\nMEDICAL NOTES\nShe's potentially interested in surgery. kissing spine.",
        start_time: "2026-09-15T09:30:00-04:00",
        end_time: "2026-09-15T13:30:00-04:00",
      },
      {
        event_id: "call",
        summary: "Call Jacob, check WhatsApp video",
        start_time: "2026-09-14T18:00:00-04:00",
        end_time: "2026-09-14T18:30:00-04:00",
      },
    ]);
    const byId = Object.fromEntries(mapped.appointments.map((a) => [a.id, a]));
    assert.equal(byId.aa?.vetId, "alejandro");
    assert.equal(byId.bring?.vetId, "alejandro");
    assert.equal(byId.renier?.vetId, "weston");
    assert.equal(byId.dooley?.vetId, "michaela");
    assert.equal(byId.wilberg?.vetId, "sidney");
    assert.equal(byId.wilberg?.service, "field");
    assert.equal(byId.call, undefined);
    assert.equal(isSurgeryTitle("Wilberg- Hannah Montana lameness"), false);
    assert.equal(barnKey("✔️Steele-lil bit vax and coggins"), "steele|lil");
    assert.equal(barnKey("Steele- Shrek and Fiona vaccines"), "steele|shrek");
    assert.equal(barnKey("Ferrier/Gilday- Clint recheck"), "ferrier|clint");
  });
});
