import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APPOINTMENTS } from "./seed.ts";
import { planDay } from "./scheduler.ts";
import { makeDuties } from "./duties.ts";

describe("Tuesday crew duties", () => {
  it("pairs Alejandro+Kaycee on Weston surgery and Becca on Sidney", () => {
    const plan = planDay("2026-09-15", [], undefined, { appointments: APPOINTMENTS });
    const weston = plan.assignments.find((a) => a.vetId === "weston");
    const sidney = plan.assignments.find((a) => a.vetId === "sidney");
    assert.equal(weston?.primaryId, "alejandro");
    assert.equal(weston?.secondaryId, "kaycee");
    assert.equal(sidney?.primaryId, "becca");
    assert.equal(plan.doctorWork.weston, "surgery");
    assert.equal(plan.doctorWork.sidney, "working");
    assert.ok(plan.offIds.includes("alice"));
  });

  it("does not pull Becca off Sidney on Monday when Kaycee is off", () => {
    const plan = planDay("2026-09-14", [], undefined, { appointments: APPOINTMENTS });
    const weston = plan.assignments.find((a) => a.vetId === "weston");
    const sidney = plan.assignments.find((a) => a.vetId === "sidney");
    assert.equal(weston?.primaryId, "alejandro");
    assert.equal(weston?.secondaryId, null);
    assert.equal(sidney?.primaryId, "becca");
    assert.equal(weston?.coverage, "short");
  });

  it("gives one-tech Sidney the secondary duties too", () => {
    const plan = planDay("2026-09-15", [], undefined, { appointments: APPOINTMENTS });
    const becca = plan.tasks.filter((t) => t.ownerId === "becca");
    assert.ok(becca.some((t) => t.label === "Radiographs and ultrasound"));
    assert.ok(becca.some((t) => t.label === "Jog horses"));
    assert.ok(becca.some((t) => t.label.startsWith("Restock")));
    const alejandro = plan.tasks.filter((t) => t.ownerId === "alejandro");
    assert.ok(alejandro.some((t) => t.label === "Sterile prep"));
    assert.ok(alejandro.some((t) => t.label === "Stage the surgery pack"));
    assert.equal(plan.tasks.length, 30);
  });

  it("adds the surgery pack when the day is marked surgery", () => {
    const plan = planDay("2026-09-14", [], undefined, { appointments: APPOINTMENTS });
    const monday = APPOINTMENTS.filter((a) => a.date === "2026-09-14");
    const withFlag = makeDuties("2026-09-14", plan.assignments, monday, { surgery: true });
    const without = makeDuties("2026-09-14", plan.assignments, monday);
    assert.ok(withFlag.some((t) => t.label === "Stage the surgery pack"));
    assert.ok(!without.some((t) => t.label === "Stage the surgery pack"));
  });

  it("keeps Alejandro on his own stops and flags overlap with Weston", () => {
    const appts = [
      {
        id: "sx",
        date: "2026-09-15",
        start: "09:00",
        end: "12:00",
        title: "Jazzy",
        location: "Hospital",
        vetId: "weston" as const,
        service: "surgery" as const,
        colorLabel: "Tomato",
      },
      {
        id: "vax",
        date: "2026-09-15",
        start: "09:30",
        end: "10:30",
        title: "Steele vax",
        location: "Field",
        vetId: "alejandro" as const,
        service: "tech" as const,
        colorLabel: "alejandro",
      },
    ];
    const overlap = planDay("2026-09-15", [], undefined, { appointments: appts });
    assert.equal(overlap.assignments.find((a) => a.vetId === "alejandro")?.primaryId, "alejandro");
    assert.ok(overlap.warnings.some((w) => /overlapping Dr\. Davis/.test(w.text)));

    const later = planDay("2026-09-15", [], undefined, {
      appointments: [
        appts[0]!,
        { ...appts[1]!, start: "13:30", end: "14:30" },
      ],
    });
    assert.ok(!later.warnings.some((w) => /overlapping Dr\. Davis/.test(w.text)));
    assert.equal(later.assignments.find((a) => a.vetId === "alejandro")?.appointmentIds.length, 1);
  });
});

describe("makeDuties", () => {
  it("does not invent medical notes", () => {
    const plan = planDay("2026-09-15", [], undefined, { appointments: APPOINTMENTS });
    const blob = JSON.stringify(makeDuties("2026-09-15", plan.assignments, APPOINTMENTS));
    assert.ok(!blob.includes("MEDICAL"));
  });
});
