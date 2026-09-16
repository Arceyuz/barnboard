import type { Appointment, PersonId } from "./types.ts";

const LEAVE_MIN = 45;
const KIT_AHEAD_MIN = 25;

export type ArmedNote = {
  id: string;
  fireAt: number;
  title: string;
  body: string;
};

function parseStart(date: string, start: string): Date {
  const [h, m] = start.split(":").map((n) => Number(n) || 0);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

function bringLine(appt: Appointment): string {
  const kit = appt.kit;
  const bits = [...(kit?.equipment ?? []), ...(kit?.meds ?? [])];
  if (!bits.length) return "No extra kit listed.";
  return `Bring ${bits.join(", ")}`;
}

export function notesForDay(appointments: Appointment[], date: string, me: PersonId | null): ArmedNote[] {
  const mine = appointments
    .filter((a) => a.date === date)
    .filter((a) => {
      if (!me) return true;
      if (me === "alejandro") return a.vetId === "alejandro" || a.vetId === "weston";
      return a.vetId === me;
    })
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start));
  const out: ArmedNote[] = [];
  const first = mine[0];
  if (first) {
    const start = parseStart(first.date, first.start);
    out.push({
      id: `leave-${first.id}`,
      fireAt: start.getTime() - LEAVE_MIN * 60_000,
      title: "Leave in time",
      body: `First stop ${first.start} · ${first.title}. ${bringLine(first)}`,
    });
  }
  for (const appt of mine) {
    const start = parseStart(appt.date, appt.start);
    const hasKit = Boolean(appt.kit && (appt.kit.equipment.length || appt.kit.meds.length));
    if (!hasKit) continue;
    out.push({
      id: `kit-${appt.id}`,
      fireAt: start.getTime() - KIT_AHEAD_MIN * 60_000,
      title: `${appt.start} · ${appt.title}`,
      body: bringLine(appt),
    });
  }
  return out;
}

export async function requestNotifyPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

export function fireNote(note: ArmedNote) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(note.title, { body: note.body, tag: note.id });
  } catch {
    /* iOS Safari may require a service worker; in-app banner still shows */
  }
}
