"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";

const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4CBDFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    title: "Shield Strength Scoring",
    desc: "AI analyzes every detection rule and scores its defensive coverage, false-positive rate, and evasion resilience.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="22" y1="12" x2="18" y2="12" />
        <line x1="6" y1="12" x2="2" y2="12" />
        <line x1="12" y1="6" x2="12" y2="2" />
        <line x1="12" y1="22" x2="12" y2="18" />
      </svg>
    ),
    title: "MITRE ATT&CK Mapping",
    desc: "Automatically map rules to tactics, techniques, and sub-techniques with confidence scoring.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FB7185" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    title: "Evasion Risk Detection",
    desc: "Identify blind spots and evasion techniques attackers could use to bypass your detection rules.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
    title: "Rule Templates",
    desc: "Start from battle-tested templates for common threat scenarios and customize to your environment.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
    title: "Custom Scoring Fields",
    desc: "Define custom fields, scoring criteria, and quality gates tailored to your organization.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6ED1CA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
    ),
    title: "Webhook Integration",
    desc: "Push events to external systems with HMAC-signed webhooks for rule changes and analyses.",
  },
];

const STATS = [
  { value: 6, label: "AI ANALYSIS ENGINES", suffix: "" },
  { value: 4, label: "RULE LANGUAGES", suffix: "" },
  { value: 200, label: "MITRE TECHNIQUES", suffix: "+" },
  { value: 10, label: "SCORING DIMENSIONS", suffix: "" },
];

const CODE_LINES = [
  { indent: 0, parts: [{ text: "process where", cls: "text-primary" }, { text: ' event.type == ', cls: "text-text-secondary" }, { text: '"start"', cls: "text-success" }] },
  { indent: 1, parts: [{ text: "and", cls: "text-primary" }, { text: " process.name : (", cls: "text-text-secondary" }, { text: '"powershell.exe"', cls: "text-success" }, { text: ", ", cls: "text-text-secondary" }, { text: '"pwsh.exe"', cls: "text-success" }, { text: ")", cls: "text-text-secondary" }] },
  { indent: 1, parts: [{ text: "and", cls: "text-primary" }, { text: " process.args : (", cls: "text-text-secondary" }, { text: '"-enc*"', cls: "text-success" }, { text: ", ", cls: "text-text-secondary" }, { text: '"-e *"', cls: "text-success" }, { text: ", ", cls: "text-text-secondary" }, { text: '"*bypass*"', cls: "text-success" }, { text: ")", cls: "text-text-secondary" }] },
  { indent: 1, parts: [{ text: "and not", cls: "text-primary" }, { text: " process.parent.name : (", cls: "text-text-secondary" }, { text: '"explorer.exe"', cls: "text-success" }, { text: ",", cls: "text-text-secondary" }] },
  { indent: 5, parts: [{ text: '"svchost.exe"', cls: "text-success" }, { text: ")", cls: "text-text-secondary" }] },
];

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); } },
      { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function AnimatedCounter({ value, suffix = "", duration = 1500 }: { value: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); observer.unobserve(el); } },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, value, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
}

function TypewriterCode({ lines, visible }: { lines: typeof CODE_LINES; visible: boolean }) {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setVisibleLines(0);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setVisibleLines(i);
      if (i >= lines.length) clearInterval(interval);
    }, 400);
    return () => clearInterval(interval);
  }, [visible, lines.length]);

  return (
    <div className="font-mono text-sm leading-loose">
      {lines.map((line, i) => (
        <div
          key={i}
          style={{ paddingLeft: `${line.indent * 1.5}rem` }}
          className={`transition-all duration-300 ${i < visibleLines ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
        >
          {line.parts.map((p, j) => (
            <span key={j} className={p.cls}>{p.text}</span>
          ))}
          {i === visibleLines - 1 && i < lines.length - 1 && (
            <span className="text-primary animate-pulse">|</span>
          )}
        </div>
      ))}
    </div>
  );
}

function AnimatedGauge({ visible }: { visible: boolean }) {
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / 1800, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setScore(Math.round(eased * 75));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [visible]);

  const circumference = 2 * Math.PI * 85;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="pulse-ring inline-block">
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="85" fill="none" stroke="#1E2D3D" strokeWidth="6" />
        <circle
          cx="100" cy="100" r="85" fill="none" stroke="#4CBDFA" strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={visible ? offset : circumference}
          transform="rotate(-90 100 100)"
          style={{ transition: 'stroke-dashoffset 1.8s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
        <text x="100" y="92" textAnchor="middle" fill="white" fontSize="48" fontWeight="800">{score}</text>
        <text x="100" y="116" textAnchor="middle" fill="#64748B" fontSize="12" letterSpacing="2">SHIELD SCORE</text>
      </svg>
    </div>
  );
}

function MouseGlow() {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--glow-x', `${e.clientX - rect.left}px`);
    ref.current.style.setProperty('--glow-y', `${e.clientY - rect.top}px`);
    ref.current.style.setProperty('--glow-opacity', '1');
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.setProperty('--glow-opacity', '0');
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none" style={{ '--glow-opacity': '0' } as React.CSSProperties}>
      <div
        className="absolute w-[600px] h-[600px] rounded-full pointer-events-none transition-opacity duration-300"
        style={{
          left: 'var(--glow-x, 50%)',
          top: 'var(--glow-y, 50%)',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(76, 189, 250, 0.07) 0%, transparent 70%)',
          opacity: 'var(--glow-opacity, 0)',
        }}
      />
    </div>
  );
}

export default function LandingPage() {
  const hero = useScrollReveal();
  const demo = useScrollReveal();
  const features = useScrollReveal();
  const stats = useScrollReveal();
  const code = useScrollReveal();
  const cta = useScrollReveal();

  return (
    <div className="min-h-screen relative bg-bg grid-bg overflow-hidden">
      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[15%] right-[8%] w-1 h-1 rounded-full bg-danger animate-float-1" />
        <div className="absolute top-[55%] right-[3%] w-[3px] h-[3px] rounded-full bg-severity-high animate-float-2" />
        <div className="absolute top-[30%] left-[5%] w-[3px] h-[3px] rounded-full bg-danger animate-float-3" />
        <div className="absolute top-[70%] right-[12%] w-1 h-1 rounded-full bg-severity-high animate-float-4" />
        <div className="absolute top-[45%] left-[10%] w-[3px] h-[3px] rounded-full bg-danger animate-float-1 [animation-delay:5s]" />
        <div className="absolute top-[80%] left-[15%] w-[2px] h-[2px] rounded-full bg-severity-high animate-float-2 [animation-delay:4s]" />
        <div className="absolute top-[20%] right-[20%] w-[3px] h-[3px] rounded-full bg-primary/40 animate-float-3 [animation-delay:6s]" />
        <div className="absolute top-[60%] left-[25%] w-[2px] h-[2px] rounded-full bg-warning/40 animate-float-4 [animation-delay:7s]" />
        <div className="absolute top-[10%] left-[40%] w-[2px] h-[2px] rounded-full bg-primary/30 animate-float-1 [animation-delay:3s]" />
        <div className="absolute top-[85%] right-[30%] w-[3px] h-[3px] rounded-full bg-accent/30 animate-float-3 [animation-delay:8s]" />
      </div>

      {/* HERO */}
      <section className="min-h-screen flex flex-col items-center justify-center relative z-10 px-5 py-10 text-center">
        <MouseGlow />
        <div ref={hero.ref} className={`transition-all duration-1000 ${hero.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="pulse-ring inline-block mb-10">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="#4CBDFA">
              <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
            </svg>
          </div>
          <h1 className="text-6xl sm:text-7xl font-black tracking-[6px] mb-4 gradient-text leading-tight">
            ODOSIAN
          </h1>
          <p className="text-xl text-text-secondary max-w-[520px] mb-12 leading-relaxed mx-auto">
            Your AI Shield Wall for Detection Engineering
          </p>
          <div className="flex gap-4 flex-wrap justify-center">
            <Link
              href="/register"
              className="group px-8 py-3.5 btn-primary-gradient text-bg font-bold text-[15px] rounded-lg flex items-center gap-2.5 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(76,189,250,0.35)] transition-all duration-300"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="group-hover:scale-110 transition-transform">
                <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
              </svg>
              Deploy Your Shield
            </Link>
            <Link
              href="/login"
              className="px-8 py-3.5 border border-primary/60 text-primary font-semibold text-[15px] rounded-lg hover:bg-primary/[0.08] hover:border-primary hover:-translate-y-1 transition-all duration-300"
            >
              Enter Command Center
            </Link>
          </div>
        </div>
        <div className="absolute bottom-8 text-text-muted text-xs tracking-[2px] animate-bounce">
          &darr; SCROLL &darr;
        </div>
      </section>

      {/* SHIELD DEMO */}
      <section className="py-20 px-5 max-w-[1100px] mx-auto relative z-10">
        <div ref={demo.ref} className="flex items-center gap-16 flex-wrap justify-center">
          <div className={`transition-all duration-700 ${demo.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
            <AnimatedGauge visible={demo.visible} />
          </div>
          <div className="flex-1 min-w-[280px] flex flex-col gap-4">
            {[
              { level: "danger", label: "⚠ FINDING", text: "Rule lacks process.parent.name check — vulnerable to renamed executables", delay: 0.3 },
              { level: "success", label: "✓ SUGGESTION", text: "Add file.hash correlation to reduce false positives by 60%", delay: 0.5 },
              { level: "severity-high", label: "⊘ EVASION RISK", text: "DLL side-loading can bypass this rule — likelihood: HIGH", delay: 0.7 },
            ].map((item) => (
              <div
                key={item.label}
                className={`bg-surface border border-border rounded-[10px] p-4 px-5 shimmer-hover transition-all duration-500 hover:border-border-focus/30 hover:-translate-x-1 ${
                  demo.visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
                }`}
                style={{ transitionDelay: `${item.delay}s` }}
              >
                <div className={`text-[11px] text-${item.level} font-semibold tracking-wider mb-1`}>{item.label}</div>
                <div className="text-sm text-text-secondary">{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 px-5 max-w-[1200px] mx-auto relative z-10">
        <div ref={features.ref} className={`text-center mb-14 transition-all duration-700 ${features.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <h2 className="text-4xl font-extrabold mb-3">The Shield Arsenal</h2>
          <p className="text-text-muted text-base">Six AI-powered defense capabilities</p>
        </div>
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children ${features.visible ? 'visible' : ''}`}>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group bg-surface border border-border rounded-[10px] p-7 card-hover-glow shimmer-hover relative overflow-hidden hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-lg bg-surface-light flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                {f.icon}
              </div>
              <div className="text-[17px] font-bold mb-2 text-text group-hover:text-primary transition-colors duration-300">{f.title}</div>
              <div className="text-sm text-text-secondary leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* STATS BAR */}
      <section className="py-16 px-5 relative z-10">
        <div
          ref={stats.ref}
          className={`max-w-[1100px] mx-auto bg-surface border border-border rounded-xl p-10 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center transition-all duration-700 ${
            stats.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {STATS.map((s, i) => (
            <div key={s.label} style={{ transitionDelay: `${i * 0.1}s` }}>
              <div className="text-4xl font-extrabold gradient-text-cyan">
                <AnimatedCounter value={s.value} suffix={s.suffix} />
              </div>
              <div className="text-xs text-text-muted mt-2 tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CODE SECTION */}
      <section className="py-16 px-5 max-w-[900px] mx-auto relative z-10">
        <div ref={code.ref} className={`transition-all duration-700 ${code.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <h3 className="text-2xl font-bold text-center mb-2">This is what a detection shield looks like</h3>
          <p className="text-center text-text-muted mb-7 text-sm">An EQL rule detecting suspicious PowerShell execution</p>
          <div className="bg-surface border border-border rounded-[10px] p-6 overflow-x-auto relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-danger/60" />
              <div className="w-3 h-3 rounded-full bg-warning/60" />
              <div className="w-3 h-3 rounded-full bg-success/60" />
              <span className="text-[10px] text-text-muted ml-2 tracking-wider font-mono">detection.eql</span>
            </div>
            <TypewriterCode lines={CODE_LINES} visible={code.visible} />
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="py-20 px-5 text-center relative z-10">
        <div ref={cta.ref} className={`transition-all duration-700 ${cta.visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'}`}>
          <h3 className="text-3xl font-extrabold mb-6">Ready to build your shield wall?</h3>
          <Link
            href="/register"
            className="inline-flex px-10 py-4 btn-primary-gradient text-bg font-bold text-base rounded-lg hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(76,189,250,0.3)] transition-all duration-300"
          >
            Get Started
          </Link>
          <div className="mt-10 text-text-muted text-xs tracking-wider">
            &copy; {new Date().getFullYear()} ODOSIAN &middot; SHIELD WALL ACTIVE
          </div>
        </div>
      </section>
    </div>
  );
}
