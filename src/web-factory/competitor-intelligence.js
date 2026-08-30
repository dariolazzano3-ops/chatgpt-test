const arr = (v) => Array.isArray(v) ? v : [];
const text = (v, max = 400) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function analyzeCompetitorReferences(input = []) {
  const competitors = arr(input).slice(0, 12).map((item, index) => ({
    reference_id: text(item?.reference_id || `competitor-${index + 1}`, 120),
    source: text(item?.source || 'operator-supplied', 500),
    site_structure: arr(item?.analysis?.site_structure).map(String),
    offers: arr(item?.analysis?.offers).map(String),
    ctas: arr(item?.analysis?.ctas).map(String),
    trust_elements: arr(item?.analysis?.trust_elements).map(String),
    content_patterns: arr(item?.analysis?.content_patterns).map(String),
    page_depth: Number(item?.analysis?.page_depth || 0),
    navigation: arr(item?.analysis?.navigation).map(String),
    seo_themes: arr(item?.analysis?.seo_themes).map(String),
    conversion_mechanics: arr(item?.analysis?.conversion_mechanics).map(String),
    visual_patterns: arr(item?.analysis?.visual_patterns).map(String),
    weaknesses: arr(item?.analysis?.weaknesses).map(String),
    evidence_status: item?.analysis ? 'STRUCTURED_EVIDENCE_ANALYZED' : 'EXTERNAL_ANALYSIS_REQUIRED'
  }));
  const count = (field) => {
    const map = new Map();
    competitors.flatMap((item) => item[field] || []).forEach((value) => map.set(value, (map.get(value) || 0) + 1));
    return [...map.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([pattern, occurrences]) => ({ pattern, occurrences }));
  };
  const marketPatterns = { ctas: count('ctas'), trust: count('trust_elements'), content: count('content_patterns'), seo: count('seo_themes'), conversion: count('conversion_mechanics'), visual: count('visual_patterns') };
  const weaknesses = [...new Set(competitors.flatMap((item) => item.weaknesses))];
  const opportunities = [
    ...weaknesses.map((weakness) => `Differentiate by directly resolving competitor weakness: ${weakness}`),
    ...(marketPatterns.trust.length ? ['Retain category-expected trust signals while improving specificity and proof quality.'] : ['Introduce explicit trust signals appropriate to the industry.']),
    'Use original copy, original assets and owned implementation rather than competitor cloning.'
  ];
  return {
    schema: 'riosystems.competitor-intelligence.v1', competitors_analyzed: competitors.filter((item) => item.evidence_status === 'STRUCTURED_EVIDENCE_ANALYZED').length,
    competitor_insights: competitors, market_patterns: marketPatterns, weaknesses, opportunities,
    recommended_differentiation: opportunities.slice(0, 8), copying_allowed: false, external_runtime_claimed: false
  };
}
