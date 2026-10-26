import { db, UserEntity } from './db.js';

export const DAILY_LIMITS = {
  audits: 3,
  ai_messages: 15,
  keyword_searches: 5
} as const;

export type CreditKind = 'audit' | 'ai' | 'keyword';

export function pakistanDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function msUntilPakistanMidnight(date = new Date()): number {
  const nowParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const hour = Number(nowParts.find(p => p.type === 'hour')?.value || 0);
  const minute = Number(nowParts.find(p => p.type === 'minute')?.value || 0);
  const second = Number(nowParts.find(p => p.type === 'second')?.value || 0);
  const elapsed = ((hour * 60 + minute) * 60 + second) * 1000;
  return 24 * 60 * 60 * 1000 - elapsed;
}

export function formatResetIn(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function fieldFor(kind: CreditKind): 'audits' | 'ai_messages' | 'keyword_searches' {
  if (kind === 'audit') return 'audits';
  if (kind === 'ai') return 'ai_messages';
  return 'keyword_searches';
}

function extraFor(user: UserEntity, kind: CreditKind): number {
  if (kind === 'audit') return user.extra_audits || 0;
  if (kind === 'ai') return user.extra_ai || 0;
  return user.extra_keywords || 0;
}

function limitFor(kind: CreditKind): number {
  if (kind === 'audit') return DAILY_LIMITS.audits;
  if (kind === 'ai') return DAILY_LIMITS.ai_messages;
  return DAILY_LIMITS.keyword_searches;
}

export function getCreditSnapshot(user: UserEntity) {
  const dayKey = pakistanDayKey();
  const usage = db.getDailyUsage(user.id, dayKey);
  const resetsInMs = msUntilPakistanMidnight();
  const resetLabel = formatResetIn(resetsInMs);
  const auditsUsed = usage.audits;
  const aiUsed = usage.ai_messages;
  const kwUsed = usage.keyword_searches;
  return {
    timezone: 'Asia/Karachi (UTC+5)',
    day_key: dayKey,
    resets_in_ms: resetsInMs,
    resets_in: resetLabel,
    audits: {
      used: auditsUsed,
      daily_limit: DAILY_LIMITS.audits,
      bonus: user.extra_audits || 0,
      remaining: Math.max(0, DAILY_LIMITS.audits - auditsUsed) + (user.extra_audits || 0)
    },
    ai: {
      used: aiUsed,
      daily_limit: DAILY_LIMITS.ai_messages,
      bonus: user.extra_ai || 0,
      remaining: Math.max(0, DAILY_LIMITS.ai_messages - aiUsed) + (user.extra_ai || 0)
    },
    keywords: {
      used: kwUsed,
      daily_limit: DAILY_LIMITS.keyword_searches,
      bonus: user.extra_keywords || 0,
      remaining: Math.max(0, DAILY_LIMITS.keyword_searches - kwUsed) + (user.extra_keywords || 0)
    },
    header_label: `AI: ${Math.max(0, DAILY_LIMITS.ai_messages - aiUsed) + (user.extra_ai || 0)}/${DAILY_LIMITS.ai_messages} left, resets in ${resetLabel}`
  };
}

export function consumeCredit(user: UserEntity, kind: CreditKind): {
  ok: boolean;
  message: string;
  snapshot: ReturnType<typeof getCreditSnapshot>;
} {
  const snapshot = getCreditSnapshot(user);
  const remaining = kind === 'audit' ? snapshot.audits.remaining : kind === 'ai' ? snapshot.ai.remaining : snapshot.keywords.remaining;
  const names = { audit: 'site audits', ai: 'AI messages', keyword: 'keyword searches' };
  if (remaining <= 0) {
    return {
      ok: false,
      message: `Today’s ${names[kind]} allowance is used up. It resets at midnight Pakistan time (in ${snapshot.resets_in}). Ask an admin to add extra credits if you need more now.`,
      snapshot
    };
  }

  const dailyLimit = limitFor(kind);
  const usage = db.getDailyUsage(user.id, snapshot.day_key);
  const usedToday = usage[fieldFor(kind)];
  if (usedToday < dailyLimit) {
    db.incrementUsage(user.id, snapshot.day_key, fieldFor(kind));
  } else {
    const extra = extraFor(user, kind);
    if (extra <= 0) {
      return {
        ok: false,
        message: `Today’s ${names[kind]} allowance is used up. It resets at midnight Pakistan time (in ${snapshot.resets_in}).`,
        snapshot: getCreditSnapshot(user)
      };
    }
    const patch =
      kind === 'audit' ? { extra_audits: extra - 1 }
        : kind === 'ai' ? { extra_ai: extra - 1 }
          : { extra_keywords: extra - 1 };
    db.updateUser(user.id, patch);
  }

  const fresh = db.findUserById(user.id) || user;
  return { ok: true, message: 'ok', snapshot: getCreditSnapshot(fresh) };
}

export function addCreditsToUser(email: string, extras: { audits?: number; ai?: number; keywords?: number }) {
  const user = db.findUserByEmail(email);
  if (!user) return null;
  return db.updateUser(user.id, {
    extra_audits: user.extra_audits + Math.max(0, Math.floor(extras.audits || 0)),
    extra_ai: user.extra_ai + Math.max(0, Math.floor(extras.ai || 0)),
    extra_keywords: user.extra_keywords + Math.max(0, Math.floor(extras.keywords || 0))
  });
}

export function isAdminEmail(email: string): boolean {
  const admin = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  return !!admin && admin === email.trim().toLowerCase();
}
