import { cn } from "@/lib/utils";
import { roleLetter } from "@/lib/staffing/format";
import type { Role } from "@/lib/staffing/types";

const tones: Record<Role, string> = {
  primary: "border-role-p text-role-p",
  secondary: "border-role-s text-role-s",
  float: "border-role-f text-role-f",
  office: "border-role-o text-muted",
  oncall: "border-role-c text-role-c",
};

export function RoleMark({ role, className }: { role: Role; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-sm border text-[10px] font-semibold",
        tones[role],
        className,
      )}
    >
      {roleLetter(role)}
    </span>
  );
}
