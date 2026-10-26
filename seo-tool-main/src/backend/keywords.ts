export interface KeywordResult {
  keyword: string;
  intent: 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';
  difficulty_score: number;
  difficulty_label: 'Easy' | 'Medium' | 'Hard';
  cluster: string;
  source: 'seed_expansion' | 'page_content' | 'competitor_gap' | 'ai_generated';
  cpc_estimate_available: boolean;
  search_volume_provider_status: 'live' | 'provider_not_configured';
}

export class KeywordIntelligenceService {
  private static classifyIntent(phrase: string): 'Informational' | 'Commercial' | 'Transactional' | 'Navigational' {
    const lower = phrase.toLowerCase();
    if (/buy|price|pricing|cost|order|discount|coupon|deal|quote|checkout|purchase/i.test(lower)) {
      return 'Transactional';
    }
    if (/best|top|vs|versus|review|comparison|alternative|guide|tools/i.test(lower)) {
      return 'Commercial';
    }
    if (/login|sign in|portal|official website|account|status/i.test(lower)) {
      return 'Navigational';
    }
    return 'Informational';
  }

  private static calculateDifficulty(phrase: string): { score: number; label: 'Easy' | 'Medium' | 'Hard' } {
    const wordCount = phrase.split(/\s+/).length;
    // Longer specific phrases (long-tail) are generally lower difficulty
    let score = 65;
    if (wordCount >= 4) {
      score = 28;
    } else if (wordCount === 3) {
      score = 45;
    } else if (wordCount === 1) {
      score = 85;
    }

    const label = score <= 35 ? 'Easy' : score <= 60 ? 'Medium' : 'Hard';
    return { score, label };
  }

  private static determineCluster(phrase: string, seed: string): string {
    const lower = phrase.toLowerCase();
    if (/pricing|cost|rate/i.test(lower)) return 'Pricing & Cost';
    if (/best|top|review/i.test(lower)) return 'Evaluations & Reviews';
    if (/how to|tutorial|guide/i.test(lower)) return 'How-To & Guides';
    if (/software|platform|tool|service/i.test(lower)) return 'Product & Services';
    return `${seed.charAt(0).toUpperCase() + seed.slice(1)} Core`;
  }

  public static generateKeywords(seedPhrase: string): KeywordResult[] {
    const cleanSeed = seedPhrase.trim().toLowerCase();
    if (!cleanSeed) return [];

    const variations = [
      cleanSeed,
      `best ${cleanSeed}`,
      `${cleanSeed} pricing`,
      `how to use ${cleanSeed}`,
      `${cleanSeed} tools`,
      `${cleanSeed} alternatives`,
      `${cleanSeed} guide 2026`,
      `top ${cleanSeed} platforms`,
      `${cleanSeed} for small business`,
      `${cleanSeed} checklist`,
      `enterprise ${cleanSeed} solutions`,
      `${cleanSeed} case study`,
      `${cleanSeed} vs competitors`,
      `affordable ${cleanSeed} services`
    ];

    return variations.map(v => {
      const intent = this.classifyIntent(v);
      const diff = this.calculateDifficulty(v);
      const cluster = this.determineCluster(v, cleanSeed);

      return {
        keyword: v,
        intent,
        difficulty_score: diff.score,
        difficulty_label: diff.label,
        cluster,
        source: 'seed_expansion',
        cpc_estimate_available: false,
        search_volume_provider_status: 'provider_not_configured'
      };
    });
  }

  public static extractFromPages(pageTitles: string[], pageHeadings: string[]): KeywordResult[] {
    const terms = new Set<string>();

    const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'your', 'about', 'our']);

    const extractPhrases = (text: string) => {
      const words = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.has(w));

      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        terms.add(bigram);
      }
    };

    pageTitles.forEach(t => extractPhrases(t));
    pageHeadings.forEach(h => extractPhrases(h));

    const results: KeywordResult[] = [];
    const termArray = Array.from(terms).slice(0, 15);

    termArray.forEach(term => {
      const intent = this.classifyIntent(term);
      const diff = this.calculateDifficulty(term);
      results.push({
        keyword: term,
        intent,
        difficulty_score: diff.score,
        difficulty_label: diff.label,
        cluster: 'Extracted Page Topics',
        source: 'page_content',
        cpc_estimate_available: false,
        search_volume_provider_status: 'provider_not_configured'
      });
    });

    return results;
  }
}
