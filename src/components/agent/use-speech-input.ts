"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  extractFinalTranscript,
  getSpeechRecognitionErrorMessage,
  resolveSpeechRecognitionConstructor,
  SPEECH_UNSUPPORTED_MESSAGE,
  type SpeechRecognitionLike,
  type SpeechRecognitionRuntime,
} from "@/lib/speech-recognition";

interface SpeechInputState {
  supported: boolean | null;
  listening: boolean;
  message: string;
  hasError: boolean;
  toggle: () => void;
}

const LISTENING_MESSAGE = "正在聆听，请说出指令…";

function subscribeToSpeechSupport() {
  return () => undefined;
}

function getSpeechSupportSnapshot(): boolean | null {
  if (typeof window === "undefined") return null;
  return Boolean(
    resolveSpeechRecognitionConstructor(
      window as unknown as SpeechRecognitionRuntime,
    ),
  );
}

function getServerSpeechSupportSnapshot(): boolean | null {
  return null;
}

export function useSpeechInput(
  onTranscript: (transcript: string) => void,
): SpeechInputState {
  const transcriptHandlerRef = useRef(onTranscript);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const supported = useSyncExternalStore(
    subscribeToSpeechSupport,
    getSpeechSupportSnapshot,
    getServerSpeechSupportSnapshot,
  );
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    transcriptHandlerRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    const runtime = window as unknown as SpeechRecognitionRuntime;
    const Recognition = resolveSpeechRecognitionConstructor(runtime);

    if (!Recognition) {
      return;
    }

    const recognition = new Recognition();
    let disposed = false;
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      if (disposed) return;
      setListening(true);
      setHasError(false);
      setMessage(LISTENING_MESSAGE);
    };
    recognition.onresult = (event) => {
      if (disposed) return;
      const transcript = extractFinalTranscript(event);
      if (!transcript) return;
      transcriptHandlerRef.current(transcript);
      setMessage("语音已填入输入框，请确认后发送。");
    };
    recognition.onerror = (event) => {
      if (disposed) return;
      setListening(false);
      setHasError(true);
      setMessage(getSpeechRecognitionErrorMessage(event.error));
    };
    recognition.onend = () => {
      if (disposed) return;
      setListening(false);
      setMessage((current) =>
        current === LISTENING_MESSAGE
          ? "识别结束，请确认输入内容后发送。"
          : current,
      );
    };

    recognitionRef.current = recognition;

    return () => {
      disposed = true;
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  const toggle = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setHasError(false);
      setMessage(SPEECH_UNSUPPORTED_MESSAGE);
      return;
    }

    if (listening) {
      recognition.stop();
      return;
    }

    setHasError(false);
    setMessage("正在启动麦克风…");
    try {
      recognition.start();
    } catch {
      setListening(false);
      setHasError(true);
      setMessage("麦克风正在忙碌，请稍后重试或继续使用文本输入。");
    }
  }, [listening]);

  return {
    supported,
    listening,
    message:
      supported === false && !message ? SPEECH_UNSUPPORTED_MESSAGE : message,
    hasError,
    toggle,
  };
}
