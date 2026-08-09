import assert from "node:assert/strict";
import test from "node:test";

import type { Memory } from "../domain/agent";
import { createMockMemories } from "../data/mock-data";

import {
  confirmMemory,
  forgetMemory,
  observeMemoryFromInput,
  pauseMemory,
  resumeMemory,
  selectActiveMemories,
} from "./memory-engine";

const candidateMemory: Memory = {
  id: "climate_24_candidate",
  type: "temporary",
  content: "偏好将空调设置为 24℃",
  context: { temperature: 24 },
  confidence: 0.9,
  sensitivity: "low",
  source: "repeated_behavior",
  status: "candidate",
  userConfirmed: false,
  observationCount: 3,
};

const candidateMemories = [candidateMemory];
const activeMemories: Memory[] = [
  {
    ...candidateMemory,
    type: "preference",
    status: "active",
    userConfirmed: true,
  },
];

test("第三次相同空调偏好形成 Candidate", () => {
  let memories: Memory[] = [];
  memories = observeMemoryFromInput(memories, "空调24℃就行");
  memories = observeMemoryFromInput(memories, "空调 24 度就行");
  memories = observeMemoryFromInput(memories, "空调24℃就行。");
  assert.equal(memories[0].id, "climate_24_candidate");
  assert.equal(memories[0].observationCount, 3);
  assert.equal(memories[0].status, "candidate");
  assert.equal(memories[0].userConfirmed, false);
});

test("前两次观察保持 Temporary，其他输入不创建 Memory", () => {
  const once = observeMemoryFromInput([], "空调调到24度就行");
  assert.equal(once[0].status, "temporary");
  assert.equal(once[0].observationCount, 1);

  const twice = observeMemoryFromInput(once, "空调24就行！");
  assert.equal(twice[0].status, "temporary");
  assert.equal(twice[0].observationCount, 2);

  assert.strictEqual(observeMemoryFromInput(twice, "导航回家"), twice);
});

test("否定句和引用句不形成空调偏好 Memory", () => {
  const memories: Memory[] = [];
  assert.strictEqual(
    observeMemoryFromInput(memories, "不要把空调调到24℃就行"),
    memories,
  );
  assert.strictEqual(
    observeMemoryFromInput(memories, "别人说空调24℃就行"),
    memories,
  );
});

test("独立 Candidate 不覆盖已有 Phase 1 空调 Memory", () => {
  const phaseOneMemory: Memory = {
    ...activeMemories[0],
    id: "summer_climate_24",
  };
  const observed = observeMemoryFromInput([phaseOneMemory], "空调24℃就行");
  assert.equal(observed.length, 2);
  assert.equal(observed[0].id, "summer_climate_24");
  assert.equal(observed[1].id, "climate_24_candidate");
});

test("Candidate 只有确认后才能成为 Active", () => {
  const active = confirmMemory(candidateMemories, "climate_24_candidate");
  assert.equal(active[0].status, "active");
  assert.equal(active[0].type, "preference");
  assert.equal(active[0].userConfirmed, true);
  assert.equal(selectActiveMemories(active).length, 1);
});

test("Pause 后不参与决策，Resume 后恢复", () => {
  const paused = pauseMemory(activeMemories, "climate_24_candidate");
  assert.equal(paused[0].status, "suspended");
  assert.equal(selectActiveMemories(paused).length, 0);
  const resumed = resumeMemory(paused, "climate_24_candidate");
  assert.equal(resumed[0].status, "active");
  assert.equal(selectActiveMemories(resumed).length, 1);
});

test("Forget 后不参与决策", () => {
  const forgotten = forgetMemory(activeMemories, "climate_24_candidate");
  assert.equal(forgotten[0].status, "deleted");
  assert.equal(selectActiveMemories(forgotten).length, 0);
});

test("非法 ID 和非法状态转换返回原数组", () => {
  assert.strictEqual(confirmMemory(candidateMemories, "missing"), candidateMemories);
  assert.strictEqual(pauseMemory(candidateMemories, "climate_24_candidate"), candidateMemories);
  assert.strictEqual(resumeMemory(activeMemories, "climate_24_candidate"), activeMemories);

  const deleted = forgetMemory(activeMemories, "climate_24_candidate");
  assert.strictEqual(forgetMemory(deleted, "climate_24_candidate"), deleted);
});

test("最多选择前 5 条已确认 Active Memory", () => {
  const memories = Array.from({ length: 7 }, (_, index): Memory => ({
    ...activeMemories[0],
    id: `active-${index}`,
  }));
  memories.push({ ...activeMemories[0], id: "unconfirmed", userConfirmed: false });
  assert.deepEqual(
    selectActiveMemories(memories).map((memory) => memory.id),
    ["active-0", "active-1", "active-2", "active-3", "active-4"],
  );
});

test("Mock Memory 工厂返回可安全修改的深拷贝", () => {
  const first = createMockMemories();
  const second = createMockMemories();
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first[0], second[0]);
  assert.notStrictEqual(first[0].context, second[0].context);

  first[0].content = "已修改";
  if (first[0].context) first[0].context.day = "Monday";
  assert.notEqual(second[0].content, "已修改");
  assert.equal(second[0].context?.day, "Friday");
});
