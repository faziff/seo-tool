import express from 'express';
import { db } from './db.js';
import { clientIp, generateToken, hashPassword, requireAdmin, requireAuth, verifyPassword, AuthenticatedRequest } from './auth.js';
import { addCreditsToUser, consumeCredit, getCreditSnapshot, isAdminEmail } from './credits.js';
import { researchKeywords } from './keywordProvider.js';
import { AIService } from './ai_service.js';
import { validateTargetUrl } from './security.js';
import * as cheerio from 'cheerio';

export const platformRouter = express.Router();

function publicUser(user: ReturnType<typeof db.findUserById>) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    created_at: user.created_at,
    settings: user.settings,
    is_admin: isAdminEmail(user.email),
    plan: user.plan
  };
}

platformRouter.post('/auth/register', (req, res) => {
  const { name, email, password, confirm_password } = req.body || {};
  const ip = clientIp(req);
  if (db.countSignupAttempts(ip, Date.now() - 60 * 60 * 1000) >= 5) {
    return res.status(429).json({ detail: 'Too many sign-up attempts from this network. Try again in an hour.' });
  }
  db.recordSignupAttempt(ip);

  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  if (!cleanName) return res.status(400).json({ detail: 'Enter your name to create a workspace.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ detail: 'Enter a valid email address.' });
  if (String(password || '').length < 8) return res.status(400).json({ detail: 'Use a password with at least 8 characters.' });
  if (password !== confirm_password) return res.status(400).json({ detail: 'Your passwords do not match.' });
  if (db.findUserByEmail(cleanEmail)) return res.status(409).json({ detail: 'An account already exists for this email. Sign in instead.' });

  const user = db.createUser({
    name: cleanName,
    email: cleanEmail,
    password_hash: hashPassword(password),
    plan: 'free',
    scans_used: 0,
    created_at: new Date().toISOString(),
    settings: {},
    extra_audits: 0,
    extra_ai: 0,
    extra_keywords: 0
  });
  const access_token = generateToken(user);
  res.status(201).json({ access_token, user: publicUser(user) });
});

platformRouter.post('/auth/login', (req, res) => {
  const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = db.findUserByEmail(cleanEmail);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ detail: 'Email or password is incorrect.' });
  }
  res.json({ access_token: generateToken(user), user: publicUser(user) });
});

platformRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ ...publicUser(req.user), credits: getCreditSnapshot(req.user!) });
});

platformRouter.post('/auth/logout', (_req, res) => {
  res.json({ status: 'success' });
});

platformRouter.post('/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
  const current = String(req.body?.current_password || '');
  const next = String(req.body?.new_password || '');
  if (next.length < 8) return res.status(400).json({ detail: 'New password must be at least 8 characters.' });
  if (!verifyPassword(current, req.user!.password_hash)) return res.status(401).json({ detail: 'Current password is incorrect.' });
  db.updateUser(req.user!.id, { password_hash: hashPassword(next) });
  res.json({ status: 'success', message: 'Password updated.' });
});

platformRouter.get('/credits', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json(getCreditSnapshot(req.user!));
});

platformRouter.get('/admin/users', requireAuth, requireAdmin, (_req, res) => {
  res.json(db.listUsers(200).map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    plan: u.plan,
    created_at: u.created_at,
    extra_audits: u.extra_audits,
    extra_ai: u.extra_ai,
    extra_keywords: u.extra_keywords,
    credits: getCreditSnapshot(u)
  })));
});

platformRouter.post('/admin/credits', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const email = String(req.body?.email || '').trim();
  const updated = addCreditsToUser(email, {
    audits: Number(req.body?.audits) || 0,
    ai: Number(req.body?.ai) || 0,
    keywords: Number(req.body?.keywords) || 0
  });
  if (!updated) return res.status(404).json({ detail: 'No user found with that email.' });
  res.json({ status: 'success', user: publicUser(updated), credits: getCreditSnapshot(updated) });
});

platformRouter.post('/keywords/research', requireAuth, async (req: AuthenticatedRequest, res) => {
  const seed = String(req.body?.seed || req.body?.seed_phrase || '').trim();
  if (!seed) return res.status(400).json({ detail: 'Enter a keyword or domain to research.' });
  const credit = consumeCredit(req.user!, 'keyword');
  if (!credit.ok) return res.status(402).json({ detail: credit.message, credits: credit.snapshot });
  try {
    const result = await researchKeywords({
      seed,
      country: String(req.body?.country || 'PK'),
      city: String(req.body?.city || '').trim() || undefined,
      language: String(req.body?.language || 'English'),
      niche: String(req.body?.niche || 'General').slice(0, 120),
      website: String(req.body?.website || '').trim() || undefined,
      goal: String(req.body?.goal || 'Grow qualified organic traffic').slice(0, 240)
    });
    res.json({ ...result, credits: credit.snapshot });
  } catch (err: any) {
    res.status(502).json({ detail: err?.message || 'Keyword research failed.' });
  }
});

platformRouter.get('/tracking', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json(db.listTrackedKeywords(req.user!.id));
});

platformRouter.post('/tracking', requireAuth, (req: AuthenticatedRequest, res) => {
  const keyword = String(req.body?.keyword || '').trim();
  if (!keyword) return res.status(400).json({ detail: 'Enter a keyword to track.' });
  const created = db.addTrackedKeyword(
    req.user!.id,
    keyword,
    String(req.body?.country || 'PK'),
    String(req.body?.website || '')
  );
  res.status(201).json(created);
});

platformRouter.post('/backlinks/analyze', requireAuth, async (req: AuthenticatedRequest, res) => {
  const raw = String(req.body?.url || req.body?.domain || '').trim();
  const validation = await validateTargetUrl(raw);
  if (!validation.valid) return res.status(400).json({ detail: validation.error || 'Enter a public website to inspect.' });
  try {
    const response = await fetch(validation.normalizedUrl, {
      signal: AbortSignal.timeout(9000),
      headers: { 'User-Agent': 'CROX-Backlink-Analyzer/1.0', Accept: 'text/html' }
    });
    const html = await response.text();
    const $ = cheerio.load(html.slice(0, 1_200_000));
    const host = validation.hostname;
    const outbound: Array<{ url: string; rel: string; text: string }> = [];
    $('a[href]').each((_i, el) => {
      const href = String($(el).attr('href') || '');
      try {
        const abs = new URL(href, validation.normalizedUrl);
        if (!abs.hostname.endsWith(host) && abs.protocol.startsWith('http')) {
          outbound.push({
            url: abs.toString(),
            rel: String($(el).attr('rel') || ''),
            text: $(el).text().trim().slice(0, 80)
          });
        }
      } catch { /* ignore */ }
    });
    const unique = [...new Map(outbound.map(item => [item.url, item])).values()].slice(0, 40);
    res.json({
      domain: host,
      pages_inspected: 1,
      outbound_links: unique.length,
      nofollow_count: unique.filter(l => /nofollow/i.test(l.rel)).length,
      links: unique,
      note: 'This is a homepage outbound-link snapshot, not a full backlink index. Connect a link-data provider later for referring domains and inbound links.'
    });
  } catch {
    res.status(502).json({ detail: 'Could not inspect the public homepage for outbound links.' });
  }
});

platformRouter.post('/content/ideas', requireAuth, async (req: AuthenticatedRequest, res) => {
  const topic = String(req.body?.topic || req.body?.niche || '').trim();
  if (!topic) return res.status(400).json({ detail: 'Enter a topic or niche for content ideas.' });
  const credit = consumeCredit(req.user!, 'ai');
  if (!credit.ok) return res.status(402).json({ detail: credit.message, credits: credit.snapshot });
  const result = await AIService.generateMarketBrief(
    topic,
    String(req.body?.market || 'Pakistan'),
    String(req.body?.goal || 'Publish useful pages that can earn search visits')
  );
  res.json({
    ideas: result.brief,
    ai_mode: result.ai_mode,
    note: result.note,
    credits: credit.snapshot
  });
});

