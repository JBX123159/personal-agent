import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Vercel 仅把现有 Next.js 函数部署到新加坡区域", () => {
  const configPath = new URL("../../vercel.json", import.meta.url);
  const config: unknown = JSON.parse(readFileSync(configPath, "utf8"));

  assert.deepEqual(config, {
    $schema: "https://openapi.vercel.sh/vercel.json",
    framework: "nextjs",
    regions: ["sin1"],
  });
});
