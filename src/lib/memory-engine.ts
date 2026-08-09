import type { Memory } from "../domain/agent";

const CLIMATE_MEMORY_ID = "climate_24_candidate";
const MAX_ACTIVE_MEMORIES = 5;
const MAX_OBSERVATION_COUNT = 1_000;

function isClimate24Preference(input: string): boolean {
  const normalized = input.replace(/[\s。！？!?]/g, "");
  return /^空调(?:调到)?24(?:℃|度)?就行$/.test(normalized);
}

function replaceMemory(
  memories: Memory[],
  id: string,
  update: (memory: Memory) => Memory | undefined,
): Memory[] {
  const index = memories.findIndex((memory) => memory.id === id);
  if (index === -1) return memories;

  const updated = update(memories[index]);
  if (!updated) return memories;

  const nextMemories = [...memories];
  nextMemories[index] = updated;
  return nextMemories;
}

export function observeMemoryFromInput(
  memories: Memory[],
  input: string,
): Memory[] {
  if (!isClimate24Preference(input)) return memories;

  const existing = memories.find(
    (memory) => memory.id === CLIMATE_MEMORY_ID,
  );
  if (!existing) {
    return [
      ...memories,
      {
        id: CLIMATE_MEMORY_ID,
        type: "temporary",
        content: "偏好将空调设置为 24℃",
        context: { temperature: 24 },
        confidence: 0.9,
        sensitivity: "low",
        source: "repeated_behavior",
        status: "temporary",
        userConfirmed: false,
        observationCount: 1,
      },
    ];
  }

  if (existing.status !== "temporary" && existing.status !== "candidate") {
    return memories;
  }

  return replaceMemory(memories, CLIMATE_MEMORY_ID, (memory) => {
    const observationCount = Math.min(
      memory.observationCount + 1,
      MAX_OBSERVATION_COUNT,
    );
    return {
      ...memory,
      observationCount,
      status: observationCount >= 3 ? "candidate" : "temporary",
      userConfirmed: false,
    };
  });
}

export function confirmMemory(memories: Memory[], id: string): Memory[] {
  return replaceMemory(memories, id, (memory) =>
    memory.status === "candidate"
      ? {
          ...memory,
          type: "preference",
          status: "active",
          userConfirmed: true,
        }
      : undefined,
  );
}

export function pauseMemory(memories: Memory[], id: string): Memory[] {
  return replaceMemory(memories, id, (memory) =>
    memory.status === "active"
      ? { ...memory, status: "suspended" }
      : undefined,
  );
}

export function resumeMemory(memories: Memory[], id: string): Memory[] {
  return replaceMemory(memories, id, (memory) =>
    memory.status === "suspended"
      ? { ...memory, status: "active" }
      : undefined,
  );
}

export function forgetMemory(memories: Memory[], id: string): Memory[] {
  return replaceMemory(memories, id, (memory) =>
    memory.status !== "deleted"
      ? { ...memory, status: "deleted", userConfirmed: false }
      : undefined,
  );
}

export function selectActiveMemories(memories: Memory[]): Memory[] {
  return memories
    .filter(
      (memory) => memory.status === "active" && memory.userConfirmed,
    )
    .slice(0, MAX_ACTIVE_MEMORIES);
}
