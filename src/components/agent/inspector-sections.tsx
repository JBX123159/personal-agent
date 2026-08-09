"use client";

import { CheckCircle2, CircleAlert, CircleDashed, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toolLabels, toolNames } from "@/data/mock-data";
import type { Memory, ToolName, ToolStatus } from "@/domain/agent";
import type { AgentExecutionRun } from "@/domain/structured-agent";
import {
  PermissionOutcomeBadge,
  RiskBadge,
  ToolStatusBadge,
} from "@/components/agent/status-badge";

export function EmptyInspectorState() {
  return (
    <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
      <div>
        <CircleDashed className="mx-auto mb-3 size-6 text-slate-600" />
        <p className="text-sm text-slate-400">尚未生成 Agent Decision</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          发送指令后，本轮结构化状态会显示在这里。
        </p>
      </div>
    </div>
  );
}

export function ContextInspector({ run }: { run: AgentExecutionRun }) {
  const entries = [
    ["Current Time", run.contextSnapshot.currentTime],
    ["Location", run.contextSnapshot.location],
    ["Battery", `${run.contextSnapshot.batteryLevel}%`],
    ["Cabin", `${run.contextSnapshot.cabinTemperature}℃`],
    ["Passenger", run.contextSnapshot.passengerMode],
    ["Weather", run.contextSnapshot.weather],
    ["Route", run.contextSnapshot.currentRoute || "None"],
  ];
  return (
    <InspectorScroll>
      <p className="mb-3 text-xs text-slate-500">本轮执行开始时的只读快照</p>
      <div className="space-y-2">
        {entries.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2.5"
          >
            <span className="text-xs text-slate-500">{label}</span>
            <span className="text-right text-sm text-slate-200">{value}</span>
          </div>
        ))}
      </div>
    </InspectorScroll>
  );
}

export function MemoryInspector({
  memories,
  disabled,
  onConfirm,
  onPause,
  onResume,
  onForget,
}: {
  memories: Memory[];
  disabled: boolean;
  onConfirm: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onForget: (id: string) => void;
}) {
  const visibleMemories = memories.filter(
    (memory) => memory.status !== "deleted",
  );

  return (
    <InspectorScroll>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-slate-500">只有已确认的 Active Memory 参与决策</p>
        <Badge variant="outline" className="border-white/10 text-slate-400">
          {visibleMemories.length} 条
        </Badge>
      </div>
      <div className="space-y-3">
        {visibleMemories.map((memory) => (
          <div
            key={memory.id}
            className="rounded-xl border border-white/8 bg-white/[0.025] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs text-cyan-300">{memory.id}</code>
              <Badge variant="outline" className="border-white/10 text-slate-400 uppercase">
                {memory.status}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-200">{memory.content}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
              <span>{memory.type}</span>
              <span>置信度 {memory.confidence.toFixed(2)}</span>
              <span>观察 {memory.observationCount} 次</span>
              <span>{memory.userConfirmed ? "用户已确认" : "未确认"}</span>
            </div>
            {memory.status === "candidate" ? (
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onConfirm(memory.id)}
                  className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                >
                  确认偏好
                </Button>
              </div>
            ) : null}
            {memory.status === "active" ? (
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onPause(memory.id)}
                  className="border-amber-400/20 text-amber-200 hover:bg-amber-400/10"
                >
                  暂停
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onForget(memory.id)}
                  className="border-rose-400/20 text-rose-200 hover:bg-rose-400/10"
                >
                  忘记
                </Button>
              </div>
            ) : null}
            {memory.status === "suspended" ? (
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onResume(memory.id)}
                  className="border-emerald-400/20 text-emerald-200 hover:bg-emerald-400/10"
                >
                  恢复
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onForget(memory.id)}
                  className="border-rose-400/20 text-rose-200 hover:bg-rose-400/10"
                >
                  忘记
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </InspectorScroll>
  );
}

export function GoalInspector({ run }: { run: AgentExecutionRun }) {
  return (
    <InspectorScroll>
      <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-4">
        <p className="text-xs font-medium uppercase tracking-widest text-cyan-300/70">
          Intent
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <code className="text-sm text-cyan-200">{run.decision.intent}</code>
          <span className="text-xs text-slate-500">
            {(run.decision.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.025] p-4">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
          Goal
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-200">{run.decision.goal}</p>
        <p className="mt-3 text-xs text-slate-500">
          Decision Source：{run.decisionSource === "agnes" ? "Agnes AI" : "Phase 1 Mock"}
        </p>
      </div>
      {run.decision.clarificationNeeded ? (
        <div className="mt-3 flex gap-2 rounded-xl border border-amber-400/15 bg-amber-400/5 p-3 text-sm text-amber-200">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          Context 不匹配，系统已停止自动复用 Routine。
        </div>
      ) : null}
    </InspectorScroll>
  );
}

export function PlanInspector({ run }: { run: AgentExecutionRun }) {
  return (
    <InspectorScroll>
      {run.decision.plan.length === 0 ? (
        <p className="rounded-lg border border-amber-400/15 bg-amber-400/5 p-3 text-sm text-amber-200">
          需要先澄清，本轮没有生成执行计划。
        </p>
      ) : (
        <ol className="space-y-2.5">
          {run.decision.plan.map((step, index) => (
            <li
              key={step.stepId}
              className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/8 text-xs text-slate-400">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-5 text-slate-200">{step.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="text-[11px] text-slate-600">{step.stepId}</code>
                  {step.toolName ? (
                    <code className="truncate text-xs text-slate-500">{step.toolName}()</code>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </InspectorScroll>
  );
}

export function ToolsInspector({
  run,
  statuses,
  disabled,
  onStatusChange,
}: {
  run: AgentExecutionRun | null;
  statuses: Record<ToolName, ToolStatus>;
  disabled: boolean;
  onStatusChange: (tool: ToolName, status: ToolStatus) => void;
}) {
  return (
    <InspectorScroll>
      <p className="mb-3 text-xs leading-5 text-slate-500">
        手动切换状态；新状态在下一次工具调用时生效。
      </p>
      <div className="space-y-2">
        {toolNames.map((tool) => {
          const records =
            run?.executions.filter((item) => item.call.toolName === tool) ?? [];
          return (
            <div key={tool} className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-slate-200">{toolLabels[tool]}</p>
                  <code className="text-[11px] text-slate-600">{tool}()</code>
                </div>
                <select
                  aria-label={`${toolLabels[tool]} Mock 状态`}
                  value={statuses[tool]}
                  disabled={disabled}
                  onChange={(event) =>
                    onStatusChange(tool, event.target.value as ToolStatus)
                  }
                  className="h-7 rounded-md border border-white/10 bg-slate-900 px-2 text-xs text-slate-200 outline-none focus:border-cyan-400/60"
                >
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="FAILED">FAILED</option>
                  <option value="TIMEOUT">TIMEOUT</option>
                </select>
              </div>
              {records.length > 0 ? (
                <div className="mt-3 space-y-3 border-t border-white/8 pt-3">
                  {records.map((record) => (
                    <div key={record.call.callId}>
                      <div className="flex flex-wrap items-center gap-2">
                        {record.result ? (
                          <ToolStatusBadge status={record.result.status} />
                        ) : (
                          <PermissionOutcomeBadge
                            outcome={record.permission.outcome}
                          />
                        )}
                        <code className="text-[11px] text-slate-600">
                          {record.call.callId}
                        </code>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        {record.result?.message ?? "本轮未执行。"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </InspectorScroll>
  );
}

export function SafetyInspector({ run }: { run: AgentExecutionRun }) {
  return (
    <InspectorScroll>
      <div className="mb-4 flex items-center justify-between rounded-lg border border-cyan-400/15 bg-cyan-400/5 p-3">
        <span className="text-xs text-slate-500">Decision Source</span>
        <Badge variant="outline" className="border-cyan-400/20 text-cyan-200">
          {run.decisionSource === "agnes" ? "Agnes AI" : "Phase 1 Mock"}
        </Badge>
      </div>
      <SectionTitle>Permission Engine</SectionTitle>
      <div className="space-y-2">
        {run.executions.map((record) => (
          <div key={record.call.callId} className="rounded-lg border border-white/8 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <code className="text-xs text-slate-300">
                  {record.call.toolName}()
                </code>
                <code className="ml-2 text-[11px] text-slate-600">
                  {record.call.callId}
                </code>
              </div>
              <div className="flex gap-1.5">
                <RiskBadge risk={record.permission.risk} />
                <PermissionOutcomeBadge outcome={record.permission.outcome} />
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {record.permission.reason}
            </p>
            {record.result ? (
              <div className="mt-3 border-t border-white/8 pt-3">
                <div className="flex items-center gap-2">
                  <ToolStatusBadge status={record.result.status} />
                  <span className="text-xs text-slate-500">Tool Result</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {record.result.message}
                </p>
              </div>
            ) : null}
            {record.verification ? (
              <div className="mt-3 flex gap-2 border-t border-white/8 pt-3">
                {record.verification.verified ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                ) : (
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />
                )}
                <div>
                  <p className="text-xs text-slate-400">State Verification</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {record.verification.message}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-4">
        <div className="flex items-center gap-2 text-sm text-cyan-200">
          <ShieldCheck className="size-4" />
          False Success Guardrail
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          {run.falseSuccessPrevented
            ? "已拦截失败、超时或验证不一致的虚假成功表述。"
            : "最终回复只使用 Permission、Tool Result 与 Verification 事实。"}
        </p>
        <p data-testid="case-status" className="mt-3 text-sm font-medium text-slate-200">
          Case：{run.phase === "awaiting_confirmation" ? "等待用户确认" : run.casePassed ? "PASS" : "未完成"}
        </p>
      </div>
    </InspectorScroll>
  );
}

function InspectorScroll({ children }: { children: React.ReactNode }) {
  return <ScrollArea className="h-[545px] pr-3">{children}</ScrollArea>;
}

function SectionTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`mb-2 text-xs font-medium uppercase tracking-widest text-slate-500 ${className}`}>
      {children}
    </p>
  );
}
