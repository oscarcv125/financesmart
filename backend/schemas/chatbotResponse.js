const { z } = require('zod');

const ChartDataPoint = z.object({
  name: z.string().min(1).max(20),
  value: z.number(),
  value2: z.number().optional(),
});

const ChartReference = z.object({
  value: z.number(),
  label: z.string(),
}).optional();

const PieChart = z.object({
  type: z.literal('pie'),
  title: z.string().min(1).max(80),
  data: z.array(ChartDataPoint).min(1).max(8),
  reference: ChartReference,
});

const BarChart = z.object({
  type: z.literal('bar'),
  title: z.string().min(1).max(80),
  data: z.array(ChartDataPoint).min(1).max(8),
  reference: ChartReference,
});

const LineChart = z.object({
  type: z.literal('line'),
  title: z.string().min(1).max(80),
  data: z.array(ChartDataPoint).min(1).max(30),
  reference: ChartReference,
});

const ChartSchema = z.discriminatedUnion('type', [PieChart, BarChart, LineChart]);

const SimulatorParam = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
  min: z.number(),
  max: z.number(),
  step: z.number(),
  unit: z.string().optional(),
});

const SimulatorSchema = z.object({
  type: z.enum(['savings_daily', 'category_reduction', 'goal_acceleration', 'compound_savings']),
  title: z.string().min(1).max(80),
  params: z.array(SimulatorParam).min(1).max(5),
  meta: z.object({
    name: z.string(),
    target: z.number(),
    progress: z.number(),
  }).optional(),
});

const StreakSchema = z.object({
  label: z.string().min(1).max(80),
  current: z.number().int().min(0),
  unit: z.string().optional(),
  best: z.number().optional(),
  icon: z.string().optional(),
  context: z.string().optional(),
});

const CompareSchema = z.object({
  title: z.string().min(1).max(80),
  leftLabel: z.string().min(1).max(20),
  rightLabel: z.string().min(1).max(20),
  rows: z.array(z.object({
    label: z.string().min(1).max(30),
    left: z.number(),
    right: z.number(),
  })).min(1).max(8),
});

const WidgetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('chart'), chart: ChartSchema }),
  z.object({ kind: z.literal('simulator'), simulator: SimulatorSchema }),
  z.object({ kind: z.literal('streak'), streak: StreakSchema }),
  z.object({ kind: z.literal('compare'), compare: CompareSchema }),
]);

const ToolCallSchema = z.object({
  name: z.string(),
  args: z.record(z.string(), z.any()),
});

const AportarAction = z.object({
  type: z.literal('aportar'),
  label: z.string(),
  id_meta: z.number().int(),
  nombre_meta: z.string(),
  monto: z.number(),
});

const NavAction = z.object({
  type: z.literal('nav'),
  label: z.string(),
  path: z.string(),
});

const ActionSchema = z.discriminatedUnion('type', [AportarAction, NavAction]);

const ChatbotResponseSchema = z.object({
  text: z.string(),
  widgets: z.array(WidgetSchema).max(2).default([]),
  toolCalls: z.array(ToolCallSchema).optional(),
  actions: z.array(ActionSchema).optional(),
});

/**
 * Validate that a structured chatbot response satisfies an additional set of
 * runtime constraints that aren't representable in JSON Schema (and therefore
 * can't be enforced by the model's structured output mode).
 *
 * Returns { ok: true, data } or { ok: false, errors: string[] }.
 */
function postValidate(parsed) {
  const errors = [];
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, errors: ['no parsed payload'] };
  }
  for (const [i, w] of (parsed.widgets || []).entries()) {
    if (w.kind === 'simulator') {
      for (const [j, p] of w.simulator.params.entries()) {
        if (!(p.max > p.min)) errors.push(`widgets[${i}].simulator.params[${j}]: max must be > min`);
        if (p.value < p.min || p.value > p.max) {
          errors.push(`widgets[${i}].simulator.params[${j}]: value must be in [min, max]`);
        }
      }
    }
  }
  return errors.length === 0 ? { ok: true, data: parsed } : { ok: false, errors };
}

module.exports = {
  ChatbotResponseSchema,
  WidgetSchema,
  ChartSchema,
  PieChart,
  BarChart,
  LineChart,
  SimulatorSchema,
  StreakSchema,
  CompareSchema,
  ToolCallSchema,
  ActionSchema,
  postValidate,
};
