import React, { useState } from 'react';
import {
  X,
  Send,
  Loader2,
  User,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { askCROXAI } from '../services/api';
import { NovaOrb } from './NovaOrb';
import { ScanReport } from '../types';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  report: ScanReport | null;
}

interface Message {
  role: 'assistant' | 'user';
  text: string;
}

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  isOpen,
  onClose,
  report
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: report
        ? `Hello! I am NOVA AI, your website audit copilot. I have context on your recent scan for ${report.domain} (Health Score: ${report.health_score}/100 with ${report.issues.length} detected findings). How can I help you improve your search visibility or technical performance today?`
        : 'Hello! I am NOVA AI. Ask me any question about on-page SEO, technical crawling rules, Core Web Vitals, or how to resolve site audit issues.'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const quickPrompts = [
    'What is the highest priority issue to fix?',
    'How do I resolve missing meta descriptions?',
    'Explain Time to First Byte (TTFB) optimization',
    'Generate schema.org JSON-LD for an organization'
  ];

  const handleSend = async (messageText: string) => {
    if (!messageText.trim() || loading) return;

    const userMsg = messageText.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await askCROXAI(userMsg, report?.scan_id);
      setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `NOVA AI response error: ${err.message}. If running locally, please ensure GEMINI_API_KEY is configured in your backend environment.`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#100d21] border border-violet-100/80 flex items-center justify-center shadow-xs">
              <NovaOrb size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">NOVA AI Assistant</h3>
              <p className="text-[11px] text-slate-500">Technical SEO & Architecture Copilot</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
            aria-label="Close assistant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scan Context Banner */}
        {report && (
          <div className="px-4 py-2 bg-indigo-50/60 border-b border-indigo-100 flex items-center justify-between text-xs">
            <span className="text-indigo-900 font-medium truncate">
              Active Context: <strong className="font-semibold">{report.domain}</strong>
            </span>
            <span className="text-indigo-700 font-mono font-semibold">
              Score: {report.health_score}/100
            </span>
          </div>
        )}

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-6 h-6 rounded-md bg-[#100d21] border border-violet-100/80 flex items-center justify-center shrink-0 mt-0.5">
                  <NovaOrb size={17} />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-xs'
                    : 'bg-slate-100 text-slate-800 rounded-tl-xs font-sans'
                }`}
              >
                {m.text}
              </div>
              {m.role === 'user' && (
                <div className="w-6 h-6 rounded-md bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                  FE
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs pl-8">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>NOVA AI is thinking...</span>
            </div>
          )}
        </div>

        {/* Quick Prompts */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Suggested Prompts
          </p>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSend(p)}
                className="text-[11px] bg-white border border-slate-200/90 rounded-lg px-2.5 py-1 text-slate-700 hover:border-indigo-400 hover:text-indigo-600 text-left transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about SEO issues, fixes, or schemas..."
            className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
