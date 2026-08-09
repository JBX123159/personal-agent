"use client";

import { Bot, Check, RotateCcw, Send, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage } from "@/domain/agent";

type DecisionMode = "agnes" | "mock";

interface ChatPanelProps {
  input: string;
  inputError: string;
  messages: ChatMessage[];
  phase: "idle" | "awaiting_confirmation" | "completed";
  processing: boolean;
  decisionMode: DecisionMode;
  modeLocked: boolean;
  canRetry: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onConfirm: () => void;
  onReset: () => void;
  onRetry: () => void;
  onDecisionModeChange: (mode: DecisionMode) => void;
}

export function ChatPanel({
  input,
  inputError,
  messages,
  phase,
  processing,
  decisionMode,
  modeLocked,
  canRetry,
  onInputChange,
  onSubmit,
  onConfirm,
  onReset,
  onRetry,
  onDecisionModeChange,
}: ChatPanelProps) {
  return (
    <Card className="flex h-full min-h-[650px] flex-col border-white/10 bg-slate-950/80 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
      <CardHeader className="border-b border-white/8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="grid size-8 place-items-center rounded-xl bg-cyan-400/10 ring-1 ring-cyan-300/20">
                <Bot className="size-4 text-cyan-300" />
              </span>
              Personal Agent
            </CardTitle>
            <CardDescription className="mt-1 text-slate-400">
              {decisionMode === "agnes"
                ? "真实 Agnes · Structured Decision"
                : "Phase 1 Mock · 本地固定 Decision"}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <select
              aria-label="Agent Decision 模式"
              value={decisionMode}
              disabled={modeLocked}
              onChange={(event) =>
                onDecisionModeChange(event.target.value as DecisionMode)
              }
              className="h-8 rounded-md border border-white/10 bg-slate-900 px-2 text-xs text-slate-200 outline-none focus:border-cyan-400/60"
            >
              <option value="agnes">Agnes AI</option>
              <option value="mock">Phase 1 Mock</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              disabled={processing}
              onClick={onReset}
              className="text-slate-400 hover:bg-white/8 hover:text-white"
            >
              <RotateCcw />
              重置
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-0">
        <ScrollArea className="h-[520px] px-4">
          <div className="space-y-4 py-4" aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" ? (
                  <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-cyan-400/10">
                    <Bot className="size-3.5 text-cyan-300" />
                  </span>
                ) : null}
                <div
                  className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                    message.role === "user"
                      ? "rounded-br-md bg-cyan-400 text-slate-950"
                      : "rounded-bl-md border border-white/8 bg-white/[0.045] text-slate-200"
                  }`}
                >
                  {message.content}
                </div>
                {message.role === "user" ? (
                  <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-white/8">
                    <User className="size-3.5 text-slate-300" />
                  </span>
                ) : null}
              </div>
            ))}
            {processing ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="size-2 animate-pulse rounded-full bg-cyan-300" />
                正在生成并校验 Agent Decision…
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="block space-y-3 border-white/8 bg-slate-950/60">
        {phase === "awaiting_confirmation" ? (
          <Button
            data-testid="confirm-plan"
            size="lg"
            disabled={processing}
            onClick={onConfirm}
            className="h-10 w-full bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
          >
            <Check />
            确认并执行方案
          </Button>
        ) : null}
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <Input
            data-testid="agent-input"
            aria-label="输入对 Personal Agent 的指令"
            aria-invalid={Boolean(inputError)}
            value={input}
            disabled={processing || phase === "awaiting_confirmation"}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="今晚还是老样子吧"
            className="h-10 border-white/10 bg-white/[0.04] text-slate-100 placeholder:text-slate-600 focus-visible:border-cyan-400/60 focus-visible:ring-cyan-400/15"
          />
          <Button
            data-testid="send-message"
            type="submit"
            size="icon-lg"
            disabled={processing || phase === "awaiting_confirmation"}
            className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
          >
            <Send />
            <span className="sr-only">发送</span>
          </Button>
        </form>
        {inputError ? (
          <div className="flex items-center justify-between gap-3">
            <p role="alert" className="text-xs text-rose-300">
              {inputError}
            </p>
            {canRetry ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="shrink-0 border-rose-400/20 text-rose-200 hover:bg-rose-400/10"
              >
                重新尝试
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-slate-600">
            Mock 模式可稳定演示 Scenario 01 / 02 / 03。
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
