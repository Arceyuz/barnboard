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

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const today = ymdInNy(now);
  const dow = new Date(`${today}T12:00:00`).getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = addDays(today, mondayOffset);
  return [0, 1, 2, 3, 4, 5].map((i) => addDays(monday, i));
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
