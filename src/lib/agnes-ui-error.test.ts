import assert from "node:assert/strict";
import test from "node:test";

import { getAgnesDecisionErrorMessage } from "./agnes-ui-error";

test("把浏览器 Failed to fetch 转成明确中文提示", () => {
  assert.equal(
    getAgnesDecisionErrorMessage(new TypeError("Failed to fetch")),
    "网络连接中断，请重新尝试；未执行任何工具。",
  );
});

test("保留服务端已经返回的中文错误", () => {
  assert.equal(
    getAgnesDecisionErrorMessage(new Error("Agnes 连续两次请求超时。")),
    "Agnes 连续两次请求超时。",
  );
});

test("未知错误使用稳定兜底文案", () => {
  assert.equal(getAgnesDecisionErrorMessage(null), "未知错误");
});
