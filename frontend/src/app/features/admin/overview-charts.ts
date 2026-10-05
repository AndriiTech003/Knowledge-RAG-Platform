import type { EChartsCoreOption } from 'echarts/core';
import { DailyPoint, Percentiles } from '../../core/api/models';
import { stepLabel } from './labels';

const STEP_ORDER = ['acl', 'condense', 'embed', 'vector', 'lexical', 'fetch', 'rerank', 'first_token', 'generate', 'total'];

export function questionsChart(daily: DailyPoint[]): EChartsCoreOption {
  const questions = $localize`:@@admin.overview.chart.questions:Questions`;
  const noAnswer = $localize`:@@admin.overview.chart.noAnswer:No answer`;
  const users = $localize`:@@admin.overview.chart.users:Users`;
  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0, data: [questions, noAnswer, users] },
    grid: { left: 40, right: 16, top: 40, bottom: 32 },
    xAxis: { type: 'category', data: daily.map((d) => d.day) },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: questions, type: 'bar', data: daily.map((d) => d.questions) },
      { name: noAnswer, type: 'bar', data: daily.map((d) => d.no_answer) },
      { name: users, type: 'line', smooth: true, data: daily.map((d) => d.users) },
    ],
  };
}

export function latencyCostChart(daily: DailyPoint[]): EChartsCoreOption {
  const latency = $localize`:@@admin.overview.chart.p95Latency:p95 latency (ms)`;
  const cost = $localize`:@@admin.overview.chart.cost:Cost (USD)`;
  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0, data: [latency, cost] },
    grid: { left: 48, right: 56, top: 40, bottom: 32 },
    xAxis: { type: 'category', data: daily.map((d) => d.day) },
    yAxis: [
      { type: 'value', name: 'ms' },
      { type: 'value', name: 'USD' },
    ],
    series: [
      { name: latency, type: 'line', smooth: true, data: daily.map((d) => d.p95_ms ?? 0) },
      { name: cost, type: 'bar', yAxisIndex: 1, data: daily.map((d) => d.cost_usd) },
    ],
  };
}

export function stepsChart(steps: Record<string, Percentiles>): EChartsCoreOption {
  const keys = Object.keys(steps).sort((a, b) => {
    const ia = STEP_ORDER.indexOf(a);
    const ib = STEP_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, data: ['p50', 'p95'] },
    grid: { left: 90, right: 24, top: 40, bottom: 24 },
    xAxis: { type: 'value', name: 'ms' },
    yAxis: { type: 'category', data: keys.map((k) => stepLabel(k)), inverse: true },
    series: [
      { name: 'p50', type: 'bar', data: keys.map((k) => steps[k]?.p50 ?? 0) },
      { name: 'p95', type: 'bar', data: keys.map((k) => steps[k]?.p95 ?? 0) },
    ],
  };
}

export function rangeFor(days: number, now: Date = new Date()): { from: string; to: string } {
  const to = new Date(now);
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}
