import { useId } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { MessageCircle, MessageSquare, Coins } from 'lucide-react';
import {
  EmptyState,
  Metric,
  MetricGrid,
  Section,
} from '@/components/dashboard';
import type { useAnalytics } from '@/queries/useAnalytics';
import './analytics.css';

type AnalyticsData = NonNullable<ReturnType<typeof useAnalytics>['data']>;

function ChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{
    value?: number | string;
    name?: string;
    payload?: { fullDate?: string };
  }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="analytics-tooltip">
      <p className="text-xs text-muted-foreground">
        {payload[0].payload?.fullDate || label}
      </p>
      {payload.map((entry, index) => (
        <p
          key={index}
          className="mt-2 flex items-baseline justify-between gap-6 text-xs"
        >
          <span>{entry.name}</span>
          <strong className="text-base font-semibold tabular-nums">
            {typeof entry.value === 'number'
              ? entry.value.toLocaleString()
              : entry.value}
          </strong>
        </p>
      ))}
    </div>
  );
}

const usd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);

export function AnalyticsOverview({ data }: { data: AnalyticsData }) {
  const { summary, analyticsData, sentimentData, resolutionData } = data;
  const gradientId = useId();
  const chartData = analyticsData.map((record) => ({
    date: format(new Date(record.date), 'MMM d'),
    fullDate: format(new Date(record.date), 'MMM d, yyyy'),
    users: record.uniqueUsers,
    userMessages: record.userMessages,
  }));
  const sentimentTotal = sentimentData.reduce(
    (sum, item) => sum + item.value,
    0,
  );
  const axis = {
    tickLine: false,
    axisLine: false,
    tickMargin: 12,
    tick: { fill: 'var(--muted-foreground)', fontSize: 11 },
  };

  return (
    <div className="analytics-overview">
      {summary && (
        <div className="analytics-metrics">
          <MetricGrid columns={3}>
            <Metric
              label="Conversations"
              icon={<MessageSquare />}
              value={summary.totalConversations.toLocaleString()}
            />
            <Metric
              label="User messages"
              icon={<MessageCircle />}
              value={summary.totalUserMessages.toLocaleString()}
            />
            <Metric
              label="AI cost / conversation"
              icon={<Coins />}
              value={
                summary.avgAiCostPerConversationUsd === null
                  ? '—'
                  : usd(summary.avgAiCostPerConversationUsd)
              }
              helper={
                summary.totalAiCostUsd === null
                  ? 'AI spend unavailable'
                  : `${usd(summary.totalAiCostUsd)} total AI spend`
              }
            />
          </MetricGrid>
        </div>
      )}

      {!!analyticsData.length && (
        <div className="analytics-charts">
          <Section
            variant="surface"
            className="analytics-activity"
            title="Conversation activity"
            description="Daily volume over the selected period"
            actions={
              <span className="analytics-legend">
                <i />
                Conversations
              </span>
            }
          >
            <div
              className="analytics-chart"
              role="region"
              aria-label="Daily conversation activity chart"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  accessibilityLayer
                  data={chartData}
                  margin={{ top: 22, right: 12, bottom: 10, left: 0 }}
                >
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--analytics-accent)"
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--analytics-accent)"
                        stopOpacity={0.01}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border)"
                    strokeDasharray="3 6"
                  />
                  <XAxis {...axis} dataKey="date" minTickGap={32} />
                  <YAxis {...axis} allowDecimals={false} width={48} />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{
                      stroke: 'var(--analytics-accent)',
                      strokeDasharray: '3 4',
                      strokeOpacity: 0.4,
                    }}
                  />
                  <Area
                    name="Conversations"
                    dataKey="users"
                    type="monotone"
                    stroke="var(--analytics-accent)"
                    strokeWidth={2.5}
                    fill={`url(#${gradientId})`}
                    isAnimationActive={false}
                    dot={
                      chartData.length === 1
                        ? { r: 4, fill: 'var(--analytics-accent)' }
                        : false
                    }
                    activeDot={{
                      r: 5,
                      strokeWidth: 3,
                      stroke: 'var(--surface)',
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section
            variant="surface"
            className="analytics-sentiment"
            title="Sentiment"
            description="How conversations are perceived"
          >
            {sentimentData.length ? (
              <div className="analytics-sentiment-list">
                {sentimentData.map((item) => {
                  const percent = sentimentTotal
                    ? Math.round((item.value / sentimentTotal) * 100)
                    : 0;
                  return (
                    <div key={item.name} className="analytics-sentiment-row">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span>{item.name}</span>
                        <span className="flex items-baseline gap-2 tabular-nums">
                          <strong className="font-medium">
                            {item.value.toLocaleString()}
                          </strong>
                          <span className="w-10 text-right text-xs text-muted-foreground">
                            {percent}%
                          </span>
                        </span>
                      </div>
                      <div className="analytics-track" aria-hidden="true">
                        <div
                          style={{
                            width: `${percent}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="No sentiment data" />
            )}
          </Section>

          <Section
            variant="surface"
            className="analytics-resolution"
            title="Resolution"
            description="Conversation outcomes"
          >
            {resolutionData ? (
              <>
                <div className="analytics-gauge">
                  <svg
                    viewBox="0 0 260 150"
                    role="img"
                    aria-label={`${resolutionData.resolutionRate}% resolved`}
                  >
                    <path
                      d="M 28 128 A 102 102 0 0 1 232 128"
                      fill="none"
                      stroke="var(--analytics-track)"
                      strokeWidth="18"
                      strokeLinecap="round"
                    />
                    {resolutionData.resolutionRate > 0 && (
                      <path
                        d="M 28 128 A 102 102 0 0 1 232 128"
                        fill="none"
                        stroke="var(--analytics-accent)"
                        strokeWidth="18"
                        strokeLinecap="round"
                        pathLength="100"
                        strokeDasharray={`${resolutionData.resolutionRate} 100`}
                      />
                    )}
                    <text
                      x="130"
                      y="108"
                      textAnchor="middle"
                      className="analytics-gauge-value"
                    >
                      {resolutionData.resolutionRate}%
                    </text>
                    <text
                      x="130"
                      y="132"
                      textAnchor="middle"
                      className="analytics-gauge-label"
                    >
                      Resolved
                    </text>
                  </svg>
                </div>
                <div className="analytics-outcomes">
                  <div>
                    <span>
                      <i className="bg-success" />
                      Resolved
                    </span>
                    <strong>{resolutionData.resolved.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>
                      <i className="bg-danger" />
                      Unresolved
                    </span>
                    <strong>
                      {resolutionData.unresolved.toLocaleString()}
                    </strong>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState title="No resolution data" />
            )}
          </Section>

          <Section
            variant="surface"
            className="analytics-messages"
            title="Message activity"
            description="Daily user message volume"
            actions={
              <span className="analytics-legend">
                <i />
                Messages
              </span>
            }
          >
            {summary && (
              <div className="analytics-message-metrics">
                <MetricGrid columns={2}>
                  <Metric
                    label="User messages"
                    value={summary.totalUserMessages.toLocaleString()}
                    helper={`${summary.avgUserMessagesPerConversation} per conversation`}
                  />
                  <Metric
                    label="Bot responses"
                    value={summary.totalBotMessages.toLocaleString()}
                    helper={`${summary.avgBotMessagesPerConversation} per conversation`}
                  />
                </MetricGrid>
              </div>
            )}
            <div
              className="analytics-chart"
              role="region"
              aria-label="Daily user message volume chart"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  accessibilityLayer
                  data={chartData}
                  margin={{ top: 22, right: 12, bottom: 10, left: 0 }}
                  barCategoryGap="28%"
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border)"
                    strokeDasharray="3 6"
                  />
                  <XAxis {...axis} dataKey="date" minTickGap={32} />
                  <YAxis {...axis} allowDecimals={false} width={48} />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: 'var(--analytics-track)', radius: 6 }}
                  />
                  <Bar
                    name="User messages"
                    dataKey="userMessages"
                    fill="var(--analytics-bar)"
                    activeBar={{ fill: 'var(--analytics-accent)' }}
                    radius={[5, 5, 0, 0]}
                    maxBarSize={36}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
