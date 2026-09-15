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
});

describe("makeDuties", () => {
  it("does not invent medical notes", () => {
    const plan = planDay("2026-09-15", [], undefined, { appointments: APPOINTMENTS });
    const blob = JSON.stringify(makeDuties("2026-09-15", plan.assignments, APPOINTMENTS));
    assert.ok(!blob.includes("MEDICAL"));
  });
});
