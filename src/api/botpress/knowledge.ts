import type { Client } from '@botpress/client';

export interface LearningEntry {
  id: number;
  question: string;
  answer: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IntroEntry {
  id: number;
  sentence: string;
  season: string;
  live: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CodeTextEntry {
  id: number;
  code: string;
  text: string;
  createdAt?: string;
}

// Complete datasets preserve the table views and intro publication preview.
// Requests are bounded, but the visible data is never silently truncated.
export async function fetchKnowledgeRows(client: Client, table: string, signal?: AbortSignal) {
  const rows: Awaited<ReturnType<Client['findTableRows']>>['rows'] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    signal?.throwIfAborted();
    const page = await client.findTableRows({
      table,
      limit,
      offset,
      orderBy: 'createdAt',
      orderDirection: 'desc',
    });
    signal?.throwIfAborted();
    rows.push(...page.rows);
    if (page.rows.length < limit) return rows;
  }
}

export async function fetchLearnings(client: Client, signal?: AbortSignal): Promise<LearningEntry[]> {
  return (await fetchKnowledgeRows(client, 'learningsTable', signal)).map(row => ({
    id: row.id,
    question: row.question as string,
    answer: row.answer as string,
    tags: (row.tags as string[]) || [],
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
  }));
}

export async function fetchIntroRows(client: Client, signal?: AbortSignal): Promise<IntroEntry[]> {
  return (await fetchKnowledgeRows(client, 'introTable', signal)).map(row => ({
    id: row.id,
    sentence: typeof row.sentence === 'string' ? row.sentence : '',
    season: typeof row.season === 'string' ? row.season : '',
    live: typeof row.live === 'boolean'
      ? (row.live ? 'yes' : 'no')
      : typeof row.live === 'string' ? row.live.toLowerCase() : '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function fetchCodeTextRows(client: Client, signal?: AbortSignal): Promise<CodeTextEntry[]> {
  return (await fetchKnowledgeRows(client, 'codeTextTable', signal)).map(row => ({
    id: row.id,
    code: (row.code as string) || '',
    text: (row.text as string) || '',
    createdAt: row.createdAt,
  }));
}
