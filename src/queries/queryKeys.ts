// Resource prefixes allow mutations to invalidate every cached page/filter.
// Never include credentials in query keys or cached data.
export const queryKeys = {
  resourceRoot: (workspaceId: string, botId: string, resource: string) =>
    ['botpress', workspaceId, botId, resource] as const,
  resource: (workspaceId: string, botId: string, resource: string, params: unknown = {}) =>
    ['botpress', workspaceId, botId, resource, params] as const,
};
