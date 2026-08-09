import { NextResponse } from "next/server";

import { parseAgentDecisionRequest } from "@/lib/agent-decision-schema";
import {
  AgnesClientError,
  requestAgnesDecision,
} from "@/lib/agnes-client";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsedRequest = parseAgentDecisionRequest(body);
    const eligibleMemories = parsedRequest.memories.filter(
      (memory) => memory.status === "active" && memory.userConfirmed,
    );
    const decision = await requestAgnesDecision({
      ...parsedRequest,
      memories: eligibleMemories,
    });

    return NextResponse.json({ decision });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "请求 JSON 无效。" }, { status: 400 });
    }

    if (error instanceof AgnesClientError) {
      const status =
        error.code === "NOT_CONFIGURED"
          ? 503
          : error.code === "TIMEOUT"
            ? 504
            : 502;
      return NextResponse.json({ error: error.message }, { status });
    }

    const message =
      error instanceof Error ? error.message : "请求参数无效。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
