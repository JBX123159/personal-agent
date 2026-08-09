"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Memory } from "@/domain/agent";

interface MemoryInspectorProps {
  memories: Memory[];
  disabled: boolean;
  onConfirm: (id: string) => void;
  onEdit: (id: string, content: string) => boolean;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onForget: (id: string) => void;
}

export function MemoryInspector({
  memories,
  disabled,
  onConfirm,
  onEdit,
  onPause,
  onResume,
  onForget,
}: MemoryInspectorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [editError, setEditError] = useState("");
  const visibleMemories = memories.filter(
    (memory) => memory.status !== "deleted",
  );

  function startEditing(memory: Memory) {
    setEditingId(memory.id);
    setDraftContent(memory.content);
    setEditError("");
  }

  function cancelEditing() {
    setEditingId(null);
    setDraftContent("");
    setEditError("");
  }

  function saveEditing(memory: Memory) {
    if (disabled) return;

    const normalizedContent = draftContent.trim();
    if (normalizedContent === memory.content) {
      cancelEditing();
      return;
    }
    if (!onEdit(memory.id, draftContent)) {
      const isTemperatureMemory =
        typeof memory.context?.temperature === "number" ||
        /-?\d+(?:\.\d+)?\s*(?:℃|度)/.test(memory.content);
      setEditError(
        isTemperatureMemory
          ? "请输入 1～500 个字符，并保留 -20～60℃ 的温度。"
          : "请输入 1～500 个字符。",
      );
      return;
    }

    cancelEditing();
  }

  return (
    <ScrollArea className="h-[545px] pr-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-slate-500">只有已确认的 Active Memory 参与决策</p>
        <Badge variant="outline" className="border-white/10 text-slate-400">
          {visibleMemories.length} 条
        </Badge>
      </div>
      {visibleMemories.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">
          暂无可用 Memory
        </p>
      ) : (
        <div className="space-y-3">
          {visibleMemories.map((memory) => {
            const isEditing = editingId === memory.id;
            return (
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
                {isEditing ? (
                  <div className="mt-3 space-y-2">
                    <Input
                      aria-label={`编辑 ${memory.id} 内容`}
                      value={draftContent}
                      maxLength={500}
                      disabled={disabled}
                      onChange={(event) => {
                        setDraftContent(event.target.value);
                        setEditError("");
                      }}
                      className="border-cyan-400/25 bg-slate-950/70"
                    />
                    {editError ? (
                      <p role="alert" className="text-xs text-rose-300">
                        {editError}
                      </p>
                    ) : null}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={disabled}
                        onClick={() => saveEditing(memory)}
                        className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                      >
                        保存
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        onClick={cancelEditing}
                        className="border-white/10 text-slate-300"
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    {memory.content}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>{memory.type}</span>
                  <span>置信度 {memory.confidence.toFixed(2)}</span>
                  <span>观察 {memory.observationCount} 次</span>
                  <span>{memory.userConfirmed ? "用户已确认" : "未确认"}</span>
                </div>
                {!isEditing ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() => startEditing(memory)}
                      className="border-cyan-400/20 text-cyan-200 hover:bg-cyan-400/10"
                    >
                      编辑
                    </Button>
                    {memory.status === "candidate" ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={disabled}
                        onClick={() => onConfirm(memory.id)}
                        className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                      >
                        确认偏好
                      </Button>
                    ) : null}
                    {memory.status === "active" ? (
                      <>
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
                      </>
                    ) : null}
                    {memory.status === "suspended" ? (
                      <>
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
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </ScrollArea>
  );
}
