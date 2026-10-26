import express from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { db } from './db.js';
import { clientIp, generateToken, hashPassword, requireAdmin, requireAuth, verifyPassword, AuthenticatedRequest } from './auth.js';
import { addCreditsToUser, consumeCredit, getCreditSnapshot, isAdminEmail } from './credits.js';
import { researchKeywords } from './keywordProvider.js';
import { AIService } from './ai_service.js';
import { validateTargetUrl } from './security.js';
import * as cheerio from 'cheerio';


export const platformRouter = express.Router();

const failedLoginAttempts = new Map<string, { count: number; resetAt: number }>();

function validateProjectInput(body: any): { name: string; target: string; country: string } | { error: string } {
  const name = String(body?.name || '').trim();
  const target = String(body?.target_url || body?.domain || '').trim();
  const country = String(body?.country || 'PK').trim().toUpperCase();
  if (name.length < 1 || name.length > 80) return { error: 'Project name must be between 1 and 80 characters.' };
  if (target.length < 1 || target.length > 2048) return { error: 'Enter a website URL or domain under 2,048 characters.' };
  if (!/^(?:[A-Z]{2}|GLOBAL)$/.test(country)) return { error: 'Country must be a two-letter ISO code or GLOBAL.' };
  return { name, target, country };
}

function parseCookie(req: express.Request, name: string): string | null {
  const cookieHeader = String(req.headers.cookie || '');
  const match = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  if (!match) return null;
  try { return decodeURIComponent(match.slice(name.length + 1)); } catch { return null; }
}

function googleOAuthConfig() {
  return {
    clientId: String(process.env.GOOGLE_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    redirectUri: String(process.env.GOOGLE_REDIRECT_URI || '').trim()
  };
}

function publicProject(project: any) {
  return {
    id: project.id,
    name: project.name,
    domain: project.domain,
    target_url: project.target_url,
    country: project.country,
    created_at: project.created_at,
    updated_at: project.updated_at
  };
}

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
  const ip = clientIp(req);
  const now = Date.now();
  for (const [key, value] of failedLoginAttempts) if (value.resetAt <= now) failedLoginAttempts.delete(key);
  const attempts = failedLoginAttempts.get(ip);
  if (attempts && attempts.count >= 12 && attempts.resetAt > now) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((attempts.resetAt - now) / 1000))));
    return res.status(429).json({ detail: 'Too many unsuccessful sign-in attempts from this network. Please wait and try again.' });
  }

  const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = db.findUserByEmail(cleanEmail);
  if (!user || !verifyPassword(password, user.password_hash)) {
    const current = failedLoginAttempts.get(ip);
    failedLoginAttempts.set(ip, {
      count: current && current.resetAt > now ? current.count + 1 : 1,
      resetAt: current && current.resetAt > now ? current.resetAt : now + 15 * 60_000
    });
    return res.status(401).json({ detail: 'Email or password is incorrect.' });
  }

  failedLoginAttempts.delete(ip);
  res.json({ access_token: generateToken(user), user: publicUser(user) });
});

platformRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ ...publicUser(req.user), credits: getCreditSnapshot(req.user!) });
});

platformRouter.get('/auth/google/status', (_req, res) => {
  const config = googleOAuthConfig();
  res.json({ configured: Boolean(config.clientId && config.clientSecret && config.redirectUri) });
});

platformRouter.get('/auth/google/start', (_req, res) => {
  const config = googleOAuthConfig();
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    return res.status(503).type('text').send('Google sign-in is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI on the server.');
  }
  let redirectUrl: URL;
  try { redirectUrl = new URL(config.redirectUri); }
  catch { return res.status(500).type('text').send('GOOGLE_REDIRECT_URI is invalid.'); }
  if (!['https:', 'http:'].includes(redirectUrl.protocol)) return res.status(500).type('text').send('GOOGLE_REDIRECT_URI must use HTTP or HTTPS.');
  if (process.env.NODE_ENV === 'production' && redirectUrl.protocol !== 'https:') {
    return res.status(500).type('text').send('Production Google sign-in requires an HTTPS GOOGLE_REDIRECT_URI.');
  }

  const state = randomBytes(32).toString('hex');
  const secure = process.env.NODE_ENV === 'production' && redirectUrl.protocol === 'https:' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `crox_google_oauth_state=${encodeURIComponent(state)}; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=600${secure}`);
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account'
  }).toString();
  res.redirect(authUrl.toString());
});

platformRouter.get('/auth/google/callback', async (req, res) => {
  const config = googleOAuthConfig();
  if (!config.clientId || !config.clientSecret || !config.redirectUri) return res.status(503).type('text').send('Google sign-in is not configured.');

  const state = String(req.query.state || '');
  const expectedState = parseCookie(req, 'crox_google_oauth_state') || '';
  const clearCookie = `crox_google_oauth_state=; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', clearCookie);
  if (!state || !expectedState || state.length > 200 || state !== expectedState) return res.status(400).type('text').send('Google sign-in state validation failed. Close this window and try again.');
  if (req.query.error) return res.status(401).type('text').send('Google sign-in was cancelled or denied. You can close this window and try again.');
  const code = String(req.query.code || '');
  if (!code || code.length > 4096) return res.status(400).type('text').send('Google did not return an authorization code.');

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code'
      }),
      signal: AbortSignal.timeout(12000)
    });
    const tokenPayload = await tokenResponse.json().catch(() => ({})) as { access_token?: string; error_description?: string };
    if (!tokenResponse.ok || !tokenPayload.access_token) throw new Error('Google token exchange failed. Check OAuth client configuration and redirect URI.');

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(12000)
    });
    const profile = await profileResponse.json().catch(() => ({})) as { sub?: string; name?: string; email?: string; email_verified?: boolean };
    if (!profileResponse.ok || !profile.email || !profile.email_verified) throw new Error('Google did not provide a verified email address.');

    const email = profile.email.trim().toLowerCase();
    let user = db.findUserByEmail(email);
    if (!user) {
      user = db.createUser({
        name: String(profile.name || email.split('@')[0]).trim().slice(0, 100) || 'CROX User',
        email,
        password_hash: hashPassword(randomBytes(48).toString('hex')),
        plan: 'free',
        scans_used: 0,
        created_at: new Date().toISOString(),
        settings: { auth_provider: 'google', google_sub: profile.sub || null },
        extra_audits: 0,
        extra_ai: 0,
        extra_keywords: 0
      });
    } else if (user.settings?.google_sub !== profile.sub && profile.sub) {
      // Link the verified Google subject to an existing email account without
      // changing that account's password or any existing workspace data.
      user = db.updateUser(user.id, { settings: { ...user.settings, google_sub: profile.sub } }) || user;
    }

    const accessToken = generateToken(user);
    const targetOrigin = new URL(config.redirectUri).origin;
    const tokenLiteral = JSON.stringify(accessToken);
    const originLiteral = JSON.stringify(targetOrigin);
    res.status(200).type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CROX Google sign-in</title></head><body style="font-family:system-ui;padding:32px;color:#24213a"><p id="status">Google sign-in complete. Returning to CROX…</p><script>const token=${tokenLiteral};const targetOrigin=${originLiteral};if(window.opener){window.opener.postMessage({type:'crox:google-auth',access_token:token},targetOrigin);window.close()}else{document.getElementById('status').textContent='Sign-in complete. Open CROX in the original window and try again.'}</script></body></html>`);
  } catch (error: any) {
    console.warn('[CROX Google Auth] OAuth callback failed:', error?.message || 'unknown error');
    res.status(401).type('text').send('Google sign-in failed. Check server OAuth settings and try again. You can close this window.');
  }
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

// Per-user project registry. Project ownership is always scoped to req.user.id.
platformRouter.get('/projects', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json(db.listProjects(req.user!.id).map(publicProject));
});

platformRouter.post('/projects', requireAuth, async (req: AuthenticatedRequest, res) => {
  const input = validateProjectInput(req.body);
  if ('error' in input) return res.status(400).json({ detail: input.error });

  const validation = await validateTargetUrl(input.target);
  if (!validation.valid) return res.status(400).json({ detail: validation.error || 'Enter a valid public website URL.' });
  const domain = validation.hostname.toLowerCase();
  const existing = db.findProjectByDomain(req.user!.id, domain);
  if (existing) return res.status(200).json({ ...publicProject(existing), already_exists: true });

  const now = new Date().toISOString();
  try {
    const created = db.createProject({
      id: randomUUID(),
      user_id: req.user!.id,
      name: input.name,
      domain,
      target_url: validation.normalizedUrl,
      country: input.country,
      created_at: now,
      updated_at: now
    });
    res.status(201).json(publicProject(created));
  } catch (error: any) {
    if (/unique/i.test(String(error?.message || ''))) return res.status(409).json({ detail: 'A project for this domain already exists in your workspace.' });
    console.error('[CROX Projects] Project creation failed:', error?.message || error);
    res.status(500).json({ detail: 'Could not create this project right now.' });
  }
});

platformRouter.patch('/projects/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const name = req.body?.name === undefined ? undefined : String(req.body.name).trim();
  const country = req.body?.country === undefined ? undefined : String(req.body.country).trim().toUpperCase();
  if (name !== undefined && (name.length < 1 || name.length > 80)) return res.status(400).json({ detail: 'Project name must be between 1 and 80 characters.' });
  if (country !== undefined && !/^(?:[A-Z]{2}|GLOBAL)$/.test(country)) return res.status(400).json({ detail: 'Country must be a two-letter ISO code or GLOBAL.' });
  const updated = db.updateProject(req.params.id, req.user!.id, { ...(name !== undefined ? { name } : {}), ...(country !== undefined ? { country } : {}) });
  if (!updated) return res.status(404).json({ detail: 'Project not found in your workspace.' });
  res.json(publicProject(updated));
});

platformRouter.delete('/projects/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const deleted = db.deleteProject(req.params.id, req.user!.id);
  if (!deleted) return res.status(404).json({ detail: 'Project not found in your workspace.' });
  res.json({ status: 'success' });
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

