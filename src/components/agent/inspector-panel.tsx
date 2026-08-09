"use client";

import { ScanSearch } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Memory, ToolName, ToolStatus } from "@/domain/agent";
import type { AgentExecutionRun } from "@/domain/structured-agent";
import { MemoryInspector } from "@/components/agent/memory-inspector";
import {
  ContextInspector,
  EmptyInspectorState,
  GoalInspector,
  PlanInspector,
  SafetyInspector,
  ToolsInspector,
} from "@/components/agent/inspector-sections";

interface InspectorPanelProps {
  run: AgentExecutionRun | null;
  memories: Memory[];
  statuses: Record<ToolName, ToolStatus>;
  disabled: boolean;
  memoryControlsDisabled: boolean;
  onStatusChange: (tool: ToolName, status: ToolStatus) => void;
  onConfirmMemory: (id: string) => void;
  onEditMemory: (id: string, content: string) => boolean;
  onPauseMemory: (id: string) => void;
  onResumeMemory: (id: string) => void;
  onForgetMemory: (id: string) => void;
}

export function InspectorPanel({
  run,
  memories,
  statuses,
  disabled,
  memoryControlsDisabled,
  onStatusChange,
  onConfirmMemory,
  onEditMemory,
  onPauseMemory,
  onResumeMemory,
  onForgetMemory,
}: InspectorPanelProps) {
  return (
    <Card className="h-full min-h-[650px] border-white/10 bg-slate-950/75 text-slate-100 shadow-2xl shadow-black/20 backdrop-blur">
      <CardHeader className="border-b border-white/8">
        <CardTitle className="flex items-center gap-2">
          <ScanSearch className="size-4 text-cyan-300" />
          Agent Inspector
        </CardTitle>
        <CardDescription className="text-slate-400">
          让每一步决策可见、可查、可验证
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="context" className="gap-4">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-white/[0.045] p-1">
            <TabsTrigger value="context">Context</TabsTrigger>
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="goal">Goal</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="safety">Safety / Eval</TabsTrigger>
          </TabsList>
          <TabsContent value="context">
            {run ? <ContextInspector run={run} /> : <EmptyInspectorState />}
          </TabsContent>
          <TabsContent value="memory">
            <MemoryInspector
              memories={memories}
              disabled={memoryControlsDisabled}
              onConfirm={onConfirmMemory}
              onEdit={onEditMemory}
              onPause={onPauseMemory}
              onResume={onResumeMemory}
              onForget={onForgetMemory}
            />
          </TabsContent>
          <TabsContent value="goal">
            {run ? <GoalInspector run={run} /> : <EmptyInspectorState />}
          </TabsContent>
          <TabsContent value="plan">
            {run ? <PlanInspector run={run} /> : <EmptyInspectorState />}
          </TabsContent>
          <TabsContent value="tools">
            <ToolsInspector
              run={run}
              statuses={statuses}
              disabled={disabled}
              onStatusChange={onStatusChange}
            />
          </TabsContent>
          <TabsContent value="safety">
            {run ? <SafetyInspector run={run} /> : <EmptyInspectorState />}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
