export type PromptVersion = 'live' | 'testing' | 'legacy';

export interface PromptRow {
  id: number;
  label: string;
  prompt: string;
  version: PromptVersion;
  deployDate: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface PromotionInput {
  live?: PromptRow | null;
  testing: PromptRow;
  now: string;
}

const VERSION_PRIORITY: Record<PromptVersion, number> = {
  live: 0,
  testing: 1,
  legacy: 2,
};

function normalizePromptVersion(value: unknown): PromptVersion {
  if (value === 'live' || value === 'testing' || value === 'legacy') {
    return value;
  }

  return 'legacy';
}

function getPromptSortDate(prompt: PromptRow): number {
  const candidate = prompt.deployDate ?? prompt.updatedAt ?? prompt.createdAt;
  const timestamp = candidate ? Date.parse(candidate) : Number.NaN;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function normalizePromptRow(row: Record<string, unknown>): PromptRow {
  return {
    id: Number(row.id ?? 0),
    label: String(row.label ?? '').trim(),
    prompt: String(row.prompt ?? ''),
    version: normalizePromptVersion(row.version),
    deployDate: row.deployDate ? String(row.deployDate) : null,
    createdAt: row.createdAt ? String(row.createdAt) : undefined,
    updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
  };
}

export function sortPromptRows(rows: PromptRow[]): PromptRow[] {
  return [...rows].sort((left, right) => {
    const versionDiff = VERSION_PRIORITY[left.version] - VERSION_PRIORITY[right.version];

    if (versionDiff !== 0) {
      return versionDiff;
    }

    return getPromptSortDate(right) - getPromptSortDate(left);
  });
}

export function partitionPromptRows(rows: PromptRow[]) {
  const sortedRows = sortPromptRows(rows);

  return {
    live: sortedRows.find((row) => row.version === 'live') ?? null,
    testing: sortedRows.find((row) => row.version === 'testing') ?? null,
    legacy: sortedRows.filter((row) => row.version === 'legacy'),
  };
}

export function getPromptSelectionKey(prompt: PromptRow): string {
  return prompt.version === 'legacy' ? `legacy:${prompt.id}` : prompt.version;
}

export function buildTestingDraftValues(source?: PromptRow | null) {
  const baseLabel = source?.label?.trim();

  return {
    label: baseLabel || 'Testing draft',
    prompt: source?.prompt ?? '',
    version: 'testing' as const,
    deployDate: null as string | null,
  };
}

export function buildPromotionUpdates({ live, testing, now }: PromotionInput) {
  const updates: Array<{ id: number; [key: string]: unknown }> = [];

  if (live) {
    updates.push({
      id: live.id,
      version: 'legacy',
      deployDate: live.deployDate,
    });
  }

  updates.push({
    id: testing.id,
    version: 'live',
    deployDate: now,
  });

  return updates;
}
