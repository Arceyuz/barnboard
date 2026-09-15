import type { Kit } from "./types.ts";

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const label = item.replace(/\s+/g, " ").trim();
    const key = label.toLowerCase();
    if (!label || label.length > 42 || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

function consultOnly(title: string): boolean {
  return /sx\s+consult|\bconsults?\b/i.test(title) && !/standing sx|kissing spine|arthroscopy/i.test(title);
}

const TITLE_EQUIP: Array<[RegExp, string]> = [
  [/kissing spine|standing sx|\bsurgery\b|\bsx\b|arthroscopy|minor pack/i, "Surgery pack"],
  [/shockwave/i, "Shockwave"],
  [/laser/i, "Laser"],
  [/\bfes\b/i, "FES"],
  [/\bprp\b|pro-?stride|\birap\b|biologic/i, "Biologics"],
  [/\brads?\b|radiograph/i, "Rads"],
  [/ultrasound/i, "Ultrasound"],
  [/\bblocks?\b|blocking/i, "Blocks"],
  [/\bppe\b|pre-purchase/i, "PPE kit"],
  [/coggins/i, "Coggins"],
  [/vax|vaccine|wewt|flu-?rhino|rabies/i, "Vaccines"],
  [/scope|endoscop/i, "Scope"],
  [/osphos/i, "Osphos"],
  [/noltrex|arthramid/i, "Joint injection"],
];

function bringChunks(title: string): string[] {
  const out: string[] = [];
  const matches = title.matchAll(/\bbring\s+([^✔️•|]+)/gi);
  for (const match of matches) {
    const chunk = (match[1] ?? "")
      .replace(/\bmalnik\b.*$/i, "")
      .replace(/\bzen-.*$/i, "")
      .trim();
    for (const part of chunk.split(/\s*(?:,|&| and )\s*/i)) {
      const clean = part.replace(/\b(lg|large)\b/i, "").replace(/[✔️]/g, "").trim();
      if (!clean || /^meds?$/i.test(clean)) continue;
      if (TITLE_EQUIP.some(([re]) => re.test(clean))) continue;
      out.push(clean);
    }
  }
  return out;
}

function kitText(title: string, description: string): string {
  const beforeNotes = description.split(/medical notes|history:/i)[0] ?? "";
  const beforeBilling = beforeNotes.split(/\bbilling\b/i)[0] ?? "";
  const services = description.match(/services:\s*([\s\S]*?)(?:drugs admin|drugs dispensed|medical notes|$)/i);
  return `${title}\n${beforeBilling.slice(0, 280)}\n${services?.[1] ?? ""}`;
}

export function inferKit(title: string, description = ""): Kit {
  const equipment: string[] = [];
  const meds: string[] = bringChunks(title);
  const blob = kitText(title, description);

  for (const [re, label] of TITLE_EQUIP) {
    if (label === "Surgery pack" && consultOnly(title)) continue;
    if (re.test(title) || (label !== "PPE kit" && re.test(blob))) equipment.push(label);
  }

  if (/minor pack/i.test(blob)) equipment.push("Surgery pack");

  const dispensed = description.match(/drugs dispensed:\s*([^\n|<]+)/i);
  if (dispensed) {
    const val = dispensed[1].trim();
    if (val && !/^none\b/i.test(val)) meds.push(val.split(/,/)[0].slice(0, 40));
  }

  if (/\bbring meds\b/i.test(title) && meds.length === 0) {
    meds.push("Meds on the truck");
  }

  if (/\bppe\b/i.test(title)) {
    equipment.push("PPE kit");
    if (/take photos|camera/i.test(description)) equipment.push("Camera");
    if (/coggins/i.test(description)) equipment.push("Coggins");
    if (/cbc|tox screen/i.test(description)) meds.push("Blood tubes");
  }

  return { equipment: uniq(equipment), meds: uniq(meds) };
}

export function kitEmpty(kit?: Kit): boolean {
  return !kit || (kit.equipment.length === 0 && kit.meds.length === 0);
}

export function kitLine(kit?: Kit): string {
  if (!kit) return "";
  return [...kit.equipment, ...kit.meds].join(" · ");
}
