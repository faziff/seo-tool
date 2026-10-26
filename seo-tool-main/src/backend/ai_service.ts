import { GoogleGenAI } from '@google/genai';
import { KeywordIntelligenceService, KeywordResult } from './keywords.js';
import { agentConfigured, callExternalAgent } from './agent.js';

export type AiErrorCode = 'missing_key' | 'quota' | 'network' | 'empty' | 'agent';

function classifyGeminiError(err: any): { code: AiErrorCode; message: string } {
  const raw = String(err?.message || err || '');
  const lower = raw.toLowerCase();
  if (/quota|resource.?exhausted|429|rate.?limit/i.test(lower)) {
    return { code: 'quota', message: 'Gemini quota or rate limit was reached. Try again later or check the key’s billing limits.' };
  }
  if (/fetch|network|enotfound|econn|timeout|abort/i.test(lower)) {
    return { code: 'network', message: 'CROX could not reach Gemini. Check outbound network access from the server.' };
  }
  if (/api.?key|permission|401|403|invalid/i.test(lower)) {
    return { code: 'missing_key', message: 'GEMINI_API_KEY is missing or rejected. Add a valid key in the hosting environment.' };
  }
  return { code: 'network', message: raw.slice(0, 240) || 'Gemini request failed.' };
}

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
  ): Promise<{ reply: string; suggestions: string[]; error_code?: AiErrorCode; error_message?: string }> {
    if (agentConfigured()) {
      const agent = await callExternalAgent({ message, context: scanContext as Record<string, unknown> });
      if (agent.used && agent.reply) {
        return {
          reply: agent.reply,
          suggestions: ['Summarize the top three SEO fixes', 'Draft a meta description', 'Suggest content angles']
        };
      }
      if (agent.used && agent.error) {
        return this.answerQuestionLocal(message, scanContext, { code: 'agent', message: agent.error });
      }
    }
    return this.answerQuestionLocal(message, scanContext);
  }

  private static async answerQuestionLocal(
    message: string,
    scanContext?: {
      domain?: string;
      healthScore?: number;
      issues?: Array<{ title: string; category: string; severity: string; evidence: string }>;
    },
    priorError?: { code: AiErrorCode; message: string }
  ): Promise<{ reply: string; suggestions: string[]; error_code?: AiErrorCode; error_message?: string }> {
    const ai = this.getClient();
    const missingKey = !process.env.GEMINI_API_KEY;

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

        const reply = (response.text || '').trim();
        if (reply) {
          return {
            reply: priorError ? `${priorError.message}\n\n${reply}` : reply,
            suggestions: [
              'How do I fix missing H1 tags without breaking styling?',
              'Generate Schema.org WebSite JSON-LD markup',
              'What is the quickest way to improve my TTFB?'
            ],
            error_code: priorError?.code,
            error_message: priorError?.message
          };
        }
        priorError = priorError || { code: 'empty', message: 'Gemini returned an empty answer. Showing CROX guidance instead.' };
      } catch (err: any) {
        console.warn('[CROX AI] Gemini API call error:', err.message);
        priorError = priorError || classifyGeminiError(err);
      }
    } else if (!priorError && missingKey) {
      priorError = {
        code: 'missing_key',
        message: 'GEMINI_API_KEY is not set on the server. NOVA is using built-in CROX guidance until you add the key in your hosting panel.'
      };
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

    const notice = priorError?.message ? `${priorError.message}\n\n` : '';
    return {
      reply: `${notice}${reply}`,
      suggestions: [
        'How do I fix missing H1 tags?',
        'Generate Schema.org WebSite JSON-LD markup',
        'How do I optimize title tag lengths?'
      ],
      error_code: priorError?.code,
      error_message: priorError?.message
    };
  }

  public static async generateFix(issue: {
    title: string;
    category: string;
    affected_url: string;
    evidence: string;
    explanation: string;
    recommendation?: string;
  }): Promise<{ fix_explanation: string; code_snippet: string; provider: 'gemini' | 'fallback' }> {
    const ai = this.getClient();

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{
            role: 'user',
            parts: [{ text: `You are NOVA, a careful senior technical SEO engineer inside CROX. Draft a safe, specific remediation for one audited website issue.

Issue: ${issue.title}
Category: ${issue.category}
Affected URL: ${issue.affected_url}
Observed evidence: ${issue.evidence}
Audit explanation: ${issue.explanation}
Existing recommendation: ${issue.recommendation || 'Not provided'}

Return ONLY valid JSON with two string fields: "fix_explanation" and "code_snippet".
Requirements:
- Give a practical fix that directly matches the issue; do not invent the site's business, page subject, CMS, or content.
- For metadata, provide a clearly marked template/example rather than pretending a placeholder is final copy.
- Prefer HTML snippets for on-page metadata, and include implementation guidance when the fix requires server/configuration changes.
- Never claim you changed the live website. Never include credentials, API keys, or destructive commands.
- Keep the explanation concise but actionable. If the evidence is insufficient, state what the site owner must confirm. Return JSON only.` }]
          }]
        });

        const body = response.text || '';
        const match = body.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          const fixExplanation = typeof parsed.fix_explanation === 'string' ? parsed.fix_explanation.trim() : '';
          const codeSnippet = typeof parsed.code_snippet === 'string' ? parsed.code_snippet.trim() : '';
          if (fixExplanation && codeSnippet) {
            return { fix_explanation: fixExplanation.slice(0, 6000), code_snippet: codeSnippet.slice(0, 12000), provider: 'gemini' };
          }
        }
      } catch (err: any) {
        console.warn('[CROX AI] Fix generation fell back to local guidance:', err?.message || 'unknown error');
      }
    }

    // A local, predictable fallback is available when Gemini is not configured or unavailable.
    const title = String(issue.title || '').toLowerCase();
    const rule = `${title} ${issue.category || ''}`.toLowerCase();
    const safeUrl = String(issue.affected_url || 'https://example.com/page')
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let codeSnippet = '';
    let fixExplanation = `Review the evidence for “${issue.title}”, then implement the recommendation in the template or CMS that owns ${issue.affected_url || 'the affected page'}. Re-run the audit to verify the result. This is a draft; it has not changed the live site.`;

    if (/title/.test(rule)) {
      codeSnippet = '<title>Primary Page Topic | Brand Name</title>';
      fixExplanation = 'Add one unique, descriptive title element inside the page <head>. Replace the example topic and brand with accurate page-specific wording; aim for a concise title that reads naturally in search results.';
    } else if (/meta.?description|description/.test(rule)) {
      codeSnippet = '<meta name="description" content="Summarize this page’s main topic and value in one specific, helpful sentence.">';
      fixExplanation = 'Add a unique meta description to the page head. Write genuine page-specific copy (often around 120–160 characters), avoid keyword stuffing, and do not reuse the same description across pages.';
    } else if (/h1|heading/.test(rule)) {
      codeSnippet = '<h1>Clear, descriptive primary heading for this page</h1>';
      fixExplanation = 'Add a visible, relevant H1 that describes the main purpose of the page. Adapt the wording to the real page content and preserve the existing visual design with CSS if needed.';
    } else if (/alt|image/.test(rule)) {
      codeSnippet = '<img src="/path/to/image.webp" alt="Accurate description of the image">';
      fixExplanation = 'For meaningful images, add concise alt text that communicates the image’s purpose or information. Use alt="" for purely decorative images and replace the example source and text with the real asset and context.';
    } else if (/canonical/.test(rule)) {
      codeSnippet = `<link rel="canonical" href="${safeUrl}">`;
      fixExplanation = 'Add a canonical link in the page head only after confirming the preferred indexable URL. Keep the canonical absolute, stable, and consistent with redirects and internal links.';
    } else if (/viewport|mobile/.test(rule)) {
      codeSnippet = '<meta name="viewport" content="width=device-width, initial-scale=1">';
      fixExplanation = 'Add the standard viewport declaration to the document head and verify the page at common mobile widths. Do not use a restrictive maximum-scale value that prevents zooming.';
    } else if (/lang|language/.test(rule)) {
      codeSnippet = '<html lang="en">';
      fixExplanation = 'Declare the page’s actual primary language on the root HTML element. Replace “en” with the correct BCP 47 language tag for the page.';
    } else if (/structured|schema|json.?ld/.test(rule)) {
      codeSnippet = '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebPage",\n  "name": "Accurate page title",\n  "url": "https://example.com/page"\n}\n</script>';
      fixExplanation = 'Add valid JSON-LD that accurately describes visible page content. Replace the example URL and title, select the most specific supported Schema.org type, validate the JSON, and never include information users cannot see on the page.';
    } else if (/https|ssl|secure/.test(rule)) {
      codeSnippet = '# Configure a valid TLS certificate and redirect HTTP to HTTPS at your web server or hosting provider.\n# Update canonical tags, sitemap URLs, and internal links to the preferred HTTPS URL.';
      fixExplanation = 'Use the hosting provider or web server to install/renew a valid TLS certificate and configure a single-hop HTTP-to-HTTPS redirect. Confirm the HTTPS page works before changing canonical tags or sitemap URLs.';
    } else if (/broken link|404|not found/.test(rule)) {
      codeSnippet = '# Replace the broken href with a verified destination, or remove the link if no equivalent page exists.';
      fixExplanation = 'Open the affected URL and confirm whether the destination moved, was removed, or is temporarily unavailable. Update internal links to the final relevant URL; only add a redirect when a genuine replacement exists.';
    } else if (/robots|index|noindex/.test(rule)) {
      codeSnippet = '<meta name="robots" content="index,follow">';
      fixExplanation = 'Check the page’s intended search visibility first. Only remove an unintended noindex directive when this page should be indexed, and also check robots.txt, HTTP headers, canonical URL, and authentication barriers.';
    } else if (/performance|slow|ttfb|response time/.test(rule)) {
      codeSnippet = '# Profile the slow request first; inspect server timing, database/query latency, caching, and oversized responses.\n# Enable appropriate page caching/compression after confirming content is safe to cache.';
      fixExplanation = 'Measure the affected request and isolate the bottleneck before changing infrastructure. Server response delays usually require hosting, database, cache, or application-level work; verify with repeated measurements.';
    } else if (/redirect/.test(rule)) {
      codeSnippet = '# Point internal links directly to the final canonical URL and remove unnecessary redirect hops.';
      fixExplanation = 'Trace the redirect chain and confirm its final destination. Update internal links and sitemap entries to point directly to the final HTTPS canonical URL; preserve redirects only where they serve a real migration or URL change.';
    } else {
      codeSnippet = issue.recommendation || 'Review the affected URL and apply the audit recommendation in the owning template or configuration.';
      fixExplanation = `${issue.explanation || issue.recommendation || 'Review the issue evidence.'} Use the audit recommendation as the starting point, verify the change in a staging environment, and rerun CROX to confirm the issue is resolved.`;
    }

    return { fix_explanation: fixExplanation, code_snippet: codeSnippet, provider: 'fallback' };
  }
}
