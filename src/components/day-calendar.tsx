import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { vetName } from "@/lib/staffing/scheduler";
import { useStaffing } from "@/lib/staffing/store";
import { addWorkingDays, focusDate, skipSunday } from "@/lib/staffing/dates";
import { dayLong, monthDay, serviceLabel } from "@/lib/staffing/format";
import { kitEmpty } from "@/lib/staffing/kit";

export function DayCalendar() {
  const selectedDate = useStaffing((s) => s.selectedDate);
  const appointments = useStaffing((s) => s.appointments);
  const doctors = useStaffing((s) => s.doctors);
  const appts = appointments
    .filter((a) => a.date === selectedDate)
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));

  const jump = (delta: number) => {
    useStaffing.getState().setDate(addWorkingDays(selectedDate, delta));
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-muted">{dayLong(selectedDate)}</p>
          <h2 className="font-display text-3xl tracking-tight text-fg">{monthDay(selectedDate)}</h2>
          <p className="mt-1 text-sm text-muted">
            {appts.length} {appts.length === 1 ? "appointment" : "appointments"} on the calendar
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="ml-auto flex gap-1">
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-border text-sm text-fg"
              onClick={() => jump(-1)}
            >
              <ChevronLeft className="size-4" />
            </button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => useStaffing.getState().setDate(skipSunday(focusDate(), 1))}
            >
              Today
            </Button>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-border text-sm text-fg"
              onClick={() => jump(1)}
            >
              <ChevronRight className="size-4" />
            </button>
          </span>
        </div>
      </div>

      {appts.length === 0 ? (
        <p className="rounded-md border border-border bg-surface px-3 py-4 text-sm text-muted">
          No appointments on this date.
        </p>
      ) : (
        <ol className="relative space-y-0 border-l border-border pl-4">
          {appts.map((a) => (
            <li key={a.id} className="relative pb-4">
              <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-accent" />
              <p className="text-xs tracking-[0.08em] text-muted">
                {a.start}–{a.end}
              </p>
              <p className="mt-1 text-sm text-fg">{a.title}</p>
              <p className="text-xs text-muted">
                {a.vetId === "unknown" ? "Doctor?" : `${serviceLabel(a.service)} \u00b7 ${vetName(a.vetId, doctors)}`}
                {a.location && a.location !== "Location TBD" ? ` \u00b7 ${a.location}` : ""}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {a.colorLabel && a.colorLabel !== a.vetId && (
                  <Badge tone="mute">{a.colorLabel}</Badge>
                )}
                {!kitEmpty(a.kit) && a.kit?.equipment.map((item) => (
                  <Badge key={item} tone="ok">
                    {item}
                  </Badge>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
