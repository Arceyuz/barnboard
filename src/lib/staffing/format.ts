import { format, parseISO } from "date-fns";
import type { AttendanceStatus, ServiceKind } from "./types";

export function dayTitle(date: string): string {
  return format(parseISO(date), "EEEE, MMM d");
}

export function dayShort(date: string): string {
  return format(parseISO(date), "EEE d");
}

export function serviceLabel(kind: ServiceKind): string {
  if (kind === "surgery") return "Surgery";
  if (kind === "sports") return "Sports med";
  return "Field";
}

export function attendanceLabel(status: AttendanceStatus): string {
  const map: Record<AttendanceStatus, string> = {
    expected: "Expected",
    on_site: "On site",
    late: "Late",
    no_show: "No-show",
    call_out: "Call-out",
    left_early: "Left early",
    done: "Done",
  };
  return map[status];
}

export function coverageLabel(c: "covered" | "short" | "none"): string {
  if (c === "covered") return "Covered";
  if (c === "short") return "Short";
  return "None";
}
