import type { Client } from '@botpress/client';
import { normalizePromptRow } from '@/lib/promptVersions';

export async function fetchPromptRows(client: Client) {
  const response = await client.findTableRows({
    table: 'promptsTable',
    limit: 100,
    orderBy: 'updatedAt',
    orderDirection: 'desc',
  });
  return response.rows.map((row: Record<string, unknown>) => normalizePromptRow(row));
}
