import { format, parseISO } from "date-fns";
import type { AttendanceStatus, DoctorWork, Role, ServiceKind } from "./types";

export function dayTitle(date: string): string {
  return format(parseISO(date), "EEEE, MMM d");
}

export function dayLong(date: string): string {
  return format(parseISO(date), "EEEE").toUpperCase();
}

export function monthDay(date: string): string {
  return format(parseISO(date), "MMMM d, yyyy").toUpperCase();
}

export function dayShort(date: string): string {
  return format(parseISO(date), "EEE d");
}

export function dayTiny(date: string): string {
  return format(parseISO(date), "EEE");
}

export function serviceLabel(kind: ServiceKind): string {
  if (kind === "surgery") return "Surgery";
  if (kind === "sports") return "Sports med";
  if (kind === "tech") return "Alejandro";
  return "Field";
}

export function doctorWorkLabel(work: DoctorWork): string {
  if (work === "surgery") return "Surgery";
  if (work === "sports") return "Sports medicine";
  if (work === "working") return "Working";
  if (work === "off") return "Off";
  return "not set";
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

export function roleLetter(role: Role): string {
  if (role === "primary") return "P";
  if (role === "secondary") return "S";
  if (role === "float") return "F";
  if (role === "oncall") return "C";
  return "O";
}

export function roleLabel(role: Role): string {
  if (role === "primary") return "Primary";
  if (role === "secondary") return "Secondary";
  if (role === "float") return "Float";
  if (role === "oncall") return "On call";
  return "Office";
}
