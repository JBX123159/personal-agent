import assert from "node:assert/strict";
import test from "node:test";

import {
  extractFinalTranscript,
  getSpeechRecognitionErrorMessage,
  resolveSpeechRecognitionConstructor,
  type SpeechRecognitionErrorEventLike,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionLike,
} from "./speech-recognition";

class FakeRecognition implements SpeechRecognitionLike {
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null = null;

  start() {}
  stop() {}
  abort() {}
}

class StandardRecognition extends FakeRecognition {}
class WebkitRecognition extends FakeRecognition {}

test("优先标准构造器并兼容 webkit 前缀", () => {
  assert.equal(
    resolveSpeechRecognitionConstructor({
      SpeechRecognition: StandardRecognition,
      webkitSpeechRecognition: WebkitRecognition,
    }),
    StandardRecognition,
  );
  assert.equal(
    resolveSpeechRecognitionConstructor({
      webkitSpeechRecognition: WebkitRecognition,
    }),
    WebkitRecognition,
  );
  assert.equal(resolveSpeechRecognitionConstructor({}), null);
});

test("只组合最终识别结果并清理多余空白", () => {
  const transcript = extractFinalTranscript({
    resultIndex: 0,
    results: [
      { isFinal: true, 0: { transcript: " 今晚还是 " }, length: 1 },
      { isFinal: false, 0: { transcript: "临时文字" }, length: 1 },
      { isFinal: true, 0: { transcript: " 老样子吧 " }, length: 1 },
    ],
  });

  assert.equal(transcript, "今晚还是老样子吧");
});

test("忽略没有候选文本的异常结果", () => {
  assert.equal(
    extractFinalTranscript({
      resultIndex: 0,
      results: [{ isFinal: true, length: 0 }],
    }),
    "",
  );
});

test("把常见识别错误映射为可理解中文", () => {
  assert.match(
    getSpeechRecognitionErrorMessage("not-allowed"),
    /麦克风权限/,
  );
  assert.match(getSpeechRecognitionErrorMessage("no-speech"), /没有识别到/);
  assert.match(getSpeechRecognitionErrorMessage("audio-capture"), /麦克风/);
  assert.match(getSpeechRecognitionErrorMessage("network"), /网络/);
  assert.match(getSpeechRecognitionErrorMessage("unexpected"), /识别失败/);
});
