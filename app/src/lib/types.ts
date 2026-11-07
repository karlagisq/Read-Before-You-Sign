// Amounts are strings because u64 values don't fit in a JS number and
// BigInt can't be sent as JSON.

export type Severity = "info" | "warning" | "danger";

export interface DecodedInstruction {
  index: number;
  programId: string;
  programName: string;
  known: boolean;
  type: string; // e.g. "Approve", "Transfer", "unknown"
  summary: string; // one human line
  accounts: string[];
  details: Record<string, string>;
}

export interface BalanceChange {
  address: string;
  kind: "sol" | "token";
  mint?: string;
  owner?: string;
  before: string; // lamports or token base units
  after: string;
  delta: string;
}

export interface DelegateChange {
  tokenAccount: string;
  mint: string;
  owner: string;
  delegateBefore: string | null;
  delegateAfter: string | null;
  delegatedAmountAfter: string;
}

export interface OwnerChange {
  tokenAccount: string;
  before: string;
  after: string;
}

export interface SimulationResult {
  ok: boolean;
  error: string | null;
  logs: string[];
  unitsConsumed: number | null;
  balanceChanges: BalanceChange[];
  delegateChanges: DelegateChange[];
  ownerChanges: OwnerChange[];
}

export interface RiskFlag {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
}

export type RiskLevel = "low" | "medium" | "high";

export interface Report {
  feePayer: string;
  instructions: DecodedInstruction[];
  simulation: SimulationResult;
  flags: RiskFlag[];
  score: number; // 0-100, from rules only
  level: RiskLevel;
  explanation: string;
  explanationSource: "llm" | "template";
}
