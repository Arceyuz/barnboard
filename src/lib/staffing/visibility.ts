import type { Appointment, DayPlan, PersonId } from "./types.ts";

export type BoardScope = "mine" | "all";

export function isAuthor(me: PersonId | null): boolean {
  return me === "alejandro";
}

/** Stops this person is on: own tech calls or a team they are assigned to. */
export function stopIsMine(appt: Appointment, plan: DayPlan | undefined, me: PersonId | null): boolean {
  if (!me) return false;
  if (appt.vetId === me) return true;
  if (!plan) return appt.vetId === "alejandro" && me === "alejandro";
  return plan.assignments.some((asg) => {
    if (!asg.appointmentIds.includes(appt.id) && asg.vetId !== appt.vetId) return false;
    return asg.primaryId === me || asg.secondaryId === me || asg.floatId === me;
  });
}

export function visibleStops(
  appointments: Appointment[],
  date: string,
  plan: DayPlan | undefined,
  me: PersonId | null,
  scope: BoardScope,
): Appointment[] {
  const day = appointments
    .filter((a) => a.date === date)
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
  if (scope === "all" || !me) return day;
  return day.filter((a) => stopIsMine(a, plan, me));
}
