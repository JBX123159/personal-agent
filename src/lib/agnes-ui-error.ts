export function getAgnesDecisionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : "";

  if (!message) {
    return "未知错误";
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "网络连接中断，请重新尝试；未执行任何工具。";
  }
  return message;
}
