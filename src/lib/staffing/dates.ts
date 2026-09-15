import type { CalendarSpan } from "./types";

function ymdInNy(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function hourInNy(date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hourCycle: "h23",
    }).format(date),
  );
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function atNoon(ymd: string): Date {
  return new Date(`${ymd}T12:00:00`);
}

export function weekday(ymd: string): number {
  return new Date(`${ymd}T12:00:00`).getDay();
}

export function skipSunday(ymd: string, dir: 1 | -1 = 1): string {
  return weekday(ymd) === 0 ? addDays(ymd, dir) : ymd;
}

export function addWorkingDays(ymd: string, days: number): string {
  if (days === 0) return skipSunday(ymd, 1);
  const step = days > 0 ? 1 : -1;
  let left = Math.abs(days);
  let cursor = ymd;
  while (left > 0) {
    cursor = addDays(cursor, step);
    if (weekday(cursor) !== 0) left -= 1;
  }
  return cursor;
}

export function addMonths(ymd: string, months: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Monday–Saturday of the week that contains `ymd` (Sunday maps to the prior week). */
export function weekDatesFor(ymd: string): string[] {
  const dow = weekday(ymd);
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = addDays(ymd, mondayOffset);
  return [0, 1, 2, 3, 4, 5].map((i) => addDays(monday, i));
}

function monthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

/** Mon–Sat cells for the month of `ymd`, including adjacent-month padding. */
export function monthGridDates(ymd: string): string[] {
  const start = monthStart(ymd);
  const last = addDays(addMonths(start, 1), -1);
  const firstMonday = weekDatesFor(start)[0] ?? start;
  const lastSaturday = weekDatesFor(last)[5] ?? last;
  const dates: string[] = [];
  let cursor = firstMonday;
  while (cursor <= lastSaturday) {
    if (weekday(cursor) !== 0) dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function datesForSpan(span: CalendarSpan, ymd: string): string[] {
  const day = skipSunday(ymd, 1);
  if (span === "day") return [day];
  if (span === "week") return weekDatesFor(day);
  return monthGridDates(day);
}

export function shiftAnchor(ymd: string, span: CalendarSpan, delta: number): string {
  if (span === "day") return addWorkingDays(ymd, delta);
  if (span === "week") return skipSunday(addDays(ymd, 7 * delta), 1);
  return skipSunday(addMonths(ymd, delta), 1);
}

function nyOffset(ymd: string): string {
  const probe = new Date(`${ymd}T16:00:00Z`);
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "longOffset",
  }).format(probe);
  const match = formatted.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return "-04:00";
  const hh = match[2].padStart(2, "0");
  const mm = (match[3] ?? "00").padStart(2, "0");
  return `${match[1]}${hh}:${mm}`;
}

function midnightRfc(ymd: string): string {
  return `${ymd}T00:00:00${nyOffset(ymd)}`;
}

/** Monday–Saturday of the current America/New_York week. */
export function currentWeekDates(now = new Date()): string[] {
  return weekDatesFor(ymdInNy(now));
}

export function todayInNy(now = new Date()): string {
  return ymdInNy(now);
}

export function focusDate(now = new Date()): string {
  const today = ymdInNy(now);
  if (hourInNy(now) >= 18) return addDays(today, 1);
  return today;
}

export function rfcRangeForWeek(dates: string[]): { timeMin: string; timeMax: string } {
  const start = dates[0] ?? ymdInNy();
  const last = dates[dates.length - 1] ?? start;
  const end = addDays(last, 1);
  return {
    timeMin: midnightRfc(start),
    timeMax: midnightRfc(end),
  };
}

/** One window per calendar day so a busy week is not truncated at 100 events. */
export function dayWindows(timeMin: string, timeMax: string): { timeMin: string; timeMax: string }[] {
  const start = timeMin.slice(0, 10);
  const endExclusive = timeMax.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(endExclusive)) {
    return [{ timeMin, timeMax }];
  }
  const windows: { timeMin: string; timeMax: string }[] = [];
  let cursor = start;
  while (cursor < endExclusive) {
    const next = addDays(cursor, 1);
    windows.push({ timeMin: midnightRfc(cursor), timeMax: midnightRfc(next) });
    cursor = next;
  }
  return windows.length ? windows : [{ timeMin, timeMax }];
}

export function chunkWindows(
  windows: { timeMin: string; timeMax: string }[],
  size: number,
): { timeMin: string; timeMax: string }[] {
  if (windows.length <= size) return windows;
  const chunks: { timeMin: string; timeMax: string }[] = [];
  for (let i = 0; i < windows.length; i += size) {
    const slice = windows.slice(i, i + size);
    const first = slice[0];
    const last = slice[slice.length - 1];
    if (!first || !last) continue;
    chunks.push({ timeMin: first.timeMin, timeMax: last.timeMax });
  }
  return chunks.length ? chunks : windows;
}

export function fetchWindows(timeMin: string, timeMax: string): { timeMin: string; timeMax: string }[] {
  const days = dayWindows(timeMin, timeMax);
  if (days.length <= 8) return days;
  return chunkWindows(days, 7);
}

export function clockFromIso(iso: string): string {
  const parsed = new Date(iso);
  if (!Number.isNaN(parsed.getTime())) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(parsed);
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  }
  const match = iso.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "00:00";
}

export function dateFromIso(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const parsed = new Date(iso);
  if (!Number.isNaN(parsed.getTime())) return ymdInNy(parsed);
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : ymdInNy();
}

export function minutesBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return (end - start) / 60000;
}
