export interface BotpressAnalyticsRecord {
  startDateTimeUtc?: string;
  llm?: {
    cost?: {
      sum?: number | null;
    };
  };
}

export interface AiCostMetrics {
  totalAiCostUsd: number;
  avgAiCostPerConversationUsd: number;
}

function roundCurrencyMetric(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

export function sumBotpressAiCost(records: BotpressAnalyticsRecord[]): number {
  return roundCurrencyMetric(
    records.reduce((total, record) => total + (record.llm?.cost?.sum ?? 0), 0)
  );
}

export function calculateAiCostMetrics(
  records: BotpressAnalyticsRecord[],
  conversationCount: number
): AiCostMetrics {
  const totalAiCostUsd = sumBotpressAiCost(records);

  return {
    totalAiCostUsd,
    avgAiCostPerConversationUsd:
      conversationCount > 0 ? roundCurrencyMetric(totalAiCostUsd / conversationCount) : 0,
  };
}
