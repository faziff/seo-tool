import type { ExtractedPageData } from './crawler.js';
import type { AuditIssue } from './seo_audit.js';

export interface ContentAuditSection {
  score: number | null;
  status: 'scored' | 'not_available' | 'not_provided';
  note: string;
  [key: string]: unknown;
}

export interface ContentAuditResult {
  target_url: string;
  overall_score: number | null;
  score_coverage: string;
  word_count: {
    actual: number;
    competitor_average: number | null;
    difference: number | null;
    status: 'benchmark_unavailable';
    note: string;
  };
  heading_structure: ContentAuditSection & {
    h1_count: number;
    h1: string[];
    h2_count: number;
    h2: string[];
    h3_count: number;
    h3: string[];
  };
  readability: ContentAuditSection & {
    flesch_reading_ease: number | null;
    language: string | null;
    grade_label: string | null;
  };
  keyword_presence: ContentAuditSection & {
    keyword: string | null;
    in_title: boolean | null;
    in_h1: boolean | null;
    in_first_100_words: boolean | null;
    matches_found: number;
  };
  existing_seo_checks: Array<{
    rule_id: string;
    title: string;
    severity: AuditIssue['severity'];
    evidence: string;
    recommendation: string;
  }>;
  checked_at: string;
  note: string;
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return 0;
  if (clean.length <= 3) return 1;
  const withoutSilentE = clean.replace(/(?:[^laeiouy]e|ed|es)$/, '').replace(/^y/, '');
  const groups = withoutSilentE.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length || 1);
}

function fleschReadingEase(text: string, lang: string | null): { score: number | null; label: string | null; note: string; language: string | null } {
  const normalizedLang = String(lang || '').toLowerCase();
  if (normalizedLang && !normalizedLang.startsWith('en')) {
    return {
      score: null,
      label: null,
      language: lang,
      note: `Flesch Reading Ease is only calculated for English; this page declares lang="${lang}".`
    };
  }

  const sentences = text.split(/[.!?]+/).map(value => value.trim()).filter(Boolean);
  const words = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
  if (!normalizedLang) {
    const commonEnglish = new Set(['the', 'and', 'is', 'are', 'to', 'of', 'in', 'for', 'with', 'that', 'this', 'you', 'your', 'it', 'as', 'on', 'be', 'how', 'what', 'why', 'from', 'by']);
    const englishWordHits = words.filter(word => commonEnglish.has(word.toLowerCase())).length;
    if (words.length < 20 || englishWordHits / words.length < 0.04) {
      return {
        score: null,
        label: null,
        language: null,
        note: 'The page does not declare an English HTML language and the visible text did not pass CROX’s basic English-language heuristic. Flesch Reading Ease was not calculated.'
      };
    }
  }
  if (sentences.length < 1 || words.length < 20) {
    return { score: null, label: null, language: lang, note: 'Not enough English body text to calculate a meaningful Flesch estimate.' };
  }

  const syllables = words.reduce((total, word) => total + countSyllables(word), 0);
  const raw = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);
  const score = Math.round(Math.max(0, Math.min(100, raw)));
  const label = score >= 90 ? 'Very easy' : score >= 80 ? 'Easy' : score >= 70 ? 'Fairly easy' : score >= 60 ? 'Standard' : score >= 50 ? 'Fairly difficult' : score >= 30 ? 'Difficult' : 'Very difficult';
  return {
    score,
    label,
    language: lang || 'English (heuristic detection)',
    note: lang
      ? 'Estimated locally with the English Flesch Reading Ease formula. Syllable counting is heuristic; this is not a professional readability assessment.'
      : 'The page has no HTML language attribute; English was inferred using common-word frequency. Flesch and syllable counts are heuristic, not a professional readability assessment.'
  };
}

function headingStructureScore(page: ExtractedPageData): number {
  const h1Count = page.h1List.length;
  const h2Count = page.h2Count;
  const h3Count = page.h3Count;
  const h1Points = h1Count === 1 ? 50 : h1Count === 0 ? 0 : 35;
  const h2Points = h2Count >= 3 ? 35 : h2Count === 2 ? 30 : h2Count === 1 ? 20 : 0;
  const h3Points = h3Count > 0 ? 15 : h2Count >= 3 ? 10 : 5;
  return Math.max(0, Math.min(100, h1Points + h2Points + h3Points));
}

function makeOverallScore(components: Array<{ score: number | null; weight: number }>): { score: number | null; coverage: string } {
  const available = components.filter(item => item.score !== null && Number.isFinite(item.score));
  if (available.length < 2) {
    return {
      score: null,
      coverage: available.length
        ? `Only ${available.length} of ${components.length} content signals were available. CROX withheld the composite score because too little evidence was available.`
        : 'No scored content signals were available.'
    };
  }
  const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
  const weighted = available.reduce((sum, item) => sum + Number(item.score) * item.weight, 0) / totalWeight;
  return {
    score: Math.round(weighted),
    coverage: `${available.length} of ${components.length} content signals scored. Unavailable signals were excluded and remaining weights were normalized.`
  };
}

/** Pure local content assessment; all page content is supplied by the existing crawler. */
export function auditContentPage(
  page: ExtractedPageData,
  targetKeyword: string | null,
  existingAuditIssues: AuditIssue[] = []
): ContentAuditResult {
  const bodyText = String(page.contentText || '').slice(0, 60_000);
  const keyword = String(targetKeyword || '').trim().slice(0, 160);
  const normalizedKeyword = normalizeText(keyword);
  const first100Words = bodyText.split(/\s+/).filter(Boolean).slice(0, 100).join(' ');
  const inTitle = keyword ? normalizeText(page.title || '').includes(normalizedKeyword) : null;
  const inH1 = keyword ? normalizeText(page.h1List.join(' ')).includes(normalizedKeyword) : null;
  const inFirst100Words = keyword ? normalizeText(first100Words).includes(normalizedKeyword) : null;
  const matchesFound = [inTitle, inH1, inFirst100Words].filter(value => value === true).length;
  const keywordScore = keyword ? Math.round((matchesFound / 3) * 100) : null;

  const readabilityResult = fleschReadingEase(bodyText, page.lang || null);
  const headingScore = headingStructureScore(page);
  const scoreComponents = [
    { score: headingScore, weight: 35 },
    { score: readabilityResult.score, weight: 30 },
    ...(keyword ? [{ score: keywordScore, weight: 35 }] : [])
  ];
  const weighted = makeOverallScore(scoreComponents);

  const relevantRuleIds = new Set(['SEO_TITLE_MISSING', 'SEO_TITLE_LENGTH', 'SEO_H1_MISSING', 'SEO_H1_MULTIPLE', 'SEO_THIN_CONTENT']);
  const existingChecks = existingAuditIssues
    .filter(issue => relevantRuleIds.has(issue.rule_id))
    .map(issue => ({
      rule_id: issue.rule_id,
      title: issue.title,
      severity: issue.severity,
      evidence: issue.evidence,
      recommendation: issue.recommendation
    }));

  return {
    target_url: page.url,
    overall_score: weighted.score,
    score_coverage: weighted.coverage,
    word_count: {
      actual: page.wordCount,
      competitor_average: null,
      difference: null,
      status: 'benchmark_unavailable',
      note: 'CROX does not currently have a verified competitor word-count dataset for this URL. The actual count is measured from extracted visible text; no competitor average is estimated.'
    },
    heading_structure: {
      score: headingScore,
      status: 'scored',
      note: 'Local heuristic based on one primary H1, multiple H2 sections and optional H3 subsections. Heading quality still requires human review.',
      h1_count: page.h1List.length,
      h1: page.h1List,
      h2_count: page.h2Count,
      h2: page.h2List,
      h3_count: page.h3Count,
      h3: page.h3List
    },
    readability: {
      score: readabilityResult.score,
      status: readabilityResult.score === null ? 'not_available' : 'scored',
      note: readabilityResult.note,
      flesch_reading_ease: readabilityResult.score,
      language: readabilityResult.language,
      grade_label: readabilityResult.label
    },
    keyword_presence: {
      score: keywordScore,
      status: keyword ? 'scored' : 'not_provided',
      note: keyword ? 'Checks exact normalized phrase presence in the title, combined H1 text and first 100 visible body words. It does not assess keyword quality or search demand.' : 'Provide a target keyword to score its presence in the title, H1 and first 100 words.',
      keyword: keyword || null,
      in_title: inTitle,
      in_h1: inH1,
      in_first_100_words: inFirst100Words,
      matches_found: matchesFound
    },
    existing_seo_checks: existingChecks,
    checked_at: new Date().toISOString(),
    note: 'This is a sampled single-page content assessment based on the HTML returned to CROX at check time. It is not a ranking prediction, competitor benchmark or guarantee of search performance.'
  };
}
