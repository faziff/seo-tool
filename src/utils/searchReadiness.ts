import type { ScanReport, ScannedPage } from '../types';

export type ReadinessStatus = 'strong' | 'improve' | 'weak' | 'not-measured';

export interface ReadinessCheck {
  id: string;
  title: string;
  description: string;
  recommendation: string;
  score: number;
  status: ReadinessStatus;
  affected: number;
  evaluated: number;
  weight: number;
}

export interface ReadinessAssessment {
  score: number | null;
  label: string;
  checks: ReadinessCheck[];
  pagesEvaluated: number;
  strongChecks: number;
  improvementCount: number;
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const percent = (good: number, total: number) => total > 0 ? clamp((good / total) * 100) : 0;
const isTrue = (value: unknown) => value === true || value === 1 || value === 'true';
const arr = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

function readinessStatus(score: number): ReadinessStatus {
  if (score >= 80) return 'strong';
  if (score >= 55) return 'improve';
  return 'weak';
}

function makeCheck(
  id: string,
  title: string,
  description: string,
  recommendation: string,
  good: number,
  total: number,
  weight: number
): ReadinessCheck {
  const score = total ? percent(good, total) : 0;
  return { id, title, description, recommendation, score, status: total ? readinessStatus(score) : 'not-measured', affected: Math.max(0, total - good), evaluated: total, weight };
}

function pageSchemaTypes(page: ScannedPage): string[] {
  const extra = page.extra || {};
  return arr(extra.schema_types).map(value => String(value).toLowerCase());
}

function hasAuthorOrDate(page: ScannedPage): boolean {
  const extra = page.extra || {};
  return Boolean(text(extra.author) || text(extra.date_published) || text(extra.date_modified));
}

function hasEntitySignals(page: ScannedPage): boolean {
  const types = pageSchemaTypes(page);
  const extra = page.extra || {};
  return types.some(type => /organization|person|localbusiness|brand|product/.test(type)) || Boolean(text(extra.site_name) || text(extra.publisher_name));
}

function aggregate(checks: ReadinessCheck[], pages: number): ReadinessAssessment {
  if (pages <= 0) return { score: null, label: 'Not measured', checks, pagesEvaluated: 0, strongChecks: 0, improvementCount: 0 };
  const measured = checks.filter(check => check.evaluated > 0);
  const weightTotal = measured.reduce((sum, check) => sum + check.weight, 0);
  const score = weightTotal > 0 ? clamp(measured.reduce((sum, check) => sum + check.score * check.weight, 0) / weightTotal) : null;
  return {
    score,
    label: score === null ? 'Not measured' : score >= 80 ? 'Strong foundation' : score >= 55 ? 'Needs improvement' : 'Priority work needed',
    checks,
    pagesEvaluated: pages,
    strongChecks: checks.filter(check => check.status === 'strong').length,
    improvementCount: checks.filter(check => check.status === 'improve' || check.status === 'weak').length
  };
}

export function assessAEO(report: ScanReport | null): ReadinessAssessment {
  const pages = (report?.pages || []).filter(page => /html|xhtml/i.test(page.content_type || '') && Number(page.extra?.search_signals_version || 0) >= 1);
  if (!pages.length) return aggregate([], 0);
  const indexable = pages.filter(page => isTrue(page.is_indexable));
  const answerStructures = pages.filter(page => {
    const extra = page.extra || {};
    return (Number(extra.question_headings || 0) > 0 && Number(extra.answer_blocks || 0) > 0) || Number(extra.faq_schema_count || 0) > 0;
  });
  const headingStructure = pages.filter(page => page.h1_count === 1 && (Number(page.extra?.h2_count || 0) > 0 || Number(page.extra?.h3_count || 0) > 0));
  const structured = pages.filter(page => pageSchemaTypes(page).length > 0);
  const extractable = pages.filter(page => page.word_count >= 180 && (Number(page.extra?.list_count || 0) > 0 || Number(page.extra?.table_count || 0) > 0 || Number(page.extra?.short_answer_blocks || 0) > 0));
  const conciseAnswers = pages.filter(page => Number(page.extra?.short_answer_blocks || 0) > 0 || Number(page.extra?.definition_blocks || 0) > 0);
  const checks = [
    makeCheck('aeo-indexability', 'Crawlability & indexability', 'Answer systems need to discover and retrieve pages that search crawlers can access.', 'Resolve noindex directives, non-2xx responses and crawl restrictions on pages intended to be found.', indexable.length, pages.length, 22),
    makeCheck('aeo-structure', 'Clear heading hierarchy', 'A focused H1 with meaningful H2/H3 sections makes page topics and sub-answers easier to identify.', 'Use one descriptive H1 and organize each distinct subtopic under descriptive H2/H3 headings.', headingStructure.length, pages.length, 16),
    makeCheck('aeo-questions', 'Question-and-answer coverage', 'Question headings, FAQ structures and concise answer blocks help evaluate whether a page directly addresses user questions.', 'Add accurate questions based on real audience needs, then answer each directly near its heading. Do not add FAQ markup to invisible or invented content.', answerStructures.length, pages.length, 22),
    makeCheck('aeo-schema', 'Relevant structured data', 'Valid structured data can clarify page type and entities when it accurately matches visible content.', 'Use the schema type that genuinely describes each page, validate JSON-LD and keep it consistent with visible page content.', structured.length, pages.length, 14),
    makeCheck('aeo-extractability', 'Scannable evidence and content', 'Useful answers are easier to extract when pages contain substantive text, clear lists, tables or concise summaries.', 'Present key facts in descriptive sections, lists or comparison tables and keep important information in accessible HTML text.', extractable.length, pages.length, 16),
    makeCheck('aeo-direct-answers', 'Direct answers and definitions', 'Short answer or definition sections can make the response to a specific question unambiguous.', 'Place a concise, factual answer immediately after relevant questions; include supporting detail and context below it.', conciseAnswers.length, pages.length, 10)
  ];
  return aggregate(checks, pages.length);
}

export function assessGEO(report: ScanReport | null): ReadinessAssessment {
  const pages = (report?.pages || []).filter(page => /html|xhtml/i.test(page.content_type || '') && Number(page.extra?.search_signals_version || 0) >= 1);
  if (!pages.length) return aggregate([], 0);
  const indexable = pages.filter(page => isTrue(page.is_indexable) && (page.status_code === null || (page.status_code >= 200 && page.status_code < 300)));
  const entityPages = pages.filter(hasEntitySignals);
  const evidencePages = pages.filter(page => page.word_count >= 250 && (Number(page.extra?.list_count || 0) > 0 || Number(page.extra?.table_count || 0) > 0 || Number(page.extra?.external_citations || 0) > 0));
  const attributionPages = pages.filter(hasAuthorOrDate);
  const topicalPages = pages.filter(page => page.h1_count === 1 && (Number(page.extra?.h2_count || 0) + Number(page.extra?.h3_count || 0) >= 2));
  const semanticPages = pages.filter(page => pageSchemaTypes(page).length > 0 && Boolean(page.title) && Boolean(page.meta_description));
  const checks = [
    makeCheck('geo-discovery', 'Discoverability & retrieval access', 'Pages must be reachable, indexable and available as crawlable text before they can be considered by search-grounded AI systems.', 'Fix blocking robots/noindex rules, server errors and inaccessible key content. Keep important content available in rendered HTML.', indexable.length, pages.length, 22),
    makeCheck('geo-entities', 'Entity clarity & brand identity', 'Consistent organization, person, product or business signals help disambiguate who created or offers the information.', 'Provide consistent organization/about/contact details and use accurate Organization, Person, Product or LocalBusiness data where appropriate.', entityPages.length, pages.length, 18),
    makeCheck('geo-evidence', 'Evidence-rich, citeable content', 'Specific facts, original data, lists, comparisons and references create useful evidence for answer synthesis.', 'Add first-hand information, clear figures with context, useful comparisons and references that support the claims.', evidencePages.length, pages.length, 20),
    makeCheck('geo-attribution', 'Authorship & freshness signals', 'Visible authorship and publication/update dates make content provenance and freshness easier to assess.', 'Show a real author or responsible organization and accurate publication/update dates. Never invent author credentials or freshness dates.', attributionPages.length, pages.length, 14),
    makeCheck('geo-topical', 'Topical depth & structure', 'Focused headings and comprehensive sections help retrieval systems understand coverage and match specific sub-questions.', 'Build focused pages around clear topics, cover related sub-questions and link supporting pages with descriptive anchor text.', topicalPages.length, pages.length, 14),
    makeCheck('geo-semantics', 'Structured context consistency', 'Titles, descriptions and structured data provide consistent context when they agree with what users can see.', 'Keep titles, descriptions, canonical URLs and structured data accurate and aligned with the visible page.', semanticPages.length, pages.length, 12)
  ];
  return aggregate(checks, pages.length);
}

export function getReadinessRecommendations(assessment: ReadinessAssessment): ReadinessCheck[] {
  return [...assessment.checks]
    .filter(check => check.status === 'weak' || check.status === 'improve')
    .sort((a, b) => (b.affected * b.weight) - (a.affected * a.weight));
}
