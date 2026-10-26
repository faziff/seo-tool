import React, { useEffect, useState } from 'react';
import {
  ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Sparkles,
  TrendingUp, Search, ShieldCheck, Zap, LoaderCircle, UserRound
} from 'lucide-react';
import { checkAccountService, loginUser, registerUser } from '../services/api';
import { User } from '../types';
import { BrandMark } from './BrandMark';

interface AuthPageProps {
  onSuccess: (user: User) => void;
  initialMode?: 'login' | 'register';
}

const features = [
  { icon: Search, title: 'SEO intelligence', text: 'Turn technical issues into a clear action plan.' },
  { icon: TrendingUp, title: 'Keyword opportunities', text: 'Find long-tail ideas and organize search intent.' },
  { icon: Sparkles, title: 'NOVA AI copilot', text: 'Get guidance, drafts, and practical fixes.' },
];

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess, initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    let active = true;
    checkAccountService().then((online) => {
      if (active) setServiceStatus(online ? 'online' : 'offline');
    });
    return () => { active = false; };
  }, []);

  const changeMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (mode === 'register') {
      if (!name.trim()) return setError('Enter your name to create a workspace.');
      if (password.length < 8) return setError('Use a password with at least 8 characters.');
      if (password !== confirmPassword) return setError('Your passwords do not match.');
    }
    setLoading(true);
    try {
      const result = mode === 'register'
        ? await registerUser(name.trim(), email.trim(), password, confirmPassword)
        : await loginUser(email.trim(), password);
      onSuccess(result.user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="crox-auth min-h-screen w-full overflow-hidden text-white">
      <div className="crox-auth-glow crox-auth-glow-one" />
      <div className="crox-auth-glow crox-auth-glow-two" />
      <header className="crox-auth-topbar">
        <a href="#top" className="crox-brand-lockup" aria-label="CROX home">
          <BrandMark size={42} />
          <span>CROX</span>
          <span className="crox-brand-divider" />
          <span className="crox-brand-tagline">SEARCH INTELLIGENCE</span>
        </a>
        <div className="crox-top-trust" title={serviceStatus === 'offline' ? 'The account API is not reachable from this page.' : 'Account service status'}>
          <span className={serviceStatus === 'online' ? 'crox-live-dot' : serviceStatus === 'offline' ? 'crox-live-dot crox-status-offline' : 'crox-live-dot crox-status-checking'} />
          {serviceStatus === 'online' ? 'Secure service connected' : serviceStatus === 'offline' ? 'Account service unavailable' : 'Checking secure connection'}
        </div>
      </header>

      <div className="crox-auth-layout" id="top">
        <section className="crox-auth-story" aria-label="CROX product introduction">
          <div className="crox-eyebrow"><Sparkles size={13} /> YOUR WEBSITE'S GROWTH DESK</div>
          <h1>Make every search<br /><span>work harder.</span></h1>
          <p className="crox-auth-description">One focused workspace for technical SEO, keyword discovery, competitor signals, and AI-assisted next steps.</p>

          <div className="crox-visual-stage" aria-label="Illustration of CROX search intelligence dashboard">
            <div className="crox-visual-orbit crox-orbit-one" />
            <div className="crox-visual-orbit crox-orbit-two" />
            <div className="crox-visual-orbit crox-orbit-three" />
            <div className="crox-orbit-node node-one"><Search size={17} /></div>
            <div className="crox-orbit-node node-two"><TrendingUp size={17} /></div>
            <div className="crox-orbit-node node-three"><Zap size={16} /></div>
            <div className="crox-nova-wrap">
              <div className="crox-nova-halo" />
              <div className="crox-nova-orb"><span /><i /><b /></div>
            </div>
            <div className="crox-floating-card crox-float-score">
              <div className="crox-float-label"><span className="crox-mini-mark"><BrandMark size={16} /></span> Site health</div>
              <div className="crox-score-row"><strong>92</strong><span>/100</span><em><TrendingUp size={12} /> +8.4%</em></div>
              <div className="crox-score-track"><i /></div>
              <small>Technical signals in focus</small>
            </div>
            <div className="crox-floating-card crox-float-keywords">
              <div className="crox-float-label"><span className="crox-keyword-icon"><Search size={13} /></span> Keyword opportunities</div>
              <strong>+128 <small>ideas mapped</small></strong>
              <div className="crox-keyword-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
              <span className="crox-keyword-note"><span className="crox-live-dot" /> Search intent clusters</span>
            </div>
            <div className="crox-floating-chip"><span className="crox-chip-stars">✳</span><div><strong>NOVA is ready</strong><small>Your AI growth copilot</small></div><span className="crox-chip-pulse" /></div>
          </div>

          <div className="crox-feature-list">
            {features.map(({ icon: Icon, title, text }) => (
              <div className="crox-feature-item" key={title}>
                <span className="crox-feature-icon"><Icon size={17} /></span>
                <div><h3>{title}</h3><p>{text}</p></div>
              </div>
            ))}
          </div>
          <div className="crox-auth-footnote"><ShieldCheck size={14} /> Your workspace stays behind your sign-in.</div>
        </section>

        <section className="crox-auth-panel" aria-label={mode === 'login' ? 'Sign in' : 'Create account'}>
          <div className="crox-auth-card">
            <div className="crox-card-topline"><span className="crox-card-signal" /><span>WORKSPACE ACCESS</span><span className="crox-card-topline-right">CROX / 01</span></div>
            <div className="crox-form-mark"><BrandMark size={38} /></div>
            <h2>{mode === 'login' ? 'Welcome back.' : 'Build your edge.'}</h2>
            <p className="crox-form-subtitle">{mode === 'login' ? 'Sign in to pick up where your strategy left off.' : 'Create your free workspace and make your next move count.'}</p>

            {serviceStatus === 'offline' && (
              <div className="crox-form-error" role="status">
                The account server is not connected to this page. Your account cannot be saved from a static preview. Start CROX with <code>npm run dev</code>, or deploy the Node.js app with its backend enabled.
              </div>
            )}

            <div className="crox-auth-tabs" role="tablist" aria-label="Account type">
              <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => changeMode('login')} className={mode === 'login' ? 'active' : ''}>Sign in</button>
              <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => changeMode('register')} className={mode === 'register' ? 'active' : ''}>Create account</button>
            </div>

            <form className="crox-auth-form" onSubmit={handleSubmit}>
              {mode === 'register' && (
                <label className="crox-field"><span>Full name</span><div className="crox-input-wrap"><UserRound size={16} /><input autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required /></div></label>
              )}
              <label className="crox-field"><span>Email address</span><div className="crox-input-wrap"><Mail size={16} /><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required /></div></label>
              <label className="crox-field"><span>Password</span><div className="crox-input-wrap"><LockKeyhole size={16} /><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'} minLength={mode === 'register' ? 8 : 1} required /><button className="crox-password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
              {mode === 'register' && <label className="crox-field"><span>Confirm password</span><div className="crox-input-wrap"><LockKeyhole size={16} /><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat your password" minLength={8} required /></div></label>}

              {error && <div className="crox-form-error" role="alert">{error}</div>}
              <button className="crox-submit-button" type="submit" disabled={loading}>{loading ? <><LoaderCircle size={17} className="crox-spin" /> Securely connecting…</> : <>{mode === 'login' ? 'Enter your workspace' : 'Create my workspace'} <ArrowRight size={17} /></>}</button>
            </form>
            <div className="crox-privacy-note"><LockKeyhole size={12} /> Secure account access <span /> No card required to get started</div>
          </div>
          <div className="crox-auth-support">Need a little direction? <button onClick={() => changeMode(mode === 'login' ? 'register' : 'login')} type="button">{mode === 'login' ? 'Create your workspace' : 'I already have an account'} <ArrowRight size={13} /></button></div>
          <div className="crox-auth-copyright">© {new Date().getFullYear()} CROX INTELLIGENCE <span>•</span> SEARCH SMARTER</div>
        </section>
      </div>
    </main>
  );
};
