export interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

export interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternativeLike | undefined;
}

export interface SpeechRecognitionResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultLike | undefined;
}

export interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export interface SpeechRecognitionRuntime {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export const SPEECH_UNSUPPORTED_MESSAGE =
  "当前浏览器不支持语音识别，请继续使用文本输入。";

export function resolveSpeechRecognitionConstructor(
  runtime: SpeechRecognitionRuntime,
): SpeechRecognitionConstructor | null {
  return runtime.SpeechRecognition ?? runtime.webkitSpeechRecognition ?? null;
}

export function extractFinalTranscript(
  event: SpeechRecognitionEventLike,
): string {
  const parts: string[] = [];
  const startIndex = Math.max(0, event.resultIndex);

  for (let index = startIndex; index < event.results.length; index += 1) {
    const result = event.results[index];
    const transcript = result?.isFinal ? result[0]?.transcript.trim() : "";
    if (transcript) parts.push(transcript);
  }

  return parts.join("");
}

export function getSpeechRecognitionErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "not-allowed":
    case "service-not-allowed":
      return "无法使用麦克风权限，请允许访问或继续使用文本输入。";
    case "no-speech":
      return "没有识别到语音，请重试或继续使用文本输入。";
    case "audio-capture":
      return "未检测到可用麦克风，请继续使用文本输入。";
    case "network":
      return "语音识别网络异常，请重试或继续使用文本输入。";
    case "language-not-supported":
      return "当前语音服务不支持中文，请继续使用文本输入。";
    case "aborted":
      return "语音识别已停止，可以继续使用文本输入。";
    default:
      return "语音识别失败，请重试或继续使用文本输入。";
  }
}
