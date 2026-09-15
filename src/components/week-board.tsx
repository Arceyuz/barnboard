import { RoleMark } from "@/components/role-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { doctorWorkLabel, dayTiny } from "@/lib/staffing/format";
import { personName, weekSummary } from "@/lib/staffing/scheduler";
import { coverageCounts, useStaffing } from "@/lib/staffing/store";
import { atNoon, todayInNy } from "@/lib/staffing/dates";
import type { CalendarSpan, DayPlan, Person, PersonId, Role, VetId } from "@/lib/staffing/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const SPANS: { id: CalendarSpan; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function openDay(date: string) {
  const s = useStaffing.getState();
  s.setDate(date);
  s.setView("day");
}

export function WeekBoard() {
  const weekDates = useStaffing((s) => s.weekDates);
  const plans = useStaffing((s) => s.plans);
  const staff = useStaffing((s) => s.staff);
  const selectedDate = useStaffing((s) => s.selectedDate);
  const span = useStaffing((s) => s.calendarSpan);
  const summary = weekSummary(plans, weekDates, staff);
  const surgeryDays = weekDates.filter((d) => plans[d]?.doctorWork.weston === "surgery");
  const title = rangeTitle(span, selectedDate, weekDates);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-muted">{title.kicker}</p>
          <h2 className="font-display text-3xl tracking-tight text-fg">{title.heading}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex gap-1">
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-border text-fg"
              onClick={() => useStaffing.getState().shiftRange(-1)}
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">Previous {span}</span>
            </button>
            <Button size="sm" variant="secondary" onClick={() => useStaffing.getState().goToday()}>
              Today
            </Button>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-border text-fg"
              onClick={() => useStaffing.getState().shiftRange(1)}
            >
              <ChevronRight className="size-4" />
              <span className="sr-only">Next {span}</span>
            </button>
          </span>
          <Button size="sm" className="sm:ml-auto" onClick={() => useStaffing.getState().fillUsual()}>
            Fill from usual days
          </Button>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-surface p-1">
        {SPANS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => useStaffing.getState().setSpan(item.id)}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center rounded-md text-sm",
              span === item.id ? "bg-surface-2 text-fg" : "text-muted",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Legend />
      </div>

      {surgeryDays.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted">Surgery days</span>
          {surgeryDays.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => openDay(d)}
              className="min-h-11 rounded-sm border border-danger/40 bg-danger/10 px-3 text-sm text-danger"
            >
              {format(atNoon(d), "EEE d")}
            </button>
          ))}
        </div>
      )}

      {span === "day" && <DaySpan date={selectedDate} />}
      {span === "week" && <WeekSpan dates={weekDates} selectedDate={selectedDate} />}
      {span === "month" && <MonthSpan dates={weekDates} selectedDate={selectedDate} />}

      {summary && <p className="text-sm text-muted">{span === "month" ? "This month" : span === "day" ? "This day" : "This week"}: {summary}</p>}

      <section className="space-y-2">
        <h3 className="text-xs tracking-[0.16em] uppercase text-muted">Needs attention</h3>
        {weekDates.flatMap((d) =>
          (plans[d]?.warnings ?? [])
            .filter((w) => w.severity === "warn" || w.severity === "block")
            .map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => openDay(d)}
                className="flex min-h-11 w-full items-center gap-3 rounded-md border-l-4 border-warn bg-surface px-3 text-left text-sm"
              >
                <span className="w-10 text-xs uppercase text-muted">{dayTiny(d)}</span>
                <span className="text-fg">{w.text}</span>
              </button>
            )),
        )}
      </section>
    </div>
  );
}

function rangeTitle(span: CalendarSpan, selected: string, dates: string[]) {
  if (span === "day") {
    return {
      kicker: format(atNoon(selected), "EEEE").toUpperCase(),
      heading: format(atNoon(selected), "MMMM d"),
    };
  }
  if (span === "week") {
    const start = dates[0] ?? selected;
    const end = dates[dates.length - 1] ?? selected;
    return {
      kicker: "Week of",
      heading: `${format(atNoon(start), "MMM d")} – ${format(atNoon(end), "MMM d")}`,
    };
  }
  const monthKey = dominantMonth(dates) || selected.slice(0, 7);
  return {
    kicker: "Month",
    heading: format(atNoon(`${monthKey}-01`), "MMMM yyyy"),
  };
}

function dominantMonth(dates: string[]): string {
  const counts = new Map<string, number>();
  for (const d of dates) {
    const key = d.slice(0, 7);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = dates[0]?.slice(0, 7) ?? "";
  let n = 0;
  for (const [k, v] of counts) {
    if (v > n) {
      best = k;
      n = v;
    }
  }
  return best;
}

function DaySpan({ date }: { date: string }) {
  const plan = useStaffing((s) => s.plans[date]);
  const appointments = useStaffing((s) => s.appointments);
  const stops = appointments.filter((a) => a.date === date).length;
  const counts = plan ? coverageCounts(plan) : null;
  const surgery = plan?.doctorWork.weston === "surgery";

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Coverage snapshot · open duties for the checklist</p>
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {surgery && <Badge tone="danger">Surgery</Badge>}
          <span className="text-sm text-muted">
            {stops} stop{stops === 1 ? "" : "s"}
          </span>
          {counts && counts.checks > 0 && <Badge tone="warn">Check · {counts.checks}</Badge>}
        </div>
        <CoverageBlock date={date} />
      </div>
      <Button className="w-full sm:w-auto" onClick={() => openDay(date)}>
        Open duties
      </Button>
    </div>
  );
}

function WeekSpan({ dates, selectedDate }: { dates: string[]; selectedDate: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">Tap a day to open duties</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {dates.map((d) => (
          <DayCard key={d} date={d} selected={d === selectedDate} />
        ))}
      </div>
    </div>
  );
}

function DayCard({ date, selected }: { date: string; selected: boolean }) {
  const plan = useStaffing((s) => s.plans[date]);
  const appointments = useStaffing((s) => s.appointments);
  const stops = appointments.filter((a) => a.date === date).length;
  const surgery = plan?.doctorWork.weston === "surgery";
  const checks = plan ? coverageCounts(plan).checks : 0;

  return (
    <button
      type="button"
      onClick={() => openDay(date)}
      className={cn(
        "min-h-11 rounded-lg border bg-surface p-3 text-left",
        selected ? "border-accent bg-accent/10" : "border-border",
      )}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">{dayTiny(date)}</p>
          <p className="font-display text-xl tracking-tight text-fg">{format(atNoon(date), "MMM d")}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {surgery && <Badge tone="danger">Surgery</Badge>}
          {checks > 0 && <Badge tone="warn">Check · {checks}</Badge>}
        </div>
      </div>
      <p className="mb-3 text-xs text-muted">
        {stops} stop{stops === 1 ? "" : "s"}
      </p>
      <CoverageBlock date={date} compact />
    </button>
  );
}

function MonthSpan({ dates, selectedDate }: { dates: string[]; selectedDate: string }) {
  const plans = useStaffing((s) => s.plans);
  const appointments = useStaffing((s) => s.appointments);
  const monthKey = dominantMonth(dates);
  const today = todayInNy();

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Tap a day to select it · open duties from the snapshot</p>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-6 bg-surface-2">
          {WEEKDAYS.map((d) => (
            <p key={d} className="px-1 py-2 text-center text-xs uppercase tracking-wider text-muted">
              {d}
            </p>
          ))}
        </div>
        <div className="grid grid-cols-6">
          {dates.map((d) => {
            const outside = d.slice(0, 7) !== monthKey;
            const surgery = plans[d]?.doctorWork.weston === "surgery";
            const stops = appointments.filter((a) => a.date === d).length;
            const checks = plans[d] ? coverageCounts(plans[d]!).checks : 0;
            const isSelected = d === selectedDate;
            const isToday = d === today;
            return (
              <button
                key={d}
                type="button"
                onClick={() => useStaffing.getState().setDate(d)}
                className={cn(
                  "flex min-h-20 flex-col border-t border-r border-border px-1 py-2 text-left",
                  isSelected && "bg-accent/15",
                  outside && "text-subtle",
                )}
              >
                <span
                  className={cn(
                    "block text-sm tabular-nums",
                    isToday && "font-semibold text-accent",
                    isSelected && "text-fg",
                    outside && "text-subtle",
                  )}
                >
                  {format(atNoon(d), "d")}
                </span>
                {surgery && <span className="mt-1 block text-xs text-danger">SX</span>}
                {stops > 0 && (
                  <span className="mt-0.5 block text-xs tabular-nums text-muted">{stops}</span>
                )}
                {checks > 0 && (
                  <span className="mt-1 block size-1.5 rounded-sm bg-warn" title="Needs attention" />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted">{dayTiny(selectedDate)}</p>
            <p className="font-display text-xl tracking-tight text-fg">
              {format(atNoon(selectedDate), "MMMM d")}
            </p>
          </div>
          <Button size="sm" onClick={() => openDay(selectedDate)}>
            Open duties
          </Button>
        </div>
        <CoverageBlock date={selectedDate} />
      </div>
    </div>
  );
}

function CoverageBlock({ date, compact = false }: { date: string; compact?: boolean }) {
  const plan = useStaffing((s) => s.plans[date]);
  const staff = useStaffing((s) => s.staff);
  const doctors = useStaffing((s) => s.doctors);
  if (!plan) {
    return <p className="text-sm text-muted">No coverage yet</p>;
  }
  const alejandro = plan.assignments.find((a) => a.vetId === "alejandro");
  const alejandroStops = alejandro?.appointmentIds.length ?? 0;
  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      {doctors.map((doc) => (
        <CoverageRow
          key={doc.vetId}
          vetId={doc.vetId}
          label={doc.label}
          plan={plan}
          staff={staff}
          compact={compact}
        />
      ))}
      {alejandroStops > 0 && (
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-fg", compact ? "text-xs" : "text-sm")}>Alejandro</p>
          <Chip role="primary" name={`${alejandroStops} own stop${alejandroStops === 1 ? "" : "s"}`} />
        </div>
      )}
      {!compact && <SupportLine plan={plan} staff={staff} />}
    </div>
  );
}

function CoverageRow({
  vetId,
  label,
  plan,
  staff,
  compact,
}: {
  vetId: VetId;
  label: string;
  plan: DayPlan;
  staff: Person[];
  compact: boolean;
}) {
  const asg = plan.assignments.find((a) => a.vetId === vetId);
  const work = plan.doctorWork[vetId];
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className={cn("text-fg", compact ? "text-xs" : "text-sm")}>{label}</p>
        {work !== "not_set" && (
          <p className={cn("text-xs", work === "surgery" ? "text-danger" : "text-muted")}>
            {doctorWorkLabel(work)}
          </p>
        )}
      </div>
      <div className="flex max-w-[60%] flex-wrap justify-end gap-1">
        {asg?.primaryId && <Chip role="primary" name={personName(asg.primaryId, staff)} />}
        {asg?.secondaryId && <Chip role="secondary" name={personName(asg.secondaryId, staff)} />}
        {!asg?.primaryId && !asg?.secondaryId && <p className="text-xs text-muted">—</p>}
      </div>
    </div>
  );
}

function SupportLine({ plan, staff }: { plan: DayPlan; staff: Person[] }) {
  const bits: string[] = [];
  const floats = plan.assignments
    .map((a) => a.floatId)
    .filter((id): id is PersonId => Boolean(id));
  for (const id of floats) bits.push(`${personName(id, staff)} float`);
  if (plan.officeId) bits.push(`${personName(plan.officeId, staff)} office`);
  for (const id of plan.onCallIds) bits.push(`${personName(id, staff)} on call`);
  if (plan.offIds.length) bits.push(`Off ${plan.offIds.map((id) => personName(id, staff)).join(", ")}`);
  if (!bits.length) return null;
  return <p className="pt-1 text-xs text-muted">{bits.join(" · ")}</p>;
}

function Legend() {
  const items: { role: Role; label: string }[] = [
    { role: "primary", label: "Primary" },
    { role: "secondary", label: "Secondary" },
    { role: "float", label: "Float" },
    { role: "office", label: "Office" },
    { role: "oncall", label: "On call" },
  ];
  return (
    <>
      {items.map((item) => (
        <span key={item.role} className="inline-flex items-center gap-2 text-xs text-muted">
          <RoleMark role={item.role} />
          {item.label}
        </span>
      ))}
    </>
  );
}

function Chip({ role, name }: { role: Role; name: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-surface-2 px-1.5 py-1 text-xs text-fg">
      <RoleMark role={role} className="size-5 text-[10px]" />
      {name}
    </span>
  );
}
