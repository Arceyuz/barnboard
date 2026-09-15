import { STAFF } from "./seed.ts";
import { clockFromIso, dateFromIso, minutesBetween } from "./dates.ts";
import type { Appointment, PersonId, RosterDay, ServiceKind, VetId } from "./types.ts";

export type RawCalendarEvent = {
  event_id?: string;
  id?: string;
  summary?: string;
  title?: string;
  description?: string;
  location?: string;
  start_time?: string;
  end_time?: string;
  start?: string | { dateTime?: string; date?: string };
  end?: string | { dateTime?: string; date?: string };
  all_day?: boolean;
  status?: string;
};

export const PRACTICE_CALENDAR_ID =
  "6mqdrfigc0u3cv64bl0r5770vg@group.calendar.google.com";
export const PRACTICE_CALENDAR_NAME = "Appointments";

function asText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function startIso(e: RawCalendarEvent): string {
  if (typeof e.start_time === "string") return e.start_time;
  if (typeof e.start === "string") return e.start;
  if (e.start && typeof e.start === "object") {
    return e.start.dateTime || e.start.date || "";
  }
  return "";
}

function endIso(e: RawCalendarEvent): string {
  if (typeof e.end_time === "string") return e.end_time;
  if (typeof e.end === "string") return e.end;
  if (e.end && typeof e.end === "object") {
    return e.end.dateTime || e.end.date || "";
  }
  return "";
}

export function extractEventList(data: unknown): RawCalendarEvent[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as RawCalendarEvent[];
  if (typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  if (Array.isArray(o.events)) return o.events as RawCalendarEvent[];
  if (o.event && typeof o.event === "object") return [o.event as RawCalendarEvent];
  if (Array.isArray(o.items)) return o.items as RawCalendarEvent[];
  return [];
}

export function extractCalendars(data: unknown): { id: string; name: string; primary: boolean }[] {
  const root = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const list = Array.isArray(data)
    ? data
    : Array.isArray(root.calendars)
      ? root.calendars
      : Array.isArray(root.items)
        ? root.items
        : [];
  return (list as Record<string, unknown>[])
    .map((c) => ({
      id: asText(c.id),
      name: asText(c.summary_override) || asText(c.summary) || asText(c.name) || asText(c.id),
      primary: Boolean(c.primary),
    }))
    .filter((c) => c.id && !/holiday/i.test(c.name));
}

export function parseRoster(summary: string): PersonId[] {
  const s = summary.toLowerCase();
  const ids: PersonId[] = [];
  if (/\balice\b/.test(s)) ids.push("alice");
  if (/\balejandro\b|\balej\b|(^|[^a-z])ale([^a-z]|$)/.test(s) || /(^|[^a-z])aa([^a-z]|$)/.test(s)) {
    ids.push("alejandro");
  }
  if (/\bbecca\b/.test(s)) ids.push("becca");
  if (/\bkaycee\b|\bkayce\b/.test(s)) ids.push("kaycee");
  if (/\bkate\b/.test(s)) ids.push("kate");
  return STAFF.map((p) => p.id).filter((id) => ids.includes(id));
}

function isRosterEvent(title: string): boolean {
  return /teching/i.test(title) || /^(aa|ale|alej|alejandro)\s+tech\b/i.test(title);
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function firstProvider(blob: string): VetId | "unknown" {
  const match = blob.match(/provider:\s*(wd|sc|md)\b/i);
  if (!match) return "unknown";
  const code = match[1].toUpperCase();
  if (code === "WD") return "weston";
  if (code === "SC") return "sidney";
  return "michaela";
}

function detectVet(title: string, description: string): VetId | "unknown" {
  const fromNotes = firstProvider(description);
  if (fromNotes !== "unknown") return fromNotes;

  if (/^md\b|\bmd to\b/i.test(title) || /\bmichaela\b|\bdoole\b/i.test(title)) return "michaela";
  if (/^sc\b/i.test(title) || /\bsidney\b|\bchanutin\b/i.test(title)) return "sidney";
  if (/^wd\b/i.test(title) || /\bweston\b|\bdavis\b/i.test(title)) return "weston";
  if (/\bkj\/wd\b/i.test(title)) return "weston";
  return "unknown";
}

function detectService(title: string, description: string, vet: VetId | "unknown"): ServiceKind {
  const blob = `${title} ${description}`;
  if (/\bstanding sx\b|\bsurgery\b|\bsx\b|kissing spine|arthroscopy/i.test(blob)) return "surgery";
  if (vet === "weston") return "sports";
  return "field";
}

function shouldSkipTitle(title: string): boolean {
  return (
    /\b(to do|todo|eftps|payment|on call|gate code|card ending|sid off|show shift|calls\/paperwork)\b/i.test(
      title,
    ) ||
    /\breview .{0,40}schedule\b/i.test(title) ||
    /\bupdate susan\b/i.test(title) ||
    /\bcharge \$/i.test(title) ||
    /\bto look at\b/i.test(title) ||
    /\bgather\b.{0,40}\bsupplies\b/i.test(title) ||
    /^denmark\b/i.test(title)
  );
}

export function displayTitle(raw: string): string {
  return raw
    .replace(/[✔️✅⚠️•]/g, " ")
    .replace(/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g, " ")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, " ")
    .replace(/\b(?:card ending in|ending in)\s*\d{3,}\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function mapPracticeEvents(raw: RawCalendarEvent[]): {
  appointments: Appointment[];
  roster: RosterDay[];
  skipped: number;
} {
  const appointments: Appointment[] = [];
  const rosterByDate = new Map<string, PersonId[]>();
  const seen = new Set<string>();
  let skipped = 0;

  for (const e of raw) {
    const title = asText(e.summary) || asText(e.title);
    const description = stripHtml(asText(e.description));
    const start = startIso(e);
    const end = endIso(e);
    const id = asText(e.event_id) || asText(e.id) || `${start}-${title.slice(0, 24)}`;
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);

    if (!title || !start || e.status === "cancelled") {
      skipped += 1;
      continue;
    }
    if (e.all_day || /^\d{4}-\d{2}-\d{2}$/.test(start)) {
      skipped += 1;
      continue;
    }

    const date = dateFromIso(start);
    const tStart = clockFromIso(start);
    const tEnd = clockFromIso(end || start);

    if (isRosterEvent(title)) {
      const people = parseRoster(title);
      if (people.length) {
        const existing = rosterByDate.get(date) ?? [];
        rosterByDate.set(date, [...new Set([...existing, ...people])]);
      }
      continue;
    }

    if (shouldSkipTitle(title)) {
      skipped += 1;
      continue;
    }

    if (tStart < "06:00") {
      skipped += 1;
      continue;
    }

    if (tStart === tEnd || minutesBetween(start, end || start) < 10) {
      skipped += 1;
      continue;
    }

    if (minutesBetween(start, end || start) > 12 * 60) {
      skipped += 1;
      continue;
    }

    const vetId = detectVet(title, description);
    const service = detectService(title, description, vetId);
    const location = asText(e.location).trim() || "Location TBD";

    appointments.push({
      id,
      date,
      start: tStart,
      end: tEnd,
      title: displayTitle(title),
      location,
      vetId,
      service,
      colorLabel: vetId === "unknown" ? "Needs review" : vetId,
    });
  }

  const roster: RosterDay[] = [...rosterByDate.entries()].map(([date, personIds]) => ({
    date,
    personIds,
  }));

  appointments.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  return { appointments, roster, skipped };
}
