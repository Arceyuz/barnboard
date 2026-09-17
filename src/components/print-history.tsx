import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStaffing } from "@/lib/staffing/store";
import { dayLong, monthDay } from "@/lib/staffing/format";
import type { Appointment } from "@/lib/staffing/types";

type Row = {
  id: string;
  start: string;
  end: string;
  owner: string;
  horse: string;
  title: string;
  location: string;
};

function parsePatient(title: string): { owner: string; horse: string } {
  const clean = title.replace(/\s+/g, " ").trim();
  const parts = clean.split(/\s+[—–-]\s+/);
  if (parts.length >= 2) {
    const owner = parts[0].trim();
    const rest = parts.slice(1).join(" — ").trim();
    const horse = rest.split(/\s+[:(]| \d|-site| standing| kissing| shockwave| PPE| lameness| lasers/i)[0].trim();
    return { owner, horse: horse || rest };
  }
  return { owner: "", horse: clean };
}

function rowsFor(appts: Appointment[], date: string): Row[] {
  return appts
    .filter((a) => a.date === date && a.vetId === "weston")
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((a) => {
      const { owner, horse } = parsePatient(a.title);
      return {
        id: a.id,
        start: a.start,
        end: a.end,
        owner,
        horse,
        title: a.title,
        location: a.location,
      };
    });
}

export function PrintHistory() {
  const date = useStaffing((s) => s.selectedDate);
  const appointments = useStaffing((s) => s.appointments);
  const rows = useMemo(() => rowsFor(appointments, date), [appointments, date]);
  const key = `barnboard-print-${date}`;
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, boolean>;
    } catch {
      return {};
    }
  });

  const toggle = (id: string) => {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };

  const printed = rows.filter((r) => done[r.id]).length;

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3 print:block">
        <div>
          <p className="text-xs tracking-[0.16em] uppercase text-muted">Print history</p>
          <h2 className="font-display text-3xl tracking-tight text-fg">WD · Dr. Davis</h2>
          <p className="text-sm text-muted">
            {dayLong(date)} · {monthDay(date)}
          </p>
        </div>
        <Button className="print:hidden" onClick={() => window.print()}>
          <Printer className="size-4" />
          Print this list
        </Button>
      </div>

      <p className="text-sm text-muted">
        {printed} of {rows.length} histories checked
        {rows.length === 0 ? " · no Davis stops this day" : ""}
      </p>

      <ul className="divide-y divide-border rounded-md border border-border bg-surface">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-3 px-3 py-3">
            <input
              type="checkbox"
              className="mt-1 size-5 print:hidden"
              checked={Boolean(done[r.id])}
              onChange={() => toggle(r.id)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">
                {r.start}–{r.end}
                {r.location ? ` · ${r.location}` : ""}
              </p>
              <p className="text-lg text-fg">
                <span className="font-medium">{r.horse || r.title}</span>
                {r.owner ? <span className="text-muted"> · {r.owner}</span> : null}
              </p>
              <p className="text-xs text-subtle">{r.title}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
