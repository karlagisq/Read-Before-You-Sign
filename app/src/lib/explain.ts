import type { Report } from "./types";

/**
 * Turns the structured findings into a short plain-English paragraph.
 *
 * Two modes:
 *   - template(): deterministic, no API key needed. Always available.
 *   - llm():      nicer phrasing via an LLM, given ONLY the structured facts.
 *
 * Either way the SCORE AND FLAGS are fixed before we get here, so the wording
 * can't change the verdict.
 */

export function template(r: Omit<Report, "explanation" | "explanationSource">): string {
  if (r.flags.length === 0) {
    return "Nothing risky stood out. This looks like a normal transaction, but always confirm the amounts and who you're sending to.";
  }
  const lead =
    r.level === "high"
      ? "Be careful before signing this."
      : r.level === "medium"
      ? "Look closely before signing this."
      : "A couple of small things to note.";
  const points = r.flags.map((f) => `• ${f.title}: ${f.detail}`).join("\n");
  return `${lead}\n\n${points}`;
}

interface LlmFacts {
  level: string;
  score: number;
  flags: { title: string; detail: string; severity: string }[];
  balanceChanges: Report["simulation"]["balanceChanges"];
}

export async function llm(
  facts: LlmFacts,
  apiKey: string
): Promise<string> {
  const system =
    "You explain Solana transactions to non-experts. You are given STRUCTURED FINDINGS from a deterministic analyzer. Explain them in 2-4 short sentences, plain language, no jargon. Do NOT invent findings or soften the risk level you are given. Do not add a verdict beyond what the findings say.";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-5-5",
      max_tokens: 300,
      system,
      messages: [{ role: "user", content: JSON.stringify(facts) }],
    }),
  });

  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text?.trim() ?? "";
}
