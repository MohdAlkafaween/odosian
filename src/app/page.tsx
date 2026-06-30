import Link from "next/link";

const FEATURES = [
  {
    icon: "🛡️",
    title: "Shield Strength Scoring",
    desc: "AI analyzes every detection rule and scores its defensive coverage, false-positive rate, and evasion resilience.",
  },
  {
    icon: "🎯",
    title: "MITRE ATT&CK Mapping",
    desc: "Automatically map rules to tactics, techniques, and sub-techniques with confidence scoring.",
  },
  {
    icon: "⚔️",
    title: "Evasion Risk Detection",
    desc: "Identify blind spots and evasion techniques attackers could use to bypass your detection rules.",
  },
  {
    icon: "📋",
    title: "Rule Templates",
    desc: "Start from battle-tested templates for common threat scenarios and customize to your environment.",
  },
  {
    icon: "⚙️",
    title: "Custom Scoring Fields",
    desc: "Define custom fields, scoring criteria, and quality gates tailored to your organization.",
  },
  {
    icon: "🔗",
    title: "Webhook Integration",
    desc: "Push events to external systems with HMAC-signed webhooks for rule changes and analyses.",
  },
];

const STATS = [
  { value: "6", label: "AI ANALYSIS ENGINES" },
  { value: "4", label: "RULE LANGUAGES" },
  { value: "200+", label: "MITRE TECHNIQUES" },
  { value: "∞", label: "RULES ANALYZED" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen relative bg-bg hex-bg overflow-hidden">
      {/* Attack particles */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[15%] right-[8%] w-1 h-1 rounded-full bg-danger animate-float-1" />
        <div className="absolute top-[55%] right-[3%] w-[3px] h-[3px] rounded-full bg-severity-high animate-float-2" />
        <div className="absolute top-[30%] left-[5%] w-[3px] h-[3px] rounded-full bg-danger animate-float-3" />
        <div className="absolute top-[70%] right-[12%] w-1 h-1 rounded-full bg-severity-high animate-float-4" />
        <div className="absolute top-[45%] left-[10%] w-[3px] h-[3px] rounded-full bg-danger animate-float-1 [animation-delay:5s]" />
        <div className="absolute top-[80%] left-[15%] w-[2px] h-[2px] rounded-full bg-severity-high animate-float-2 [animation-delay:4s]" />
        <div className="absolute top-[20%] right-[20%] w-[3px] h-[3px] rounded-full bg-danger animate-float-3 [animation-delay:6s]" />
        <div className="absolute top-[60%] left-[25%] w-[2px] h-[2px] rounded-full bg-warning animate-float-4 [animation-delay:7s]" />
      </div>

      {/* HERO */}
      <section className="min-h-screen flex flex-col items-center justify-center relative z-10 px-5 py-10 text-center">
        {/* Shield emblem */}
        <div className="animate-pulse-cyan rounded-full p-2 mb-10">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="#4CBDFA">
            <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
          </svg>
        </div>
        <h1 className="text-6xl sm:text-7xl font-black tracking-[6px] mb-4 gradient-text leading-tight">
          ODOSIAN
        </h1>
        <p className="text-xl text-text-secondary max-w-[520px] mb-12 leading-relaxed">
          Your AI Shield Wall for Detection Engineering
        </p>
        <div className="flex gap-4 flex-wrap justify-center">
          <Link
            href="/register"
            className="px-8 py-3.5 btn-primary-gradient text-bg font-bold text-[15px] rounded-lg flex items-center gap-2.5 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(76,189,250,0.3)] transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
            </svg>
            Deploy Your Shield
          </Link>
          <Link
            href="/login"
            className="px-8 py-3.5 border border-primary text-primary font-semibold text-[15px] rounded-lg hover:bg-primary/[0.08] hover:-translate-y-0.5 transition-all"
          >
            Enter Command Center
          </Link>
        </div>
        <div className="absolute bottom-8 text-text-muted text-xs tracking-[2px] animate-fade-in-up">
          &darr; SCROLL &darr;
        </div>
      </section>

      {/* SHIELD DEMO */}
      <section className="py-20 px-5 max-w-[1100px] mx-auto relative z-10">
        <div className="flex items-center gap-16 flex-wrap justify-center">
          {/* Demo gauge */}
          <div className="animate-pulse-cyan rounded-full">
            <svg width="200" height="200" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="85" fill="none" stroke="#1E2D3D" strokeWidth="6" />
              <circle
                cx="100" cy="100" r="85" fill="none" stroke="#4CBDFA" strokeWidth="6"
                strokeLinecap="round" strokeDasharray="534" strokeDashoffset="134"
                transform="rotate(-90 100 100)" className="animate-forge-glow"
              />
              <text x="100" y="92" textAnchor="middle" fill="white" fontSize="48" fontWeight="800">75</text>
              <text x="100" y="116" textAnchor="middle" fill="#64748B" fontSize="12" letterSpacing="2">SHIELD SCORE</text>
            </svg>
          </div>
          {/* Findings */}
          <div className="flex-1 min-w-[280px] flex flex-col gap-4">
            <div className="bg-surface border border-border rounded-[10px] p-4 px-5 animate-fade-in-up">
              <div className="text-[11px] text-danger font-semibold tracking-wider mb-1">&#9888; FINDING</div>
              <div className="text-sm text-text-secondary">Rule lacks process.parent.name check — vulnerable to renamed executables</div>
            </div>
            <div className="bg-surface border border-border rounded-[10px] p-4 px-5 animate-fade-in-up [animation-delay:0.15s]">
              <div className="text-[11px] text-success font-semibold tracking-wider mb-1">&#10003; SUGGESTION</div>
              <div className="text-sm text-text-secondary">Add file.hash correlation to reduce false positives by 60%</div>
            </div>
            <div className="bg-surface border border-border rounded-[10px] p-4 px-5 animate-fade-in-up [animation-delay:0.3s]">
              <div className="text-[11px] text-severity-high font-semibold tracking-wider mb-1">&#8856; EVASION RISK</div>
              <div className="text-sm text-text-secondary">DLL side-loading can bypass this rule — likelihood: HIGH</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 px-5 max-w-[1200px] mx-auto relative z-10">
        <h2 className="text-4xl font-extrabold text-center mb-3">The Shield Arsenal</h2>
        <p className="text-center text-text-muted mb-14 text-base">Six AI-powered defense capabilities</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-surface border border-border rounded-[10px] p-7 card-hover-glow relative overflow-hidden hover:-translate-y-0.5"
            >
              <div className="text-3xl mb-3.5">{f.icon}</div>
              <div className="text-[17px] font-bold mb-2 text-primary">{f.title}</div>
              <div className="text-sm text-text-secondary leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* STATS BAR */}
      <section className="py-16 px-5 relative z-10">
        <div className="max-w-[1100px] mx-auto bg-surface border border-border rounded-xl p-10 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {STATS.map((s) => (
            <div key={s.label} className="animate-count-up">
              <div className="text-4xl font-extrabold gradient-text-cyan">{s.value}</div>
              <div className="text-xs text-text-muted mt-2 tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CODE SECTION */}
      <section className="py-16 px-5 max-w-[900px] mx-auto relative z-10">
        <h3 className="text-2xl font-bold text-center mb-2">This is what a detection shield looks like</h3>
        <p className="text-center text-text-muted mb-7 text-sm">An EQL rule detecting suspicious PowerShell execution</p>
        <div className="bg-surface border border-border rounded-[10px] p-6 font-mono text-sm leading-loose text-text-secondary overflow-x-auto">
          <div><span className="text-primary">process where</span> event.type == <span className="text-success">&quot;start&quot;</span></div>
          <div className="pl-4"><span className="text-primary">and</span> process.name : (<span className="text-success">&quot;powershell.exe&quot;</span>, <span className="text-success">&quot;pwsh.exe&quot;</span>)</div>
          <div className="pl-4"><span className="text-primary">and</span> process.args : (<span className="text-success">&quot;-enc*&quot;</span>, <span className="text-success">&quot;-e *&quot;</span>, <span className="text-success">&quot;*bypass*&quot;</span>)</div>
          <div className="pl-4"><span className="text-primary">and not</span> process.parent.name : (<span className="text-success">&quot;explorer.exe&quot;</span>,</div>
          <div className="pl-20"><span className="text-success">&quot;svchost.exe&quot;</span>)</div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="py-20 px-5 text-center relative z-10">
        <h3 className="text-3xl font-extrabold mb-6">Ready to build your shield wall?</h3>
        <Link
          href="/register"
          className="inline-flex px-10 py-4 btn-primary-gradient text-bg font-bold text-base rounded-lg hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(76,189,250,0.3)] transition-all"
        >
          Get Started
        </Link>
        <div className="mt-10 text-text-muted text-xs tracking-wider">
          &copy; {new Date().getFullYear()} ODOSIAN &middot; SHIELD WALL ACTIVE
        </div>
      </section>
    </div>
  );
}
