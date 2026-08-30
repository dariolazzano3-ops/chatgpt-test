export function createScreenshotComparisonJob(input = {}) {
  const viewports = Array.isArray(input.viewports) && input.viewports.length
    ? input.viewports
    : [
        { id: 'mobile', width: 390, height: 844 },
        { id: 'tablet', width: 768, height: 1024 },
        { id: 'desktop', width: 1440, height: 1200 }
      ];

  return {
    schema: 'riosystems.screenshot-comparison-job.v1',
    design_id: String(input.design_id || ''),
    project_id: String(input.project_id || ''),
    reference_source: input.reference_source || null,
    generated_source: input.generated_source || null,
    viewports,
    pipeline: ['REFERENCE_SCREENSHOT', 'GENERATED_SCREENSHOT', 'COMPARE', 'DIFFERENCE_REPORT', 'REPAIR', 'RETEST'],
    browser_runtime_required: true,
    pixel_comparison_claimed: false,
    production_deploy: false,
    variable_cost_ceiling_eur: 0
  };
}

export async function runScreenshotComparison(job, adapters = {}) {
  if (typeof adapters.capture !== 'function' || typeof adapters.compare !== 'function') {
    return {
      schema: 'riosystems.screenshot-comparison-report.v1',
      status: 'NOT_EXECUTED_RUNTIME_UNAVAILABLE',
      job,
      executed: false,
      pixel_comparison_claimed: false,
      metrics: null,
      differences: [],
      blocker: {
        code: 'BROWSER_SCREENSHOT_RUNTIME_REQUIRED',
        message: 'A browser capture and image comparison adapter must be supplied before pixel-level fidelity can be measured.'
      }
    };
  }

  const results = [];
  for (const viewport of job.viewports) {
    const reference = await adapters.capture({ source: job.reference_source, viewport, kind: 'reference' });
    const generated = await adapters.capture({ source: job.generated_source, viewport, kind: 'generated' });
    const comparison = await adapters.compare({ reference, generated, viewport });
    results.push({ viewport, comparison });
  }

  return {
    schema: 'riosystems.screenshot-comparison-report.v1',
    status: 'EXECUTED',
    job,
    executed: true,
    pixel_comparison_claimed: true,
    metrics: results,
    differences: results.flatMap((item) => item.comparison?.differences || [])
  };
}
