import { NextResponse } from "next/server";
import type { PostMortem } from "@/types";

export const runtime = "nodejs";

interface Body {
  goal?: string;
  branch?: {
    id?: string;
    name?: string;
    action?: string;
    reason?: string;
    riskLevel?: string;
  } | null;
  execution?: {
    actualYieldPct?: number;
    actualSlippageBps?: number;
    succeeded?: boolean;
    blockedReason?: string;
  } | null;
}

/**
 * Optional LLM enrichment for the epoch post-mortem.
 *
 * - If OPENAI_API_KEY is set, ask the model for a short, structured post-mortem.
 * - If it is missing, or anything fails, return { postMortem: null } so the
 *   client falls back to the deterministic post-mortem. The demo never breaks
 *   on a missing key.
 */
export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ postMortem: null });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ postMortem: null, reason: "no-key" });
  }

  try {
    const sys =
      "You are Axion, an on-chain agentic wallet writing a brief, honest post-mortem of a wallet action you committed to BEFORE acting. Be specific and concise. Respond ONLY with strict JSON: {\"whatWasRight\":[string],\"whatWasWrong\":[string],\"narrative\":string}. No markdown, no preamble.";
    const user = JSON.stringify({
      goal: body.goal,
      chosenBranch: body.branch,
      outcome: body.execution,
      rule: "You committed your prediction before acting and cannot retroactively claim a different forecast.",
    });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ postMortem: null, reason: "upstream-error" });
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<PostMortem>;

    const postMortem: PostMortem = {
      whatWasRight: Array.isArray(parsed.whatWasRight)
        ? parsed.whatWasRight.slice(0, 6).map(String)
        : [],
      whatWasWrong: Array.isArray(parsed.whatWasWrong)
        ? parsed.whatWasWrong.slice(0, 6).map(String)
        : [],
      narrative: typeof parsed.narrative === "string" ? parsed.narrative : "",
      source: "llm",
    };

    if (!postMortem.narrative || postMortem.whatWasRight.length === 0) {
      return NextResponse.json({ postMortem: null, reason: "empty" });
    }

    return NextResponse.json({ postMortem });
  } catch {
    return NextResponse.json({ postMortem: null, reason: "exception" });
  }
}
