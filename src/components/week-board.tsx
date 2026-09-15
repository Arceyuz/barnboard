import { RoleMark } from "@/components/role-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { doctorWorkLabel, dayTiny } from "@/lib/staffing/format";
import { personName, vetName, weekSummary } from "@/lib/staffing/scheduler";
import { coverageCounts, useStaffing } from "@/lib/staffing/store";
import type { PersonId, Role, TeamKind, VetId } from "@/lib/staffing/types";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

export function WeekBoard() {
  const weekDates = useStaffing((s) => s.weekDates);
  const plans = useStaffing((s) => s.plans);
  const doctors = useStaffing((s) => s.doctors);
  const staff = useStaffing((s) => s.staff);
  const selectedDate = useStaffing((s) => s.selectedDate);
  const start = weekDates[0] ? format(parseISO(weekDates[0]), "MMMM d") : "";
  const summary = weekSummary(plans, weekDates, staff);
  const surgeryDays = weekDates.filter((d) => plans[d]?.doctorWork.weston === "surgery");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-muted">Week of</p>
          <h2 className="font-display text-3xl tracking-tight text-fg">{start}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => useStaffing.getState().fillUsual()}>
            Fill from usual days
          </Button>
          <Button size="sm" variant="secondary" disabled>
            <ChevronLeft className="size-4" />
            This week
            <ChevronRight className="size-4" />
          </Button>
        </div>
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
              onClick={() => {
                useStaffing.getState().setDate(d);
                useStaffing.getState().setView("day");
              }}
              className="min-h-11 rounded-full border border-danger/40 bg-danger/10 px-3 text-sm text-danger"
            >
              {format(parseISO(d), "EEE d")}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-muted">Tap a box to plan it · tap a day to see its duties</p>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-[720px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-2 text-left">
              <th className="sticky left-0 bg-surface-2 px-3 py-3 text-xs uppercase tracking-wider text-muted">
                Team
              </th>
              {weekDates.map((d) => (
                <th key={d} className="px-2 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      useStaffing.getState().setDate(d);
                      useStaffing.getState().setView("day");
                    }}
                    className={cn(
                      "min-h-11 w-full rounded-md px-2 text-left",
                      d === selectedDate ? "bg-accent/20 text-fg" : "text-fg",
                    )}
                  >
                    <span className="block text-xs uppercase tracking-wider text-muted">{dayTiny(d)}</span>
                    <span>{format(parseISO(d), "MMM d")}</span>
                    {plans[d] && coverageCounts(plans[d]).checks > 0 && (
                      <span className="mt-1 block text-[11px] text-warn">
                        Check · {coverageCounts(plans[d]).checks}
                      </span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doctors.map((doc) => (
              <tr key={doc.vetId} className="border-t border-border">
                <th className="sticky left-0 bg-bg px-3 py-3 text-left">
                  <p className="text-xs uppercase tracking-wider text-fg">{doc.label}</p>
                  <p className="text-xs text-muted">{doc.truck}</p>
                </th>
                {weekDates.map((d) => (
                  <td key={d} className="px-2 py-2 align-top">
                    <TeamCell date={d} vetId={doc.vetId} />
                  </td>
                ))}
              </tr>
            ))}
            <SlotRow label="Float" hint="Extra help" kind="float" dates={weekDates} />
            <SlotRow label="Office" hint="Not clinical coverage" kind="office" dates={weekDates} />
            <SlotRow label="On call" hint="Emergencies, no appointments" kind="oncall" dates={weekDates} />
            <tr className="border-t border-border">
              <th className="sticky left-0 bg-bg px-3 py-3 text-left">
                <p className="text-xs uppercase tracking-wider text-fg">Off</p>
                <p className="text-xs text-muted">Time off and days off</p>
              </th>
              {weekDates.map((d) => {
                const plan = plans[d];
                return (
                  <td key={d} className="px-2 py-2 align-top text-sm text-muted">
                    {plan?.offIds.length
                      ? plan.offIds.map((id) => <p key={id}>{personName(id, staff)}</p>)
                      : "—"}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {summary && <p className="text-sm text-muted">This week: {summary}</p>}

      <section className="space-y-2">
        <h3 className="text-xs tracking-[0.16em] uppercase text-muted">Needs attention</h3>
        {weekDates.flatMap((d) =>
          (plans[d]?.warnings ?? [])
            .filter((w) => w.severity === "warn" || w.severity === "block")
            .map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  useStaffing.getState().setDate(d);
                  useStaffing.getState().setView("day");
                }}
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

function TeamCell({ date, vetId }: { date: string; vetId: VetId }) {
  const plan = useStaffing((s) => s.plans[date]);
  const staff = useStaffing((s) => s.staff);
  const doctors = useStaffing((s) => s.doctors);
  if (!plan) return <span className="text-muted">—</span>;
  const asg = plan.assignments.find((a) => a.vetId === vetId);
  const work = plan.doctorWork[vetId];
  const techs = staff.filter((p) => p.kind !== "office");
  return (
    <div className="space-y-1">
      {work !== "not_set" && (
        <p className={cn("text-xs", work === "surgery" ? "text-danger" : "text-muted")}>
          {doctorWorkLabel(work)}
        </p>
      )}
      {asg?.primaryId && (
        <Chip role="primary" name={personName(asg.primaryId, staff)} />
      )}
      {asg?.secondaryId && (
        <Chip role="secondary" name={personName(asg.secondaryId, staff)} />
      )}
      {!asg?.primaryId && !asg?.secondaryId && <p className="text-muted">—</p>}
      <select
        className="mt-1 hidden min-h-11 w-full rounded-sm border border-border bg-bg px-2 text-xs text-fg sm:block"
        value=""
        onChange={(e) => {
          const value = e.target.value;
          if (!value) return;
          useStaffing.getState().setDate(date);
          const [role, id] = value.split(":") as [Role, PersonId];
          useStaffing.getState().place(vetId, role, id);
        }}
        aria-label={`Assign ${vetName(vetId, doctors)}`}
      >
        <option value="">Plan…</option>
        {techs.map((p) => (
          <option key={`p-${p.id}`} value={`primary:${p.id}`}>
            Primary · {p.name}
          </option>
        ))}
        {doctors.find((d) => d.vetId === vetId)?.needsTwo &&
          techs.map((p) => (
            <option key={`s-${p.id}`} value={`secondary:${p.id}`}>
              Secondary · {p.name}
            </option>
          ))}
      </select>
    </div>
  );
}

function SlotRow({
  label,
  hint,
  kind,
  dates,
}: {
  label: string;
  hint: string;
  kind: Extract<TeamKind, "float" | "office" | "oncall">;
  dates: string[];
}) {
  const plans = useStaffing((s) => s.plans);
  const staff = useStaffing((s) => s.staff);
  const role: Role = kind === "oncall" ? "oncall" : kind;
  return (
    <tr className="border-t border-border">
      <th className="sticky left-0 bg-bg px-3 py-3 text-left">
        <p className="text-xs uppercase tracking-wider text-fg">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </th>
      {dates.map((d) => {
        const plan = plans[d];
        const ids =
          kind === "office"
            ? plan?.officeId
              ? [plan.officeId]
              : []
            : kind === "oncall"
              ? plan?.onCallIds ?? []
              : (plan?.assignments.map((a) => a.floatId).filter((id): id is PersonId => Boolean(id)) ?? []);
        return (
          <td key={d} className="px-2 py-2 align-top">
            {ids.length ? (
              ids.map((id) =>
                id ? <Chip key={id} role={role} name={personName(id, staff)} /> : null,
              )
            ) : (
              <p className="text-muted">—</p>
            )}
          </td>
        );
      })}
    </tr>
  );
}

function Chip({ role, name }: { role: Role; name: string }) {
  return (
    <span className="mb-1 inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-1 text-xs text-fg">
      <RoleMark role={role} className="size-5 text-[10px]" />
      {name}
    </span>
  );
}


