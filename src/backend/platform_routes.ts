import express from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { db } from './db.js';
import { clientIp, generateToken, hashPassword, requireAdmin, requireAuth, verifyPassword, AuthenticatedRequest } from './auth.js';
import { addCreditsToUser, consumeCredit, getCreditSnapshot, isAdminEmail, pakistanDayKey } from './credits.js';
import { researchKeywords } from './keywordProvider.js';
import { backlinkProviderConfigured, getBacklinkProfile } from './backlinkProvider.js';
import { AIService } from './ai_service.js';
import { validateTargetUrl } from './security.js';
import * as cheerio from 'cheerio';
import { WebsiteCrawler } from './crawler.js';
import { SEOAuditEngine } from './seo_audit.js';
import { auditContentPage } from './content.js';
import { createGoogleDataAuthorizationUrl, completeGoogleDataOAuth, disconnectGoogleData, getGoogleDataConnectionStatus, getGoogleDataDashboard, listGoogleDataResources, saveGoogleDataSelection } from './google_data.js';


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

function refreshEntitlement(user: NonNullable<ReturnType<typeof db.findUserById>>) {
  if (user.subscription_status === 'trialing' && user.trial_ends_at && Date.parse(user.trial_ends_at) <= Date.now()) {
    return db.updateUser(user.id, { plan: 'free', subscription_status: 'trial_expired', pending_plan: null }) || user;
  }
  return user;
}

function publicUser(input: ReturnType<typeof db.findUserById>) {
  if (!input) return null;
  const user = refreshEntitlement(input);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    created_at: user.created_at,
    settings: user.settings,
    is_admin: isAdminEmail(user.email),
    plan: user.plan,
    subscription_status: user.subscription_status || 'free',
    trial_started_at: user.trial_started_at || null,
    trial_ends_at: user.trial_ends_at || null,
    pending_plan: user.pending_plan || null
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

  const trialStarted = new Date();
  const trialEnds = new Date(trialStarted.getTime() + 3 * 24 * 60 * 60 * 1000);
  const user = db.createUser({
    name: cleanName,
    email: cleanEmail,
    password_hash: hashPassword(password),
    plan: 'pro',
    scans_used: 0,
    created_at: trialStarted.toISOString(),
    settings: {},
    extra_audits: 0,
    extra_ai: 0,
    extra_keywords: 0,
    subscription_status: 'trialing',
    trial_started_at: trialStarted.toISOString(),
    trial_ends_at: trialEnds.toISOString(),
    pending_plan: null
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

const BILLING_PLANS = {
  starter: { name: 'Starter', monthly_price: 19, currency: 'USD', limits: 'Core SEO toolkit · 5 projects' },
  pro: { name: 'Professional', monthly_price: 49, currency: 'USD', limits: 'Advanced research · 25 projects · live backlink data' },
  agency: { name: 'Agency', monthly_price: 129, currency: 'USD', limits: 'Multi-client workflow · 100 projects · team-ready reporting' }
} as const;

platformRouter.get('/billing/status', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = refreshEntitlement(req.user!);
  const remainingMs = user.trial_ends_at ? Math.max(0, Date.parse(user.trial_ends_at) - Date.now()) : 0;
  res.json({
    plan: user.plan,
    subscription_status: user.subscription_status || 'free',
    trial_started_at: user.trial_started_at || null,
    trial_ends_at: user.trial_ends_at || null,
    trial_days_remaining: user.subscription_status === 'trialing' ? Math.ceil(remainingMs / 86400000) : 0,
    pending_plan: user.pending_plan || null,
    pricing: BILLING_PLANS,
    payment_gateway_configured: false,
    payment_note: 'Online payment is not enabled yet. Plan requests are saved for manual approval until CROX payment details are configured.'
  });
});

platformRouter.post('/billing/request-plan', requireAuth, (req: AuthenticatedRequest, res) => {
  const plan = String(req.body?.plan || '').toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(BILLING_PLANS, plan)) return res.status(400).json({ detail: 'Choose a valid CROX plan.' });
  const user = refreshEntitlement(req.user!);
  if (user.subscription_status === 'active' && user.plan === plan) return res.json({ status: 'active', message: 'This plan is already active.' });
  if (user.pending_plan === plan) return res.json({ status: 'request_pending', message: 'Your request is already waiting for review.' });
  const id = randomUUID();
  db.createBillingRequest({ id, user_id: user.id, email: user.email, requested_plan: plan, created_at: new Date().toISOString() });
  db.updateUser(user.id, { pending_plan: plan });
  return res.status(202).json({ status: 'request_pending', request_id: id, message: 'Your plan request has been saved. A payment method will be enabled after CROX billing setup is complete. No charge has been made.' });
});

platformRouter.get('/admin/billing/requests', requireAuth, requireAdmin, (_req, res) => {
  res.json(db.listBillingRequests(200));
});

platformRouter.post('/admin/billing/activate', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const plan = String(req.body?.plan || '').toLowerCase();
  const requestId = String(req.body?.request_id || '').trim();
  if (!email || !['starter', 'pro', 'agency'].includes(plan)) return res.status(400).json({ detail: 'Provide a user email and valid plan.' });
  const user = db.findUserByEmail(email);
  if (!user) return res.status(404).json({ detail: 'User account was not found.' });
  const updated = db.updateUser(user.id, { plan: plan as 'starter' | 'pro' | 'agency', subscription_status: 'active', trial_ends_at: null, pending_plan: null });
  if (requestId) db.reviewBillingRequest(requestId, 'approved', 'Plan activated by CROX admin.');
  return res.json({ status: 'active', user: publicUser(updated) });
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
        plan: 'pro',
        scans_used: 0,
        created_at: new Date().toISOString(),
        settings: { auth_provider: 'google', google_sub: profile.sub || null },
        extra_audits: 0,
        extra_ai: 0,
        extra_keywords: 0,
        subscription_status: 'trialing',
        trial_started_at: new Date().toISOString(),
        trial_ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        pending_plan: null
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

// Separate Google data OAuth flow: does not alter the Google sign-in scope or token.
platformRouter.post('/integrations/google-data/start', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const authorizationUrl = createGoogleDataAuthorizationUrl(req.user!.id);
    return res.json({ authorization_url: authorizationUrl });
  } catch (error: any) {
    return res.status(503).json({ detail: String(error?.message || 'Google data OAuth is not configured.').slice(0, 260) });
  }
});

platformRouter.get('/integrations/google-data/callback', async (req, res) => {
  const errorCode = String(req.query.error || '');
  if (errorCode) return res.redirect('/app?google_data=denied');
  try {
    const userId = await completeGoogleDataOAuth(String(req.query.code || ''), String(req.query.state || ''));
    console.info(`[CROX Google Data] Connected read-only Google data sources for user ${userId}.`);
    return res.redirect('/app?google_data=connected');
  } catch (error: any) {
    console.warn('[CROX Google Data] OAuth callback failed:', String(error?.message || 'unknown error').slice(0, 220));
    return res.redirect('/app?google_data=error');
  }
});

platformRouter.get('/integrations/google-data/status', requireAuth, (req: AuthenticatedRequest, res) => {
  return res.json(getGoogleDataConnectionStatus(req.user!.id));
});

platformRouter.get('/integrations/google-data/resources', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    return res.json(await listGoogleDataResources(req.user!.id));
  } catch (error: any) {
    return res.status(502).json({ detail: String(error?.message || 'Could not load Google properties.').slice(0, 300) });
  }
});

platformRouter.post('/integrations/google-data/selection', requireAuth, async (req: AuthenticatedRequest, res) => {
  const projectId = String(req.body?.project_id || '').trim();
  const gaPropertyId = String(req.body?.ga_property_id || '').trim() || null;
  const gscSiteUrl = String(req.body?.gsc_site_url || '').trim() || null;
  if (!projectId || projectId.length > 128) return res.status(400).json({ detail: 'Select a CROX project first.' });
  if (!db.getProject(projectId, req.user!.id)) return res.status(404).json({ detail: 'The selected project was not found in your workspace.' });
  if (!gaPropertyId && !gscSiteUrl) return res.status(400).json({ detail: 'Select at least one Google Analytics or Search Console property.' });
  try {
    const resources = await listGoogleDataResources(req.user!.id);
    const gaProperty = gaPropertyId ? resources.analytics_properties.find(item => item.id === gaPropertyId) : null;
    const gscSite = gscSiteUrl ? resources.search_console_sites.find(item => item.site_url === gscSiteUrl) : null;
    if (gaPropertyId && !gaProperty) return res.status(400).json({ detail: 'That Google Analytics property is not available to the connected account.' });
    if (gscSiteUrl && !gscSite) return res.status(400).json({ detail: 'That Search Console site is not available to the connected account.' });

    const project = db.getProject(projectId, req.user!.id)!;
    if (gscSite?.site_url.startsWith('sc-domain:')) {
      const siteDomain = gscSite.site_url.slice('sc-domain:'.length).toLowerCase().replace(/^www\./, '');
      const projectDomain = project.domain.toLowerCase().replace(/^www\./, '');
      if (siteDomain !== projectDomain) return res.status(400).json({ detail: 'The selected Search Console domain does not match this CROX project.' });
    } else if (gscSite?.site_url) {
      try {
        const siteHost = new URL(gscSite.site_url).hostname.toLowerCase().replace(/^www\./, '');
        const projectDomain = project.domain.toLowerCase().replace(/^www\./, '');
        if (siteHost !== projectDomain) return res.status(400).json({ detail: 'The selected Search Console URL-prefix property does not match this CROX project.' });
      } catch { return res.status(400).json({ detail: 'Google returned an invalid Search Console property URL.' }); }
    }

    const saved = saveGoogleDataSelection({
      userId: req.user!.id,
      projectId,
      gaPropertyId,
      gaPropertyName: gaProperty?.name || null,
      gscSiteUrl
    });
    return res.json({ status: 'saved', selection: saved });
  } catch (error: any) {
    return res.status(502).json({ detail: String(error?.message || 'Could not save Google property selection.').slice(0, 300) });
  }
});

platformRouter.get('/integrations/google-data/selection', requireAuth, (req: AuthenticatedRequest, res) => {
  const projectId = String(req.query.project_id || '').trim();
  if (!projectId || projectId.length > 128) return res.status(400).json({ detail: 'Select a CROX project first.' });
  if (!db.getProject(projectId, req.user!.id)) return res.status(404).json({ detail: 'The selected project was not found in your workspace.' });
  const selection = db.getGoogleDataPropertySelection(req.user!.id, projectId);
  return res.json(selection || { project_id: projectId, ga_property_id: null, ga_property_name: null, gsc_site_url: null });
});

platformRouter.delete('/integrations/google-data', requireAuth, (req: AuthenticatedRequest, res) => {
  disconnectGoogleData(req.user!.id);
  return res.json({ status: 'disconnected' });
});

platformRouter.get('/analytics/dashboard', requireAuth, async (req: AuthenticatedRequest, res) => {
  const projectId = String(req.query.project_id || '').trim();
  if (!projectId || projectId.length > 128) return res.status(400).json({ detail: 'Select a CROX project to load its analytics.' });
  if (!db.getProject(projectId, req.user!.id)) return res.status(404).json({ detail: 'The selected project was not found in your workspace.' });
  const requestedDays = Number(req.query.days || 30);
  const days = Number.isFinite(requestedDays) ? Math.min(90, Math.max(7, Math.floor(requestedDays))) : 30;
  try {
    const result = await getGoogleDataDashboard(req.user!.id, projectId, days);
    return res.json(result);
  } catch (error: any) {
    return res.status(502).json({ detail: String(error?.message || 'Google analytics could not be loaded.').slice(0, 300) });
  }
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
      goal: String(req.body?.goal || 'Grow qualified organic traffic').slice(0, 240),
      use_ai: req.body?.use_ai === true,
      limit: Math.min(250, Math.max(25, Number(req.body?.limit) || 100))
    }, req.user!.id);
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
  const mode = String(req.body?.mode || 'free') === 'live' ? 'live' : 'free';
  if (mode === 'live') {
    const user = refreshEntitlement(req.user!);
    if (!['trialing', 'active'].includes(String(user.subscription_status)) || user.plan === 'free') {
      return res.status(402).json({ upgrade_required: true, detail: 'Live referring-domain and backlink-index data is available on an active CROX trial or paid plan.' });
    }
    if (!backlinkProviderConfigured()) return res.status(503).json({ provider_not_configured: true, detail: 'Live backlink data is not connected. Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD to the server environment.' });
    const lookupLimit = user.subscription_status === 'trialing' ? 1 : (user.plan === 'agency' ? 40 : user.plan === 'pro' ? 15 : 5);
    if (!db.consumeBacklinkLookup(user.id, pakistanDayKey(), lookupLimit)) {
      return res.status(429).json({ detail: `Daily live backlink lookup allowance reached (${lookupLimit}/day). The allowance resets at midnight Pakistan time.` });
    }
    try {
      const profile = await getBacklinkProfile(validation.hostname, 50);
      return res.json({ mode: 'live', provider: 'DataForSEO Backlinks API', summary: profile.summary, backlinks: profile.backlinks, checked_at: new Date().toISOString(), note: 'Live provider metrics. Data coverage and refresh timing depend on the external backlink index.' });
    } catch (error: any) {
      return res.status(502).json({ detail: String(error?.message || 'Live backlink provider request failed.').slice(0, 260) });
    }
  }
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
          outbound.push({ url: abs.toString(), rel: String($(el).attr('rel') || ''), text: $(el).text().trim().slice(0, 160) });
        }
      } catch { /* Ignore malformed hrefs. */ }
    });
    const unique = Array.from(new Map(outbound.map(item => [item.url, item])).values()).slice(0, 100);
    return res.json({
      mode: 'free', provider: 'CROX page crawl', target: host,
      outbound_external_links: unique.length,
      nofollow_outbound: unique.filter(item => /nofollow/i.test(item.rel)).length,
      dofollow_outbound: unique.filter(item => !/nofollow/i.test(item.rel)).length,
      links: unique,
      note: 'Free snapshot of external links found on the submitted homepage. These are outgoing links, not backlinks pointing to your domain. Use Live Backlink Index for referring domains and inbound links.'
    });
  } catch {
    return res.status(502).json({ detail: 'Could not inspect the public homepage for outbound links.' });
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
    String(req.body?.goal || 'Publish useful pages that can earn search visits'),
    req.user!.id
  );
  res.json({
    ideas: result.brief,
    ai_mode: result.ai_mode,
    note: result.note,
    credits: credit.snapshot
  });
});

// Content brief generation and single-page content auditing.
platformRouter.post('/content/briefs', requireAuth, async (req: AuthenticatedRequest, res) => {
  const keyword = String(req.body?.keyword || '').trim();
  const projectIdRaw = String(req.body?.project_id || '').trim();
  const projectId = projectIdRaw || null;
  if (!keyword || keyword.length > 160) {
    return res.status(400).json({ detail: 'Enter a target keyword between 1 and 160 characters.' });
  }
  if (projectId && projectId.length > 128) {
    return res.status(400).json({ detail: 'Project ID is too long.' });
  }

  const project = projectId ? db.getProject(projectId, req.user!.id) : undefined;
  if (projectId && !project) {
    return res.status(404).json({ detail: 'The selected project was not found in your workspace.' });
  }
  const country = String(req.body?.country || project?.country || '').trim().toUpperCase();
  if (!/^(?:[A-Z]{2}|GLOBAL)$/.test(country)) {
    return res.status(400).json({ detail: 'Enter a two-letter country code or GLOBAL.' });
  }

  // A brief is an AI feature and consumes one AI credit, including local fallback drafts.
  const credit = consumeCredit(req.user!, 'ai');
  if (!credit.ok) return res.status(402).json({ detail: credit.message, credits: credit.snapshot });

  try {
    const generated = await AIService.generateContentBrief(keyword, country, req.user!.id);
    const saved = db.addContentBrief({
      id: randomUUID(),
      user_id: req.user!.id,
      project_id: projectId,
      keyword,
      country,
      title: generated.title,
      outline: generated.outline,
      target_word_count: generated.target_word_count,
      questions: generated.questions,
      related_terms: generated.related_terms,
      intent: generated.intent,
      ai_mode: generated.ai_mode,
      status: 'draft',
      created_at: new Date().toISOString()
    });

    return res.status(201).json({
      brief: saved,
      review_required: true,
      draft_status: 'draft',
      note: generated.note,
      credits: credit.snapshot
    });
  } catch (error: any) {
    console.error('[CROX Content] Brief generation/storage failed:', error?.message || error);
    return res.status(500).json({ detail: 'CROX could not save this content brief. Your AI credit may have been used; check your saved briefs before retrying.' });
  }
});

platformRouter.get('/content/briefs', requireAuth, (req: AuthenticatedRequest, res) => {
  const projectId = typeof req.query.project_id === 'string' ? req.query.project_id.trim() : '';
  if (projectId && !db.getProject(projectId, req.user!.id)) {
    return res.status(404).json({ detail: 'The selected project was not found in your workspace.' });
  }
  return res.json({ briefs: db.listContentBriefs(req.user!.id, projectId || undefined) });
});

platformRouter.post('/content/audit', requireAuth, async (req: AuthenticatedRequest, res) => {
  const rawUrl = String(req.body?.url || '').trim();
  const keywordRaw = String(req.body?.keyword || '').trim();
  const keyword = keywordRaw ? keywordRaw.slice(0, 160) : null;
  if (!rawUrl || rawUrl.length > 2048) {
    return res.status(400).json({ detail: 'Enter a URL no longer than 2,048 characters.' });
  }

  // Match the main crawler's SSRF/public-target protections before spending an audit credit.
  const validation = await validateTargetUrl(rawUrl);
  if (!validation.valid) {
    return res.status(400).json({ detail: validation.error || 'Enter a valid public website URL.' });
  }

  const credit = consumeCredit(req.user!, 'audit');
  if (!credit.ok) return res.status(402).json({ detail: credit.message, credits: credit.snapshot });

  try {
    // The existing crawler is deliberately limited to the requested page.
    const crawl = await new WebsiteCrawler(validation.normalizedUrl, 1).crawl();
    const page = crawl.pages[0];
    if (!page) {
      return res.status(502).json({ detail: 'CROX could not extract a page from this URL.', credits: credit.snapshot });
    }

    // Reuse existing SEO checks for title/H1/thin-content signals, then add local content scoring.
    const audit = SEOAuditEngine.audit([page], `content-${randomUUID()}`);
    const contentAudit = auditContentPage(page, keyword, audit.issues);
    return res.json({
      status: 'success',
      target_url: page.url,
      http_status: page.statusCode,
      content_type: page.contentType,
      content_audit: contentAudit,
      credits: credit.snapshot
    });
  } catch (error: any) {
    console.warn('[CROX Content] Page content audit failed:', error?.message || 'unknown error');
    return res.status(502).json({ detail: 'CROX could not crawl this public page. Confirm that it is reachable and returns HTML, then try again.', credits: credit.snapshot });
  }
});

