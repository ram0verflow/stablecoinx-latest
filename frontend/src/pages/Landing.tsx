import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IcCheck } from '../components/scx/icons';

const CHECK = <IcCheck className="" strokeWidth={2} />;

/** Scroll-reveal: fades + lifts every `.rv` into place once it enters the viewport.
 *  IntersectionObserver does not deliver entries while the document is hidden, so a
 *  page opened in a background tab would stay blank until the first scroll. A
 *  visibility-change sweep (plus a mount-time one) reveals anything already on screen. */
function useReveal() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = root.current;
    if (!host) return;

    const revealAll = () => host.querySelectorAll('.rv:not(.in)').forEach((el) => el.classList.add('in'));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      revealAll();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    /** Reveal anything already within the viewport, regardless of observer timing. */
    const sweep = () => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      host.querySelectorAll('.rv:not(.in)').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.94 && r.bottom > 0) {
          el.classList.add('in');
          io.unobserve(el);
        }
      });
    };

    host.querySelectorAll('.rv').forEach((el) => io.observe(el));

    /* Decorative background animations (sheen, drifting blobs, marquee) idle unless
       their section is actually on screen, so nothing composites off-screen. */
    const lit = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.target.classList.toggle('lit', e.isIntersecting)),
      { rootMargin: '10% 0px' }
    );
    host.querySelectorAll('[data-lit]').forEach((el) => lit.observe(el));

    const onVisible = () => { if (!document.hidden) sweep(); };
    document.addEventListener('visibilitychange', onVisible);
    const t = window.setTimeout(sweep, 600);

    return () => {
      io.disconnect();
      lit.disconnect();
      document.removeEventListener('visibilitychange', onVisible);
      window.clearTimeout(t);
    };
  }, []);
  return root;
}

/** Sticky-nav frosted state after the first scroll tick. */
function useStuck() {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return stuck;
}

const PIPELINE_TICKER = [
  { id: 'PAY-18841', entity: 'Halden Logistics · Hong Kong → UK', amount: '$212,500.00', status: 'Approved', color: '#02641E' },
  { id: 'PAY-18843', entity: 'Northstar Holdings · UK → UAE', amount: '$150,000.00', status: 'Needs Review', color: '#8A6D00' },
  { id: 'PAY-18844', entity: 'Meridian Corp · UK → Singapore', amount: '$45,000.00', status: 'Blocked', color: '#B3261E' },
];

const FEATURES = [
  { title: 'Decision Trace built in', desc: 'Every payment carries its full reasoning — identity, compliance, treasury, routing and authorization — grouped and inspectable, not buried in logs.', icon: (
    <svg viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M6 8h8M6 12h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
  ) },
  { title: 'Real-time corridor intelligence', desc: 'See money movement, policy cascades and revalidation propagate across corridors the moment a rule changes — not after the next audit.', icon: (
    <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" /><path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
  ) },
  { title: 'Audit-ready from day one', desc: 'Authorization, settlement, confirmation and proof registration are recorded as a clean, independently verifiable lifecycle for every transfer.', icon: (
    <svg viewBox="0 0 20 20" fill="none"><path d="M5 3h7l3 3v11a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" /><path d="M7 10h6M7 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
  ) },
];

const CORRIDORS = ['United Kingdom', 'United Arab Emirates', 'Singapore', 'Hong Kong', 'Norway', 'United States', 'European Union'];

const TESTIMONIALS = [
  { quote: 'Preflight alone changed how our treasury team ships payments — we know the approval path before we submit.', name: 'Maya Holt', initials: 'MH', role: 'Head of Treasury, Aurelia Capital' },
  { quote: 'The Decision Trace is what got compliance to sign off. Every check is grouped, evidenced and timestamped.', name: 'Jonas Ekberg', initials: 'JO', role: 'Compliance Lead, Nordvik Group' },
  { quote: 'Revalidation cascades saved us from a manual re-review of hundreds of historical payments after one policy change.', name: 'Riya Anand', initials: 'RA', role: 'Controller, Zenith Trading' },
  { quote: 'Our auditors can verify settlement finality themselves through the public proof page. No back-and-forth.', name: 'Tom Bryce', initials: 'TB', role: 'Finance Director, Harrow Group' },
];

const STATS = [
  { n: '$2.4B', l: 'Settled to date' },
  { n: '180+', l: 'Active corridors' },
  { n: '99.98%', l: 'Platform uptime' },
  { n: '<10s', l: 'Median settlement time' },
];

const FAQS = [
  { q: 'Do we need to be a registered institution to use CertaPay?', a: 'Yes — CertaPay is built for registered businesses and financial institutions moving funds on behalf of an entity, with full KYB verification at onboarding.' },
  { q: 'How long do settlements take?', a: "Most stablecoin settlements confirm on-chain in under 10 seconds once authorization clears. Fiat-adjacent legs depend on the receiving corridor's banking hours." },
  { q: 'What triggers a revalidation?', a: 'A policy version change, a treasury limit update, or refreshed compliance evidence on an existing counterparty can trigger revalidation of historical payments in the affected corridor.' },
  { q: 'Can auditors verify settlements independently?', a: 'Yes — every settled payment has a public proof page showing authorization, settlement, confirmation and proof registration, without exposing internal risk or compliance data.' },
  { q: 'How are approval thresholds configured?', a: 'Treasury and Admin roles configure dual-approval thresholds per corridor or globally in Settings → Approval Controls; changes apply to new payments immediately.' },
];

const d = (ms: number) => ({ ['--d' as string]: `${ms}ms` } as React.CSSProperties);

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const root = useReveal();
  const stuck = useStuck();

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="scx landing" ref={root}>
      {/* Nav */}
      <div className={`mnav${stuck ? ' stuck' : ''}`}>
        <div className="mnav-l">
          <div className="mbrand"><div className="mark" /><div className="word">CERTAPAY</div></div>
          <div className="mnav-links">
            <a href="#preflight" onClick={(e) => { e.preventDefault(); scrollTo('preflight'); }}>Product</a>
            <a href="#coverage" onClick={(e) => { e.preventDefault(); scrollTo('coverage'); }}>Payments</a>
            <a href="#built-in" onClick={(e) => { e.preventDefault(); scrollTo('built-in'); }}>Platform</a>
            <a href="#faq" onClick={(e) => { e.preventDefault(); scrollTo('faq'); }}>Docs</a>
          </div>
        </div>
        <div className="mnav-r">
          <button className="mbtn mbtn-ghost" onClick={() => navigate('/login')}>Sign In</button>
          <button className="mbtn mbtn-brand" onClick={() => navigate('/login')}>Request Access</button>
          <button
            className={`mburger${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            <span />
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      <div className={`msheet${menuOpen ? ' open' : ''}`}>
        <a href="#preflight" onClick={(e) => { e.preventDefault(); scrollTo('preflight'); }}>Product</a>
        <a href="#coverage" onClick={(e) => { e.preventDefault(); scrollTo('coverage'); }}>Payments</a>
        <a href="#built-in" onClick={(e) => { e.preventDefault(); scrollTo('built-in'); }}>Platform</a>
        <a href="#faq" onClick={(e) => { e.preventDefault(); scrollTo('faq'); }}>Docs</a>
        <button className="mbtn mbtn-brand" onClick={() => navigate('/login')}>Sign In</button>
      </div>

      {/* Hero */}
      <div className="mhero" data-lit>
        <span className="meyebrow rv rv-sm">Institutional stablecoin infrastructure</span>
        <h1 className="mh1 rv" style={d(80)}>Move money globally with <em>policy built in</em>, not bolted on</h1>
        <div className="mhsub rv" style={d(160)}>Cross-border stablecoin settlement with treasury controls, compliance evidence and dual authorization on every payment — provable end to end.</div>
        <div className="mhero-ctas rv" style={d(240)}>
          <button className="mbtn mbtn-brand mbtn-lg" onClick={() => navigate('/login')}>Request Access</button>
          <button className="mbtn mbtn-lg" onClick={() => scrollTo('preflight')}>Book a demo</button>
        </div>
        <div className="mbadges rv" style={d(320)}>
          {['SOC 2 Type II', 'Dual-Approval Controls', 'Audit-Grade Proof', '24/7 Settlement'].map((b) => (
            <div className="mbadge" key={b}>{CHECK}{b}</div>
          ))}
        </div>

        <div className="heromock rv rv-lg" style={d(380)}>
          <div className="hm-bar"><span className="hm-dot" /><span className="hm-dot" /><span className="hm-dot" /></div>
          <div className="hm-body">
            <div className="hm-stats">
              <div className="hm-stat"><div className="l">Money in motion</div><div className="v num">$412,500.00</div></div>
              <div className="hm-stat"><div className="l">Awaiting approval</div><div className="v num">$150,000</div></div>
              <div className="hm-stat"><div className="l">Settled today</div><div className="v num">$1.84M</div></div>
            </div>
            <div className="hm-table">
              {PIPELINE_TICKER.map((p) => (
                <div className="hm-row" key={p.id}>
                  <span className="id">{p.id}</span>
                  <span className="cp">{p.entity}</span>
                  <span className="amt num">{p.amount}</span>
                  <span className="st" style={{ color: p.color }}><span className="d" style={{ background: 'currentColor' }} />{p.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Preflight */}
      <div className="msection t-navy" id="preflight">
        <div className="msrow">
          <div>
            <div className="mstag rv rv-sm">Preflight</div>
            <h2 className="mstitle rv" style={d(60)}>Know what you'll get <em>before</em> you move money</h2>
            <div className="msbody rv" style={d(120)}>Every payment is evaluated against corridor policy, treasury limits and compliance availability before it's created — not after. No surprises at settlement.</div>
            <div className="mslist">
              {['Corridor policy checked in real time', 'Approval requirement shown up front', 'Route and fee locked before submission'].map((t, i) => (
                <div className="mslist-item rv rv-sm" style={d(180 + i * 70)} key={t}>{CHECK}{t}</div>
              ))}
            </div>
          </div>
          <div className="msvisual rv rv-lg" style={d(140)}>
            <div className="mvcard">
              <div className="row"><span className="l">Corridor policy</span><span className="v ok">Allowed</span></div>
              <div className="row"><span className="l">Treasury limits</span><span className="v ok">Within cap</span></div>
              <div className="row"><span className="l">Compliance</span><span className="v ok">Available</span></div>
              <div className="row"><span className="l">Approval requirement</span><span className="v warn">2 approvals</span></div>
              <div className="row"><span className="l">Recommended rail</span><span className="v">Base</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Treasury */}
      <div className="msection tight t-ink">
        <div className="msrow rev">
          <div>
            <div className="mstag rv rv-sm">Treasury</div>
            <h2 className="mstitle rv" style={d(60)}>Treasury <em>infrastructure</em>, not a wallet</h2>
            <div className="msbody rv" style={d(120)}>Multi-entity corridors, daily limits and dual-approval thresholds enforced automatically — the controls your treasury team already runs, built into every transfer.</div>
            <div className="mslist">
              {['Per-corridor and per-entity limits', 'Configurable dual-approval thresholds', 'Role-based access for treasury, compliance and audit'].map((t, i) => (
                <div className="mslist-item rv rv-sm" style={d(180 + i * 70)} key={t}>{CHECK}{t}</div>
              ))}
            </div>
          </div>
          <div className="msvisual rv rv-lg" style={d(140)}>
            <div className="mvcard">
              <div className="row"><span className="l">Daily treasury cap</span><span className="v">$5,000,000</span></div>
              <div className="row"><span className="l">Used today</span><span className="v">$2,100,000</span></div>
              <div className="row"><span className="l">Dual-approval threshold</span><span className="v">&gt;$100,000</span></div>
              <div className="row"><span className="l">Active corridors</span><span className="v">6</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Settlement */}
      <div className="msection t-green">
        <div className="msrow">
          <div>
            <div className="mstag rv rv-sm">Settlement</div>
            <h2 className="mstitle rv" style={d(60)}>Global rails, <em>deterministic</em> settlement</h2>
            <div className="msbody rv" style={d(120)}>Stablecoin settlement with automated compliance and transparent, policy-driven decisions — every outcome traceable to the rule that produced it.</div>
          </div>
          <div className="msvisual rv rv-lg" style={d(140)}>
            <div className="mvcard">
              <div className="row"><span className="l">AI advisory</span><span className="v">Approve</span></div>
              <div className="row"><span className="l">Deterministic policy</span><span className="v bad">BLOCK</span></div>
              <div className="row"><span className="l">Execution</span><span className="v bad">Prevented</span></div>
              <div className="row"><span className="l">Authority</span><span className="v">Policy has final say</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Built in, not bolted on */}
      <div className="mfeatures" id="built-in">
        <div className="mfeatures-inner">
          <div className="mfhead">
            <div className="mstag rv rv-sm">Built in, not bolted on</div>
            <h2 className="mstitle rv" style={d(60)}>Everything an institutional payment needs</h2>
          </div>
          <div className="mfgrid">
            {FEATURES.map((f, i) => (
              <div className="mfcard rv rv-lg" style={d(i * 110)} key={f.title}>
                <div className="mficon">{f.icon}</div>
                <div className="mftitle">{f.title}</div>
                <div className="mfdesc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Coverage */}
      <div className="mcorridors" id="coverage">
        <div className="mstag rv rv-sm">Coverage</div>
        <h2 className="mstitle rv" style={d(60)}>Live corridors, growing weekly</h2>
        <div className="msbody rv" style={d(120)}>Virtual settlement accounts and compliant stablecoin rails across the corridors institutional treasury teams move money through most.</div>
        <div className="mcgrid">
          {CORRIDORS.map((c, i) => <div className="mctag rv rv-sm" style={d(160 + i * 55)} key={c}>{c}</div>)}
        </div>
      </div>

      {/* Testimonials — marquee */}
      <div className="mtesti">
        <div className="mthead">
          <div className="mstag rv rv-sm">Trusted by treasury teams</div>
          <h2 className="mstitle rv" style={d(60)}>Built for the people who sign off on money movement</h2>
        </div>
        <div className="mtmask rv" style={d(120)}>
          <div className="mtmarquee">
            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
              <div className="mtcard" key={`${t.name}-${i}`}>
                <div className="mtquote">&ldquo;{t.quote}&rdquo;</div>
                <div className="mtperson">
                  <div className="mtav">{t.initials}</div>
                  <div><div className="mtname">{t.name}</div><div className="mtrole">{t.role}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats — dark panel */}
      <div className="mstatsbar">
        <div className="msb-inner" data-lit>
          <div className="msb-tag rv rv-sm">CertaPay by the numbers</div>
          <div className="msbgrid">
            {STATS.map((s, i) => (
              <div className="msbitem rv rv-lg" style={d(i * 90)} key={s.l}>
                <div className="n num">{s.n}</div>
                <div className="l">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="mfaq" id="faq">
        <div className="mfq-head">
          <div className="mstag rv rv-sm">FAQ</div>
          <h2 className="mstitle rv" style={d(60)}>Questions treasury and compliance teams ask</h2>
        </div>
        {FAQS.map((f, i) => {
          const isOpen = openFaq === i;
          return (
            <div className="mfitem rv rv-sm" style={d(i * 60)} key={f.q}>
              <button className={`mfq-row${isOpen ? ' open' : ''}`} onClick={() => setOpenFaq(isOpen ? null : i)} aria-expanded={isOpen}>
                <span>{f.q}</span>
                <span className="mfq-ic"><svg viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              </button>
              <div className={`mfq-wrap${isOpen ? ' open' : ''}`}>
                <div className="mfq-a"><div>{f.a}</div></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Final CTA */}
      <div className="mfinalcta">
        <div className="mfc-inner" data-lit>
          <div className="mstag rv rv-sm">Get started</div>
          <h2 className="mstitle rv" style={d(60)}>Ready to move money with policy built in?</h2>
          <div className="msbody rv" style={d(120)}>Join the treasury and compliance teams settling cross-border payments with evidence, not spreadsheets.</div>
          <div className="mhero-ctas rv" style={d(180)}>
            <button className="mbtn mbtn-gold mbtn-lg" onClick={() => navigate('/login')}>Request Access</button>
            <button className="mbtn mbtn-lg" onClick={() => navigate('/login')}>Book a demo</button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mfooter">
        <div className="mfgrid2">
          <div className="mfcol">
            <div className="mbrand"><div className="mark" /><div className="word">CERTAPAY</div></div>
            <div style={{ fontSize: 14.5, color: 'var(--dx-muted)', marginTop: 18, maxWidth: 280, lineHeight: 1.5 }}>Institutional-grade stablecoin settlement with treasury controls and audit-grade proof.</div>
          </div>
          <div className="mfcol"><div className="ft">Compare</div><a href="#">CertaPay vs Wire Transfer</a><a href="#">CertaPay vs Generic Rails</a><a href="#">CertaPay vs Legacy Treasury</a></div>
          <div className="mfcol"><div className="ft">Product</div><a href="#">For Treasury Teams</a><a href="#">For Compliance</a><a href="#">Docs</a><a href="#">Media Kit</a></div>
          <div className="mfcol"><div className="ft">Company</div><a href="#">Contact</a><a href="#">Terms of Service</a><a href="#">Privacy Policy</a></div>
        </div>
        <div className="mfbottom"><span>© CertaPay 2026</span><span>SOC 2 Type II · Built for institutional treasury</span></div>
      </div>
    </div>
  );
};
