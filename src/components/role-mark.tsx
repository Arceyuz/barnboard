import { cn } from "@/lib/utils";
import { roleLetter } from "@/lib/staffing/format";
import type { Role } from "@/lib/staffing/types";

const tones: Record<Role, string> = {
  primary: "bg-role-p text-fg",
  secondary: "bg-role-s text-warn-fg",
  float: "bg-role-f text-fg",
  office: "bg-role-o text-fg",
  oncall: "bg-role-c text-ok-fg",
};

export function RoleMark({ role, className }: { role: Role; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-[11px] font-semibold",
        tones[role],
        className,
      )}
    >
      {roleLetter(role)}
    </span>
  );
}
