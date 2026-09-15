import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inferKit } from "./kit.ts";

describe("inferKit", () => {
  it("flags surgery pack on kissing spine and standing sx, not consults", () => {
    assert.ok(inferKit("Serda- Jazzy 7 site kissing spine").equipment.includes("Surgery pack"));
    assert.ok(inferKit("Gore- Gally standing sx", "Minor pack cuttery send off").equipment.includes("Surgery pack"));
    assert.ok(!inferKit("Cantu-Mia stifle catching/sx consult").equipment.includes("Surgery pack"));
  });

  it("reads bring-lists from the title without copying medical notes", () => {
    const saline = inferKit("Bring Saline✔️Zen- Rocky recheck");
    assert.ok(saline.meds.some((m) => /saline/i.test(m)));
    const laser = inferKit("Lake- lasers bring Lg Apoquel & Ertu");
    assert.ok(laser.equipment.includes("Laser"));
    assert.ok(laser.meds.some((m) => /apoquel/i.test(m)));
    const shock = inferKit("Bring meds Malnik- Charlie shockwave and laser");
    assert.ok(shock.equipment.includes("Shockwave"));
    assert.ok(shock.equipment.includes("Laser"));
    const notes = JSON.stringify(
      inferKit(
        "Helgstrand-Benny Repeat blocking",
        "Dee- 215-555-0100 MEDICAL NOTES History: Physical exam Provider: WD Drugs admin: 1.5ml xylazine",
      ),
    );
    assert.ok(!notes.includes("215"));
    assert.ok(!notes.includes("MEDICAL"));
    assert.ok(!notes.includes("xylazine"));
  });

  it("builds a PPE kit without dumping the rads anatomy list", () => {
    const kit = inferKit(
      "Weinwurm PPE- Kalika",
      "CBC/tox screen/coggins TAKE PHOTOS BEFORE SEDATION Rads: neck, back, knees, 4 feet",
    );
    assert.ok(kit.equipment.includes("PPE kit"));
    assert.ok(kit.equipment.includes("Camera"));
    assert.ok(kit.equipment.includes("Coggins"));
    assert.ok(kit.meds.includes("Blood tubes"));
    assert.ok(!JSON.stringify(kit).includes("knees"));
  });
});
