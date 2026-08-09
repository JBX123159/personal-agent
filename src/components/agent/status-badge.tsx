import { Badge } from "@/components/ui/badge";
import type { DecisionRisk, ToolStatus } from "@/domain/agent";
import type { PermissionOutcome } from "@/domain/structured-agent";

export function ToolStatusBadge({ status }: { status: ToolStatus }) {
  const className = {
    SUCCESS: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    FAILED: "border-rose-400/20 bg-rose-400/10 text-rose-300",
    TIMEOUT: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  }[status];
  return (
    <Badge variant="outline" className={className}>
      {status}
    </Badge>
  );
}

export function RiskBadge({ risk }: { risk: DecisionRisk }) {
  const label = { read: "READ", low: "LOW", high: "HIGH" }[risk];
  const className = {
    read: "border-sky-400/20 bg-sky-400/10 text-sky-300",
    low: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    high: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  }[risk];
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

export function PermissionOutcomeBadge({
  outcome,
}: {
  outcome: PermissionOutcome;
}) {
  const className = {
    ALLOW: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    REQUIRE_CONFIRMATION:
      "border-amber-400/20 bg-amber-400/10 text-amber-300",
    DENY: "border-rose-400/20 bg-rose-400/10 text-rose-300",
  }[outcome];

  return (
    <Badge variant="outline" className={className}>
      {outcome}
    </Badge>
  );
}
