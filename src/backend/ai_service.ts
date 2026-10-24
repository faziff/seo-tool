import { GoogleGenAI } from '@google/genai';
import { KeywordIntelligenceService, KeywordResult } from './keywords.js';

export class AIService {
  /**
   * Generate keyword ideas using Gemini when configured. Without a provider key,
   * fall back to transparent seed expansions rather than fabricating live metrics.
   */
  public static async generateKeywordStrategy(
    seedPhrase: string,
    niche = 'General',
    market = 'Global'
  ): Promise<{ keywords: KeywordResult[]; ai_mode: 'gemini' | 'heuristic'; provider_status: string }> {
    const ai = this.getClient();
    if (ai) {
      try {
        const prompt = `You are NOVA, a careful SEO keyword strategist working inside CROX. Create 16 useful keyword ideas for the business.
Seed topic: ${seedPhrase}
Niche/industry: ${niche}
Target market: ${market}

Return only valid JSON with this shape: {"keywords":[{"keyword":"...","intent":"Informational|Commercial|Transactional|Navigational","difficulty_score":35,"cluster":"..."}]}
Rules: cover informational, comparison, purchase, local (if relevant), and long-tail intent; avoid duplicate or nonsensical phrases; make ideas specific to the niche and market. difficulty_score is an ESTIMATE from 0 to 100, not measured SERP data. Do not include any search volume, CPC, rankings, traffic or claims of live search demand. Return 12-18 ideas.`;
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        const body = response.text || '';
        const match = body.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          const raw = Array.isArray(parsed.keywords) ? parsed.keywords : [];
          const allowedIntents = new Set(['Informational', 'Commercial', 'Transactional', 'Navigational']);
          const unique = new Set<string>();
          const keywords: KeywordResult[] = raw.map((item: any) => {
            const keyword = String(item.keyword || '').trim();
            const score = Math.max(0, Math.min(100, Number(item.difficulty_score) || 40));
            const intent = allowedIntents.has(item.intent) ? item.intent : 'Informational';
            const key = keyword.toLowerCase();
            if (!keyword || unique.has(key)) return null;
            unique.add(key);
            return {
              keyword,
              intent,
              difficulty_score: score,
              difficulty_label: score < 36 ? 'Easy' : score < 66 ? 'Medium' : 'Hard',
              cluster: String(item.cluster || 'Topic ideas'),
              source: 'ai_generated',
              cpc_estimate_available: false,
              search_volume_provider_status: 'provider_not_configured'
            } as KeywordResult;
          }).filter(Boolean).slice(0, 20);
          if (keywords.length) {
            return {
              keywords,
              ai_mode: 'gemini',
              provider_status: 'NOVA generated idea estimates with Gemini. Live search volume, CPC and SERP difficulty are not connected.'
            };
          }
        }
      } catch (err: any) {
        console.warn('[CROX AI] Keyword strategy request failed:', err?.message || 'unknown error');
      }
    }

    const baseKeywords = KeywordIntelligenceService.generateKeywords(seedPhrase);
    const contextTerms = [
      `${seedPhrase} for ${niche}`,
      `best ${seedPhrase} in ${market}`,
      `${seedPhrase} ${market}`,
      `${niche} ${seedPhrase} ideas`,
      `affordable ${seedPhrase} for ${niche}`,
      `${seedPhrase} near me`,
      `${seedPhrase} pricing in ${market}`,
      `${niche} ${seedPhrase} guide`
    ];
    const existingTerms = new Set(baseKeywords.map(item => item.keyword.toLowerCase()));
    const contextualKeywords: KeywordResult[] = contextTerms
      .map(phrase => phrase.replace(/\s+/g, ' ').trim())
      .filter(phrase => phrase.length > 0 && !existingTerms.has(phrase.toLowerCase()))
      .map<KeywordResult>(phrase => {
        const lower = phrase.toLowerCase();
        const words = phrase.split(/\s+/).length;
        const score = words >= 5 ? 24 : words >= 4 ? 32 : words === 3 ? 45 : 65;
        const intent: KeywordResult['intent'] = /price|pricing|affordable|buy|quote|near me/i.test(lower)
          ? 'Transactional'
          : /best|ideas|guide|vs|compare/i.test(lower)
            ? 'Commercial'
            : 'Informational';
        return {
          keyword: phrase,
          intent,
          difficulty_score: score,
          difficulty_label: score <= 35 ? 'Easy' : score <= 60 ? 'Medium' : 'Hard',
          cluster: /price|pricing|affordable/i.test(lower) ? 'Pricing & Cost' : /best|guide|ideas/i.test(lower) ? 'Research & Evaluations' : 'Niche & Market',
          source: 'seed_expansion',
          cpc_estimate_available: false,
          search_volume_provider_status: 'provider_not_configured'
        };
      });
    const mergedKeywords = [...baseKeywords, ...contextualKeywords].slice(0, 20);
    return {
      keywords: mergedKeywords,
      ai_mode: 'heuristic',
      provider_status: 'Context-aware keyword expansion is active. Configure GEMINI_API_KEY for NOVA-generated suggestions. Live search volume and CPC require a separate data provider.'
    };
  }
  private static getClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
  }

  public static async generateMarketBrief(
    niche: string,
    market: string,
    goal: string
  ): Promise<{ brief: string; ai_mode: 'gemini' | 'heuristic'; note: string }> {
    const cleanNiche = niche.trim().slice(0, 180) || 'General business';
    const cleanMarket = market.trim().slice(0, 120) || 'Global';
    const cleanGoal = goal.trim().slice(0, 320) || 'Grow qualified organic traffic';
    const ai = this.getClient();
    if (ai) {
      try {
        const prompt = `You are NOVA, CROX's practical market and organic-search research strategist.
Create a concise directional market brief for:
Niche: ${cleanNiche}
Target location / audience: ${cleanMarket}
Business goal: ${cleanGoal}

Include: (1) likely customer segments and pains, (2) 4-6 search-intent/topic clusters, (3) competitor positioning questions, (4) a practical content/landing-page plan, (5) a 30-day validation checklist. Use short headings and bullets. Clearly distinguish hypotheses from verified facts. You have not been given live SERP, trend, traffic, volume, CPC, survey, or competitor data; do not invent market sizes, rankings, traffic or volumes and do not claim live research was performed. Make the brief useful and actionable.`;
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        const brief = response.text?.trim();
        if (brief) return {
          brief,
          ai_mode: 'gemini',
          note: 'AI-generated strategy brief. It is not live market data; validate hypotheses against actual SERPs, customer research and connected analytics.'
        };
      } catch (err: any) {
        console.warn('[CROX AI] Market brief request failed:', err?.message || 'unknown error');
      }
    }
    return {
      ai_mode: 'heuristic',
      note: 'Starter brief generated locally. Configure GEMINI_API_KEY for a personalized NOVA response. No live market metrics are claimed.',
      brief: `## Market starting point: ${cleanNiche}\n\n### Audience hypotheses\n- First-time buyers who need a clear explanation of the problem and available options.\n- Buyers comparing solutions, pricing, service levels and credibility.\n- Existing users looking for better workflows, alternatives or specialist help.\n\n### Search-intent clusters\n- Learn: beginner guides, how-to questions and definitions related to ${cleanNiche}.\n- Compare: best options, reviews, alternatives and versus pages.\n- Decide: pricing, packages, quotes, delivery or service-area details.\n- Trust: examples, case studies, FAQs, guarantees and credentials.\n- Localize: location-specific questions for ${cleanMarket}.\n\n### Competitor positioning questions\n- What promise appears above the fold on each competitor homepage?\n- Which audiences, use cases, proof points and FAQs do they emphasize?\n- Which customer questions are not clearly answered on your current pages?\n\n### Suggested 30-day validation plan\n1. Review 5-10 real search results for each high-priority intent and record the page types that rank.\n2. Speak with 3-5 target customers or review authentic support/sales questions.\n3. Publish one focused landing page and two supporting articles for the strongest problem cluster.\n4. Track impressions, clicks and conversions in Google Search Console and analytics, then revise based on evidence.\n\n**Goal to optimize for:** ${cleanGoal}. Treat these as starting hypotheses; verify demand and competition before committing budget.`
    };
  }

  public static async answerQuestion(
    message: string,
    scanContext?: {
      domain?: string;
      healthScore?: number;
      issues?: Array<{ title: string; category: string; severity: string; evidence: string }>;
    }
  ): Promise<{ reply: string; suggestions: string[] }> {
    const ai = this.getClient();

    let systemPrompt = `You are NOVA, CROX's elite technical SEO advisor and web performance consultant.
Your role is to help users understand crawl findings, fix indexation blockers, write semantic schema markup, and optimize their websites.
Keep advice concise, evidence-based, and actionable with exact code snippets where helpful.
Never invent metrics. Explain clearly how search crawlers interpret technical issues.`;

    if (scanContext && scanContext.domain) {
      systemPrompt += `\nCurrent Scan Context for ${scanContext.domain}:
- Health Score: ${scanContext.healthScore ?? 'N/A'}/100
- Recent Issues: ${JSON.stringify(scanContext.issues?.slice(0, 5) || [])}`;
    }

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Question: ${message}` }] }
          ]
        });

        const reply = response.text || 'I analyzed your request. Please inspect your scan findings for more context.';
        return {
          reply,
          suggestions: [
            'How do I fix missing H1 tags without breaking styling?',
            'Generate Schema.org WebSite JSON-LD markup',
            'What is the quickest way to improve my TTFB?'
          ]
        };
      } catch (err: any) {
        console.warn('[CROX AI] Gemini API call error:', err.message);
      }
    }

    // Deterministic fallback if Gemini API key is not configured or fails
    const lower = message.toLowerCase();
    let reply = `Here is our technical recommendation for **${scanContext?.domain || 'your website'}**:`;

    if (lower.includes('h1') || lower.includes('heading')) {
      reply = `### How to optimize H1 headings:
1. Ensure every page has **exactly one** \`<h1>\` tag representing the core topic.
2. Place the \`<h1>\` at the top of the main content area (inside \`<main>\`).
3. Keep it between 20-70 characters and incorporate primary search intent keywords.
4. Convert secondary section headings to \`<h2>\` or \`<h3>\`.

\`\`\`html
<main>
  <h1>Complete Guide to Sustainable Architecture</h1>
  <p>Introductory paragraph...</p>
  <h2>Key Design Principles</h2>
</main>
\`\`\``;
    } else if (lower.includes('title') || lower.includes('meta description')) {
      reply = `### Best Practices for Title & Meta Descriptions:
- **Title Tag**: 30 to 60 characters. Format: \`Primary Keyword - Secondary Benefit | Brand\`
- **Meta Description**: 120 to 155 characters. Include an actionable call to action (e.g. *Learn more*, *Browse collection*, *Discover*).
- Never use boilerplate duplicate titles across catalog or blog pages.`;
    } else if (lower.includes('schema') || lower.includes('json-ld') || lower.includes('structured data')) {
      reply = `### Recommended Schema.org JSON-LD:
Add this script directly into the \`<head>\` of your homepage:

\`\`\`html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "${scanContext?.domain || 'Your Brand'}",
  "url": "https://${scanContext?.domain || 'example.com'}/",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://${scanContext?.domain || 'example.com'}/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
</script>
\`\`\``;
    } else if (lower.includes('ttfb') || lower.includes('speed') || lower.includes('performance')) {
      reply = `### Strategies to reduce Time-To-First-Byte (TTFB):
1. **Enable Edge Caching**: Use a CDN like Cloudflare or Fastly to cache static HTML and assets near visitors.
2. **Database Indexing**: Optimize slow SQL queries and eliminate N+1 database queries on page loads.
3. **HTTP/2 or HTTP/3**: Ensure server supports modern multiplexed HTTP protocols.
4. **Gzip / Brotli Compression**: Ensure text/html and application/json payloads are compressed.`;
    } else {
      reply = `Based on your audit report for **${scanContext?.domain || 'your website'}**, we recommend prioritizing Critical issues first (such as broken links, missing title tags, or insecure protocols). Fixing Critical issues yields the highest health score improvement and restores crawl budget.`;
    }

    return {
      reply,
      suggestions: [
        'How do I fix missing H1 tags?',
        'Generate Schema.org WebSite JSON-LD markup',
        'How do I optimize title tag lengths?'
      ]
    };
  }

  public static async generateFix(issue: {
    title: string;
    category: string;
    affected_url: string;
    evidence: string;
    explanation: string;
  }): Promise<{ fix_explanation: string; code_snippet: string }> {
    const ai = this.getClient();

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `You are an SEO developer. Generate an exact code snippet and explanation to resolve this SEO audit issue:
Title: ${issue.title}
Category: ${issue.category}
Affected URL: ${issue.affected_url}
Evidence: ${issue.evidence}
Explanation: ${issue.explanation}

Provide a JSON output with keys: "fix_explanation" (string) and "code_snippet" (string).`
                }
              ]
            }
          ]
        });

        const text = response.text || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          return {
            fix_explanation: parsed.fix_explanation || 'Apply the recommended code snippet into your template.',
            code_snippet: parsed.code_snippet || ''
          };
        }
      } catch {}
    }

    // Deterministic fallback
    return {
      fix_explanation: `To fix "${issue.title}", update the HTML template for ${issue.affected_url} to satisfy standard search crawler specifications.`,
      code_snippet: issue.title.includes('Title')
        ? '<title>Descriptive Topic Title - Brand Name</title>'
        : issue.title.includes('Description')
        ? '<meta name="description" content="Engaging summary of page contents between 120 and 160 characters.">'
        : issue.title.includes('H1')
        ? '<h1>Primary Subject of This Page</h1>'
        : issue.title.includes('Canonical')
        ? `<link rel="canonical" href="${issue.affected_url}">`
        : issue.title.includes('Viewport')
        ? '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
        : '<meta charset="UTF-8">'
    };
  }
}
