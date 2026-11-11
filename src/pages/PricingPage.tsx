import React, { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, Check, Clock3, LockKeyhole, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import { getBillingStatus, requestBillingPlan, type BillingStatus } from '../services/api';

const plans = [
  { id: 'starter', name: 'Starter', price: '$19', intro: 'For a focused website owner', popular: false, features: ['Core site audit and issue tracking', 'Keyword research workspace', 'Up to 5 projects', 'Reports and CSV exports', 'Daily free-tier allowances'] },
  { id: 'pro', name: 'Professional', price: '$49', intro: 'For growing SEO teams', popular: true, features: ['Everything in Starter', 'Live backlink index integration', 'Competitor and keyword workflows', 'Up to 25 projects', 'Advanced reports and automation'] },
  { id: 'agency', name: 'Agency', price: '$129', intro: 'For multi-client delivery', popular: false, features: ['Everything in Professional', 'Up to 100 client projects', 'Agency reporting workflows', 'Priority workspace controls', 'Team-ready account structure'] }
];

export const PricingPage: React.FC = () => {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [busyPlan, setBusyPlan] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const load = async () => { try { setStatus(await getBillingStatus()); } catch (err) { setError(err instanceof Error ? err.message : 'Billing status unavailable.'); } };
  useEffect(() => { void load(); }, []);

  const choose = async (plan: string) => {
    setBusyPlan(plan); setFeedback(''); setError('');
    try {
      const response = await requestBillingPlan(plan);
      setFeedback(response.message || 'Your plan request has been saved.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not submit the plan request.'); }
    finally { setBusyPlan(''); }
  };

  const trialActive = status?.subscription_status === 'trialing';
  const expired = status?.subscription_status === 'trial_expired';
  return <div className="crox-product-page crox-pricing-page">
    <div className="crox-product-heading crox-pricing-heading">
      <div><div className="crox-eyebrow"><WalletCards size={13} /> CROX PLANS & BILLING</div><h1>Choose the right SEO workspace</h1><p>Start with a three-day Pro trial. Keep your core workspace on the free tier after the trial, then upgrade when you're ready.</p></div>
      <div className="crox-pricing-trial-stamp"><Sparkles size={16} /><span><strong>3-day free trial</strong><small>No card required during setup</small></span></div>
    </div>

    {status && <div className={`crox-billing-status ${expired ? 'expired' : trialActive ? 'trial' : 'normal'}`}>
      <div className="crox-billing-status-icon">{trialActive ? <Clock3 size={20} /> : expired ? <LockKeyhole size={20} /> : <ShieldCheck size={20} />}</div>
      <div><strong>{trialActive ? `Your Professional trial is active${status.trial_days_remaining ? ` · ${status.trial_days_remaining} day${status.trial_days_remaining === 1 ? '' : 's'} remaining` : ''}` : expired ? 'Your free trial has ended' : status.subscription_status === 'active' ? 'Your paid plan is active' : 'You are using the CROX free workspace'}</strong><span>{trialActive ? `Trial ends ${status.trial_ends_at ? new Date(status.trial_ends_at).toLocaleString() : 'in three days'}. Your account will return to free allowances when it expires.` : expired ? 'Your projects and saved data remain in your account. Choose a plan to restore premium access.' : 'Daily essentials remain available on the free tier, with upgrade requests managed from this page.'}</span></div>
      <span className="crox-status-pill is-good">{trialActive ? 'TRIAL' : status.subscription_status.toUpperCase().replace('_', ' ')}</span>
    </div>}

    {(feedback || error) && <div className={`crox-inline-alert ${error ? 'is-error' : ''}`}><BadgeCheck size={16} /><span>{error || feedback}</span></div>}

    <div className="crox-pricing-grid">
      {plans.map(plan => {
        const active = status?.plan === plan.id && (status?.subscription_status === 'active' || status?.subscription_status === 'trialing');
        const pending = status?.pending_plan === plan.id;
        return <section key={plan.id} className={`crox-price-card ${plan.popular ? 'featured' : ''}`}>
          {plan.popular && <div className="crox-price-ribbon">MOST POPULAR</div>}
          <div className="crox-price-name">{plan.name}</div><p>{plan.intro}</p>
          <div className="crox-price-amount">{plan.price}<small>/ month</small></div>
          <div className="crox-price-divider" />
          <ul>{plan.features.map(feature => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
          <button type="button" className={plan.popular ? 'crox-btn-primary' : 'crox-btn-secondary'} onClick={() => void choose(plan.id)} disabled={Boolean(busyPlan) || active || pending}>
            {busyPlan === plan.id ? 'Submitting…' : active ? 'Current plan' : pending ? 'Request pending' : 'Request this plan'} <ArrowRight size={15} />
          </button>
          <small className="crox-price-footnote">No charge is made from this screen.</small>
        </section>;
      })}
    </div>

    <div className="crox-billing-note"><LockKeyhole size={16} /><div><strong>Secure payment setup is coming next</strong><p>{status?.payment_note || 'CROX plan requests are saved for manual approval. A payment gateway and virtual account have not been connected yet, so no card or bank payment is collected.'}</p></div></div>
    <div className="crox-free-tier-note"><strong>What happens when the trial ends?</strong><span>Your saved projects, reports and settings stay in CROX. Premium-only access switches off automatically; core tools keep the existing free daily limits: 3 site scans, 15 AI messages and 5 keyword research requests per Pakistan day.</span></div>
  </div>;
};
