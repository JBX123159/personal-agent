"use client";

import { useState } from "react";
import { Activity, CarFront, ShieldCheck } from "lucide-react";

import { ChatPanel } from "@/components/agent/chat-panel";
import { ContextPanel } from "@/components/agent/context-panel";
import { InspectorPanel } from "@/components/agent/inspector-panel";
import { Badge } from "@/components/ui/badge";
import {
  createMockMemories,
  initialToolStatuses,
  initialVehicleContext,
} from "@/data/mock-data";
import type {
  ChatMessage,
  Memory,
  ToolName,
  ToolStatus,
  VehicleContext,
} from "@/domain/agent";
import type {
  AgentExecutionRun,
  StructuredAgentDecision,
} from "@/domain/structured-agent";
import { parseAgentDecision } from "@/lib/agent-decision-schema";
import { getAgnesDecisionErrorMessage } from "@/lib/agnes-ui-error";
import {
  completeAgentRun,
  prepareAgentRun,
} from "@/lib/execution-pipeline";
import {
  confirmMemory,
  forgetMemory,
  observeMemoryFromInput,
  pauseMemory,
  resumeMemory,
  selectActiveMemories,
} from "@/lib/memory-engine";
import { createMockAgentDecision } from "@/lib/mock-agent-decision";

type DecisionMode = "agnes" | "mock";

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Vehicle Context 与 Memory 已就绪。默认使用 Agnes AI，也可切换到 Phase 1 Mock 稳定演示。",
  },
];

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
  };
}

function waitForDemoFeedback() {
  return new Promise((resolve) => window.setTimeout(resolve, 320));
}

async function fetchAgnesDecision(
  userInput: string,
  context: VehicleContext,
  memories: Memory[],
): Promise<StructuredAgentDecision> {
  const response = await fetch("/api/agent/decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userInput, context, memories }),
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "Agnes 决策请求失败。";
    throw new Error(message);
  }
  if (!body || typeof body !== "object" || !("decision" in body)) {
    throw new Error("Agnes 返回缺少 decision。");
  }

  return parseAgentDecision(
    body.decision,
    new Set(memories.map((memory) => memory.id)),
  );
}

export function AgentDemo() {
  const [context, setContext] = useState<VehicleContext>(initialVehicleContext);
  const [toolStatuses, setToolStatuses] =
    useState<Record<ToolName, ToolStatus>>(initialToolStatuses);
  const [memories, setMemories] = useState<Memory[]>(createMockMemories);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("今晚还是老样子吧");
  const [inputError, setInputError] = useState("");
  const [run, setRun] = useState<AgentExecutionRun | null>(null);
  const [processing, setProcessing] = useState(false);
  const [decisionMode, setDecisionMode] = useState<DecisionMode>("agnes");
  const [lastSubmittedInput, setLastSubmittedInput] = useState<string | null>(
    null,
  );

  const phase = run?.phase ?? "idle";
  const contextLocked = processing || phase === "awaiting_confirmation";
  const canRetry =
    Boolean(lastSubmittedInput) && Boolean(inputError) && !processing && !run;

  async function requestDecision(
    submittedInput: string,
    memorySnapshot: Memory[],
  ) {
    setInputError("");
    setRun(null);
    setProcessing(true);
    await waitForDemoFeedback();

    try {
      const activeMemories = selectActiveMemories(memorySnapshot);
      const decision =
        decisionMode === "agnes"
          ? await fetchAgnesDecision(submittedInput, context, activeMemories)
          : createMockAgentDecision(submittedInput, context, memorySnapshot);
      const preparedRun = prepareAgentRun({
        decision,
        decisionSource: decisionMode,
        context,
        memories: memorySnapshot,
        statuses: toolStatuses,
      });

      setRun(preparedRun);
      setMessages((current) => [
        ...current,
        createMessage("assistant", preparedRun.response),
      ]);
    } catch (error) {
      setRun(null);
      const message =
        decisionMode === "agnes"
          ? getAgnesDecisionErrorMessage(error)
          : error instanceof Error
            ? error.message
            : "未知错误";
      setInputError(
        decisionMode === "agnes"
          ? `Agnes 决策失败：${message}`
          : `本地 Decision Pipeline 失败：${message}`,
      );
    } finally {
      setProcessing(false);
    }
  }

  async function handleSubmit() {
    const normalizedInput = input.trim();
    setInputError("");

    if (!normalizedInput) {
      setInputError("请输入指令后再发送。");
      return;
    }
    if (phase === "awaiting_confirmation") {
      setInputError("请先确认或重置当前方案。");
      return;
    }

    const observedMemories = observeMemoryFromInput(memories, normalizedInput);
    const becameCandidate = observedMemories.some((memory) => {
      const previous = memories.find((item) => item.id === memory.id);
      return memory.status === "candidate" && previous?.status !== "candidate";
    });

    setMemories(observedMemories);
    setLastSubmittedInput(normalizedInput);
    setMessages((current) => [
      ...current,
      createMessage("user", normalizedInput),
      ...(becameCandidate
        ? [
            createMessage(
              "assistant",
              "已连续观察到 3 次“空调 24℃”偏好，已形成 Memory Candidate。请在 Memory 面板确认后再启用。",
            ),
          ]
        : []),
    ]);
    setInput("");
    await requestDecision(normalizedInput, observedMemories);
  }

  async function handleRetry() {
    if (!lastSubmittedInput || processing || run) return;
    await requestDecision(lastSubmittedInput, memories);
  }

  async function handleConfirm() {
    if (!run || run.phase !== "awaiting_confirmation" || processing) return;

    setMessages((current) => [
      ...current,
      createMessage("user", "确认，按这个方案执行。"),
    ]);
    setProcessing(true);
    await waitForDemoFeedback();

    try {
      const completedRun = completeAgentRun(run, toolStatuses);
      setRun(completedRun);
      setMessages((current) => [
        ...current,
        createMessage("assistant", completedRun.response),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      setInputError(`执行确认方案失败：${message}`);
    } finally {
      setProcessing(false);
    }
  }

  function handleReset() {
    if (processing) return;
    setContext(initialVehicleContext);
    setToolStatuses({ ...initialToolStatuses });
    setMemories(createMockMemories());
    setMessages(initialMessages);
    setInput("今晚还是老样子吧");
    setInputError("");
    setRun(null);
    setLastSubmittedInput(null);
  }

  function handleToolStatusChange(tool: ToolName, status: ToolStatus) {
    setToolStatuses((current) => ({ ...current, [tool]: status }));
  }

  function updateMemory(action: (items: Memory[], id: string) => Memory[], id: string) {
    if (contextLocked) return;
    setMemories((current) => action(current, id));
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_36%),linear-gradient(145deg,#020617_0%,#07111f_48%,#020617_100%)] px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px]">
        <header className="mb-5 flex flex-col justify-between gap-4 border-b border-white/8 pb-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-cyan-300/70">
              <CarFront className="size-4" />
              AI Native Vehicle
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Context-aware Personal Agent
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Memory × Vehicle Context 驱动的可验证 Agent 产品闭环
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-cyan-400/20 bg-cyan-400/5 text-cyan-200">
              <Activity />
              Scenario 01 / 02 / 03
            </Badge>
            <Badge variant="outline" className="border-emerald-400/20 bg-emerald-400/5 text-emerald-200">
              <ShieldCheck />
              Program Guardrails
            </Badge>
            <Badge variant="outline" className="border-white/10 text-slate-400">
              {decisionMode === "agnes" ? "Agnes Structured" : "Local Mock"}
            </Badge>
          </div>
        </header>

        <div className="grid items-stretch gap-4 xl:grid-cols-[300px_minmax(440px,1fr)_minmax(430px,0.95fr)]">
          <ContextPanel
            context={context}
            disabled={contextLocked}
            onChange={setContext}
            onReset={() => setContext(initialVehicleContext)}
          />
          <ChatPanel
            input={input}
            inputError={inputError}
            messages={messages}
            phase={phase}
            processing={processing}
            decisionMode={decisionMode}
            modeLocked={contextLocked}
            canRetry={canRetry}
            onInputChange={setInput}
            onSubmit={handleSubmit}
            onConfirm={handleConfirm}
            onReset={handleReset}
            onRetry={handleRetry}
            onDecisionModeChange={setDecisionMode}
          />
          <InspectorPanel
            run={run}
            memories={memories}
            statuses={toolStatuses}
            disabled={processing}
            memoryControlsDisabled={contextLocked}
            onStatusChange={handleToolStatusChange}
            onConfirmMemory={(id) => updateMemory(confirmMemory, id)}
            onPauseMemory={(id) => updateMemory(pauseMemory, id)}
            onResumeMemory={(id) => updateMemory(resumeMemory, id)}
            onForgetMemory={(id) => updateMemory(forgetMemory, id)}
          />
        </div>
      </div>
    </main>
  );
}
