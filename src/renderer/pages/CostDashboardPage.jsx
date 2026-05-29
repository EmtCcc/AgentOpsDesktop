import { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// ── Icons ──

const IconDollar = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const IconRefresh = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const IconBot = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" /><rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="6" y="14" width="12" height="8" rx="2" ry="2" /><path d="M12 16v4" />
  </svg>
);

const IconList = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const IconTrending = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);

const IconCpu = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect x="9" y="9" width="6" height="6" />
    <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
    <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
  </svg>
);

// ── Helpers ──

function formatUsd(n) {
  if (n === null || n === undefined) return '$0.00';
  return '$' + Number(n).toFixed(2);
}

function formatTokens(n) {
  if (n === null || n === undefined) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function formatPct(n) {
  if (n === null || n === undefined) return '0%';
  return Math.min(100, Math.round(n)) + '%';
}

function getMonthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function getDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ── Period Selector ──

const PERIODS = [
  { key: '7d', label: '7 Days', days: 7 },
  { key: '30d', label: '30 Days', days: 30 },
  { key: '90d', label: '90 Days', days: 90 },
  { key: 'month', label: 'This Month', since: getMonthStart() },
];

// ── Sub-components ──

function SummaryCard({ label, value, sub, color, icon }) {
  return (
    <div className="cost-summary-card">
      <div className="cost-summary-card__icon" style={{ color }}>{icon}</div>
      <div className="cost-summary-card__content">
        <div className="cost-summary-card__value">{value}</div>
        <div className="cost-summary-card__label">{label}</div>
        {sub && <div className="cost-summary-card__sub">{sub}</div>}
      </div>
    </div>
  );
}

function BudgetProgressBar({ budget }) {
  if (!budget || !budget.monthlyLimit) return null;
  const pct = (budget.currentSpend / budget.monthlyLimit) * 100;
  const barColor = pct >= budget.stopPct ? 'var(--color-danger)'
    : pct >= budget.pausePct ? 'var(--color-warning)'
    : pct >= budget.warnPct ? 'var(--color-warning)'
    : 'var(--color-success)';

  return (
    <div className="cost-budget-bar">
      <div className="cost-budget-bar__header">
        <span className="cost-budget-bar__agent">{budget.agentId}</span>
        <span className="cost-budget-bar__amount">
          {formatUsd(budget.currentSpend)} / {formatUsd(budget.monthlyLimit)}
        </span>
      </div>
      <div className="cost-budget-bar__track">
        <div
          className="cost-budget-bar__fill"
          style={{ width: Math.min(100, pct) + '%', background: barColor }}
        />
        <div className="cost-budget-bar__warn" style={{ left: budget.warnPct + '%' }} title={'Warn at ' + budget.warnPct + '%'} />
        <div className="cost-budget-bar__pause" style={{ left: budget.pausePct + '%' }} title={'Pause at ' + budget.pausePct + '%'} />
      </div>
      <div className="cost-budget-bar__labels">
        <span style={{ color: barColor }}>{formatPct(pct)} used</span>
        <span className="cost-budget-bar__status" data-status={budget.status}>{budget.status}</span>
      </div>
    </div>
  );
}

function BarChart({ data, maxVal, labelKey, valueKey, formatFn, color }) {
  if (!data || data.length === 0) {
    return <div className="cost-chart-empty">No data available</div>;
  }
  const max = maxVal || Math.max(...data.map((d) => d[valueKey] || 0), 1);

  return (
    <div className="cost-bar-chart" role="img" aria-label="Bar chart">
      {data.map((item, i) => {
        const val = item[valueKey] || 0;
        const pct = (val / max) * 100;
        return (
          <div className="cost-bar-chart__row" key={item[labelKey] || i}>
            <div className="cost-bar-chart__label" title={item[labelKey]}>
              {item[labelKey]}
            </div>
            <div className="cost-bar-chart__track">
              <div
                className="cost-bar-chart__fill"
                style={{ width: pct + '%', background: color || 'var(--color-primary)' }}
              />
            </div>
            <div className="cost-bar-chart__value">{formatFn ? formatFn(val) : val}</div>
          </div>
        );
      })}
    </div>
  );
}

function TrendChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="cost-chart-empty">No trend data available</div>;
  }

  const maxCost = Math.max(...data.map((d) => d.total_cost || 0), 0.01);
  const maxTokens = Math.max(...data.map((d) => d.total_tokens || 0), 1);
  const chartHeight = 160;

  return (
    <div className="cost-trend-chart" role="img" aria-label="Cost trend chart">
      <div className="cost-trend-chart__y-axis">
        <span>{formatUsd(maxCost)}</span>
        <span>{formatUsd(maxCost / 2)}</span>
        <span>$0</span>
      </div>
      <div className="cost-trend-chart__bars">
        {data.map((d, i) => {
          const costH = maxCost > 0 ? (d.total_cost / maxCost) * chartHeight : 0;
          const tokenH = maxTokens > 0 ? (d.total_tokens / maxTokens) * chartHeight : 0;
          const dayLabel = d.day ? new Date(d.day + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
          return (
            <div className="cost-trend-chart__col" key={d.day || i} title={`${dayLabel}: ${formatUsd(d.total_cost)}, ${formatTokens(d.total_tokens)} tokens`}>
              <div className="cost-trend-chart__bar-group">
                <div className="cost-trend-chart__bar cost-trend-chart__bar--cost" style={{ height: costH + 'px' }} />
                <div className="cost-trend-chart__bar cost-trend-chart__bar--tokens" style={{ height: tokenH + 'px' }} />
              </div>
              <div className="cost-trend-chart__label">{dayLabel}</div>
            </div>
          );
        })}
      </div>
      <div className="cost-trend-chart__legend">
        <span className="cost-trend-chart__legend-item"><span className="cost-trend-chart__dot cost-trend-chart__dot--cost" /> Cost (USD)</span>
        <span className="cost-trend-chart__legend-item"><span className="cost-trend-chart__dot cost-trend-chart__dot--tokens" /> Tokens</span>
      </div>
    </div>
  );
}

// ── Main Page ──

function CostDashboardPage() {
  const [period, setPeriod] = useState(PERIODS[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [totalSpend, setTotalSpend] = useState(0);
  const [budgets, setBudgets] = useState([]);
  const [agentTokens, setAgentTokens] = useState([]);
  const [modelSpend, setModelSpend] = useState([]);
  const [taskSpend, setTaskSpend] = useState([]);
  const [trends, setTrends] = useState([]);

  const since = period.since || getDaysAgo(period.days);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [report, tokensByAgent, byModel, byTask, trendData] = await Promise.all([
        window.agentOps.cost.getCostReport({ since }),
        window.agentOps.cost.getTokensByAgent({ since }),
        window.agentOps.cost.getSpendByModel({ since }),
        window.agentOps.cost.getSpendByTask({ since, limit: 20 }),
        window.agentOps.cost.getSpendTrends({ since }),
      ]);

      setTotalSpend(report?.totalSpend || 0);
      setBudgets(report?.budgets || []);
      setAgentTokens(tokensByAgent || []);
      setModelSpend(byModel || []);
      setTaskSpend(byTask || []);
      setTrends(trendData || []);
    } catch (err) {
      setError(err.message || 'Failed to load cost data');
    } finally {
      setLoading(false);
    }
  }, [since]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const totalTokens = agentTokens.reduce((s, a) => s + (a.totalTokens || 0), 0);
  const totalRequests = agentTokens.reduce((s, a) => s + (a.requestCount || 0), 0);
  const avgCostPerRequest = totalRequests > 0 ? totalSpend / totalRequests : 0;

  return (
    <div className="cost-dashboard">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Cost Dashboard</h1>
          <p className="page-header__desc">Token usage, cost breakdowns, and budget tracking</p>
        </div>
        <div className="page-header__actions">
          <div className="cost-period-selector" role="group" aria-label="Time period">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                className={'btn btn--sm ' + (period.key === p.key ? 'btn--primary' : 'btn--ghost')}
                onClick={() => setPeriod(p)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button className="btn btn--ghost btn--sm" onClick={loadAll} disabled={loading}>
            <IconRefresh /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="cost-error" role="alert">{error}</div>
      )}

      {/* Summary Cards */}
      <div className="cost-summary-grid" role="region" aria-label="Cost summary">
        <SummaryCard
          label="Total Spend"
          value={formatUsd(totalSpend)}
          sub={period.label}
          color="var(--color-primary)"
          icon={<IconDollar />}
        />
        <SummaryCard
          label="Total Tokens"
          value={formatTokens(totalTokens)}
          sub={formatTokens(agentTokens.reduce((s, a) => s + (a.totalInputTokens || 0), 0)) + ' input / ' + formatTokens(agentTokens.reduce((s, a) => s + (a.totalOutputTokens || 0), 0)) + ' output'}
          color="var(--color-info)"
          icon={<IconCpu />}
        />
        <SummaryCard
          label="Total Requests"
          value={totalRequests.toLocaleString()}
          sub={'Avg ' + formatUsd(avgCostPerRequest) + ' / request'}
          color="var(--color-success)"
          icon={<IconList />}
        />
        <SummaryCard
          label="Active Budgets"
          value={budgets.filter((b) => b.status === 'active').length}
          sub={budgets.length + ' total'}
          color="var(--color-warning)"
          icon={<IconTrending />}
        />
      </div>

      {/* Budget Utilization */}
      {budgets.length > 0 && (
        <div className="cost-section">
          <h2 className="cost-section__title">Budget Utilization</h2>
          <div className="cost-budgets-grid">
            {budgets.map((b) => <BudgetProgressBar key={b.id} budget={b} />)}
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="cost-main-grid">
        {/* Per-Agent Token Usage */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title"><IconBot /> Per-Agent Token Usage</h3>
          </div>
          <div className="card__body">
            <BarChart
              data={agentTokens.map((a) => ({
                _label: a.agentName || a.agentId || 'Unknown',
                _tokens: a.totalTokens || 0,
                _cost: a.totalCost || 0,
              }))}
              labelKey="_label"
              valueKey="_tokens"
              formatFn={formatTokens}
              color="var(--color-info)"
            />
            {agentTokens.length > 0 && (
              <div className="cost-table">
                <div className="cost-table__header">
                  <span>Agent</span><span>Input</span><span>Output</span><span>Cost</span><span>Requests</span>
                </div>
                {agentTokens.map((a) => (
                  <div className="cost-table__row" key={a.agentId}>
                    <span className="cost-table__name">{a.agentName || a.agentId}</span>
                    <span>{formatTokens(a.totalInputTokens)}</span>
                    <span>{formatTokens(a.totalOutputTokens)}</span>
                    <span>{formatUsd(a.totalCost)}</span>
                    <span>{a.requestCount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cost per Model */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title"><IconCpu /> Cost per Model</h3>
          </div>
          <div className="card__body">
            <BarChart
              data={modelSpend.map((m) => ({
                _label: m.model || 'Unknown',
                _cost: m.total_cost || 0,
              }))}
              labelKey="_label"
              valueKey="_cost"
              formatFn={formatUsd}
              color="var(--color-primary)"
            />
            {modelSpend.length > 0 && (
              <div className="cost-table">
                <div className="cost-table__header">
                  <span>Model</span><span>Tokens</span><span>Cost</span><span>Requests</span>
                </div>
                {modelSpend.map((m) => (
                  <div className="cost-table__row" key={m.model || 'unknown'}>
                    <span className="cost-table__name">{m.model || 'Unknown'}</span>
                    <span>{formatTokens(m.total_tokens)}</span>
                    <span>{formatUsd(m.total_cost)}</span>
                    <span>{m.request_count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Daily/Weekly/Monthly Trends */}
      <div className="cost-section">
        <h2 className="cost-section__title"><IconTrending /> Spending Trends</h2>
        <div className="card">
          <div className="card__body">
            <TrendChart data={trends} />
          </div>
        </div>
      </div>

      {/* Per-Task Cost Breakdown */}
      <div className="cost-section">
        <h2 className="cost-section__title"><IconList /> Per-Task Cost Breakdown</h2>
        <div className="card">
          <div className="card__body">
            {taskSpend.length === 0 ? (
              <div className="cost-chart-empty">No task cost data available</div>
            ) : (
              <div className="cost-table cost-table--full">
                <div className="cost-table__header">
                  <span>Task</span><span>Agent</span><span>Tokens</span><span>Cost</span><span>Requests</span>
                </div>
                {taskSpend.map((t) => (
                  <div className="cost-table__row" key={t.task_id}>
                    <span className="cost-table__name">{t.task_title || t.task_id}</span>
                    <span>{t.agent_name || '-'}</span>
                    <span>{formatTokens(t.total_tokens)}</span>
                    <span>{formatUsd(t.total_cost)}</span>
                    <span>{t.request_count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="cost-loading" role="status">
          <div className="cost-loading__spinner" />
          <span>Loading cost data...</span>
        </div>
      )}
    </div>
  );
}

export function mountCostDashboardPage(container) {
  const root = createRoot(container);
  root.render(<CostDashboardPage />);
  return () => root.unmount();
}
