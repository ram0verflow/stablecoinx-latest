import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Brain,
  Lock,
  Link as LinkIcon,
  ArrowRight,
  CheckCircle2,
  Globe,
  Wallet,
  Scale,
  Eye,
  FileText,
  Layers,
  Zap,
  Network
} from 'lucide-react';

declare global {
  interface Window {
    THREE: any;
  }
}

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const globeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!globeRef.current || !window.THREE) return;

    const THREE = window.THREE;
    const width = globeRef.current.clientWidth;
    const height = globeRef.current.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    globeRef.current.appendChild(renderer.domElement);

    // Globe — solid brand blue to match the new enterprise palette
    const BRAND_BLUE = 0x2563eb;
    const geometry = new THREE.SphereGeometry(2, 32, 32);
    const material = new THREE.MeshPhongMaterial({
      color: BRAND_BLUE,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    // Dots/Points on globe
    const pointsGeometry = new THREE.SphereGeometry(2.05, 32, 32);
    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.05,
      color: BRAND_BLUE,
    });
    const points = new THREE.Points(pointsGeometry, pointsMaterial);
    scene.add(points);

    // Arcs (Transaction lines)
    const createArc = (startLat: number, startLon: number, endLat: number, endLon: number) => {
      const curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(2 * Math.cos(startLat) * Math.cos(startLon), 2 * Math.sin(startLat), 2 * Math.cos(startLat) * Math.sin(startLon)),
        new THREE.Vector3(3 * Math.cos((startLat+endLat)/2) * Math.cos((startLon+endLon)/2), 3 * Math.sin((startLat+endLat)/2), 3 * Math.cos((startLat+endLat)/2) * Math.sin((startLon+endLon)/2)),
        new THREE.Vector3(3 * Math.cos((startLat+endLat)/2) * Math.cos((startLon+endLon)/2), 3 * Math.sin((startLat+endLat)/2), 3 * Math.cos((startLat+endLat)/2) * Math.sin((startLon+endLon)/2)),
        new THREE.Vector3(2 * Math.cos(endLat) * Math.cos(endLon), 2 * Math.sin(endLat), 2 * Math.cos(endLat) * Math.sin(endLon))
      );
      const points = curve.getPoints(50);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: BRAND_BLUE, transparent: true, opacity: 0.6 });
      return new THREE.Line(geometry, material);
    };

    const arcs: any[] = [];
    for(let i=0; i<5; i++) {
        const arc = createArc(Math.random()*Math.PI, Math.random()*Math.PI*2, Math.random()*Math.PI, Math.random()*Math.PI*2);
        scene.add(arc);
        arcs.push(arc);
    }

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 5, 5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040));

    camera.position.z = 5;

    const animate = () => {
      requestAnimationFrame(animate);
      globe.rotation.y += 0.002;
      points.rotation.y += 0.002;
      arcs.forEach(a => {
          a.rotation.y += 0.002;
          a.material.opacity = 0.3 + Math.sin(Date.now() * 0.002) * 0.3;
      });
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      const w = globeRef.current?.clientWidth || width;
      const h = globeRef.current?.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      globeRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  const pipelineStages = [
    { id: 1, name: 'Payment Intent', desc: 'Capture sender, receiver, corridor, token, urgency', icon: FileText },
    { id: 2, name: 'Country Policy', desc: 'Legal corridors, KYC rules, sanctions corridors', icon: Globe },
    { id: 3, name: 'Treasury Controls', desc: 'Daily limits, vendor approval, budget checks', icon: Wallet },
    { id: 4, name: 'Compliance Engine', desc: 'KYC/KYB verification, sanctions screening', icon: Scale },
    { id: 5, name: 'Graph Intelligence', desc: 'Neo4j wallet relationship analysis', icon: Network },
    { id: 6, name: 'Issuer Risk', desc: 'Stablecoin freeze risk, depeg risk, liquidity depth', icon: Zap },
    { id: 7, name: 'Chain Governance', desc: 'Bridge trust, gas, finality, regulator comfort', icon: LinkIcon },
    { id: 8, name: 'Liquidity Engine', desc: 'Optimal route, slippage, cost, ETA', icon: Zap },
    { id: 9, name: 'AI Decision', desc: 'Advisory routing recommendation, never final', icon: Brain },
    { id: 10, name: 'Policy Veto', desc: 'Deterministic override. AI cannot bypass this.', icon: Shield, special: true },
    { id: 11, name: 'FHE Checks', desc: 'Simulated private threshold checks without revealing amounts', icon: Lock },
    { id: 12, name: 'ZK Proofs', desc: 'Simulated compliance commitment proofs', icon: Shield },
    { id: 13, name: 'Human Approval', desc: 'Role-gated approval for flagged transactions', icon: CheckCircle2 },
    { id: 14, name: 'On-Chain Settlement', desc: 'Token transfer + immutable proof registry', icon: Network },
  ];

  return (
    <div className="min-h-screen bg-surface-base text-ink-900 font-inter">
      {/* SECTION 1: HERO — dark navy band */}
      <section className="relative bg-navy-950 overflow-hidden">
        <div className="container mx-auto px-6 py-24 lg:py-32 grid lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Globe Container */}
          <div className="relative order-2 lg:order-1 flex justify-center items-center h-[420px]">
             <div ref={globeRef} className="w-full h-full max-w-[420px] max-h-[420px]" />

             {/* Floating Badges */}
             <div className="absolute top-6 left-0 bg-navy-900 border border-navy-700 rounded-lg px-4 py-2 flex items-center gap-2 animate-float">
                <Layers className="w-4 h-4 text-brand-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-navy-200">Multi-Stage Pipeline</span>
             </div>
             <div className="absolute bottom-16 right-0 bg-navy-900 border border-navy-700 rounded-lg px-4 py-2 flex items-center gap-2 animate-float" style={{ animationDelay: '1s' }}>
                <Brain className="w-4 h-4 text-brand-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-navy-200">AI + Policy Veto</span>
             </div>
             <div className="absolute top-16 right-4 bg-navy-900 border border-navy-700 rounded-lg px-4 py-2 flex items-center gap-2 animate-float" style={{ animationDelay: '2s' }}>
                <Shield className="w-4 h-4 text-status-pass" />
                <span className="text-xs font-bold uppercase tracking-wider text-navy-200">Simulated ZK Proof</span>
             </div>
             <div className="absolute bottom-6 left-4 bg-navy-900 border border-navy-700 rounded-lg px-4 py-2 flex items-center gap-2 animate-float" style={{ animationDelay: '0.5s' }}>
                <Lock className="w-4 h-4 text-brand-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-navy-200">Simulated FHE</span>
             </div>
          </div>

          {/* Hero Content */}
          <div className="order-1 lg:order-2 space-y-8">
            <div className="space-y-4">
              <span className="text-brand-primary font-bold tracking-[0.2em] uppercase text-xs">
                Compliance-Aware Settlement Infrastructure
              </span>
              <h1 className="text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-white">
                Intelligent Stablecoin<br />
                Settlement.
              </h1>
              <p className="text-navy-200 text-xl max-w-lg leading-relaxed">
                A deterministic compliance pipeline with AI-assisted routing,
                policy-enforced finality, and on-chain proof of every decision.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => navigate('/login')}
                className="btn-primary px-8 py-4 text-base"
              >
                Get Started
              </button>
              <button
                onClick={() => document.getElementById('pipeline')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-4 bg-transparent border border-navy-600 hover:border-brand-primary text-white hover:bg-navy-900 font-bold rounded-lg transition-all"
              >
                View Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: PIPELINE */}
      <section id="pipeline" className="py-24 bg-surface-base">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mb-16 space-y-4">
             <h2 className="text-4xl font-bold text-ink-900">Every Payment. Every Rule. <span className="text-brand-primary">Zero Exceptions.</span></h2>
             <p className="text-ink-600 text-lg">
                Our multi-stage settlement control pipeline processes every payment through deterministic
                compliance checks before a single token moves.
             </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             {pipelineStages.map((stage) => {
               const Icon = stage.icon;
               return (
                 <div
                  key={stage.id}
                  className={`glass-card-hover p-6 ${stage.special ? 'ring-1 ring-status-review/40 bg-status-review/[0.03]' : ''}`}
                 >
                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center mb-4 ${stage.special ? 'bg-status-review/10 text-status-review' : 'bg-surface-elevated text-ink-600'}`}>
                       <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                       <span className="text-[10px] font-bold text-ink-400 bg-surface-elevated px-1.5 py-0.5 rounded uppercase">{String(stage.id).padStart(2, '0')}</span>
                       <h3 className="font-bold text-ink-900 tracking-tight">{stage.name}</h3>
                    </div>
                    <p className="text-ink-600 text-sm leading-relaxed">{stage.desc}</p>
                 </div>
               );
             })}
          </div>
        </div>
      </section>

      {/* SECTION 3: FEATURES */}
      <section className="py-24 bg-surface-elevated border-y border-surface-border">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
             <h2 className="text-4xl font-bold text-ink-900">Deterministic Control. AI Advisory.</h2>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
             <div className="glass-card-hover p-10">
                <div className="w-14 h-14 rounded-xl bg-brand-primary/10 flex items-center justify-center mb-8">
                   <Brain className="w-7 h-7 text-brand-primary" />
                </div>
                <h3 className="text-2xl font-bold text-ink-900 mb-4">AI Advisory. Policy Enforced.</h3>
                <p className="text-ink-600 leading-relaxed text-lg">
                  The AI engine recommends a route. Deterministic policy has the last word.
                  No AI output can approve a sanctioned payment.
                </p>
             </div>

             <div className="glass-card-hover p-10">
                <div className="w-14 h-14 rounded-xl bg-brand-primary/10 flex items-center justify-center mb-8">
                   <Lock className="w-7 h-7 text-brand-primary" />
                </div>
                <h3 className="text-2xl font-bold text-ink-900 mb-4">Simulated FHE + ZK Layer</h3>
                <p className="text-ink-600 leading-relaxed text-lg">
                   Amount threshold checks run against encrypted values in a labeled simulation.
                   Proof commitments verify compliance without revealing sensitive data.
                </p>
             </div>

             <div className="glass-card-hover p-10">
                <div className="w-14 h-14 rounded-xl bg-brand-primary/10 flex items-center justify-center mb-8">
                   <LinkIcon className="w-7 h-7 text-brand-primary" />
                </div>
                <h3 className="text-2xl font-bold text-ink-900 mb-4">Immutable On-Chain Evidence</h3>
                <p className="text-ink-600 leading-relaxed text-lg">
                   Every settlement writes a proof to Base Sepolia.
                   Every decision is logged, auditable, and downloadable as PDF.
                </p>
             </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: CORRIDORS */}
      <section className="py-24 bg-surface-base overflow-hidden relative">
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-2xl mb-16 space-y-4">
             <h2 className="text-4xl font-bold tracking-tight text-ink-900">Global Corridors. <span className="text-brand-primary">Local Rules.</span></h2>
             <p className="text-ink-600 text-lg">
                Policy rules enforced per corridor. Some blocked. Some require KYC. None bypassed.
             </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
             <div className="space-y-4">
                {[
                  { from: 'Singapore', to: 'UAE', status: 'allowed' },
                  { from: 'Singapore', to: 'USA', status: 'allowed' },
                  { from: 'UK', to: 'UAE', status: 'allowed' },
                  { from: 'USA', to: 'Iran', status: 'blocked' },
                  { from: 'Singapore', to: 'Russia', status: 'blocked' },
                ].map((c, i) => (
                  <div key={i} className="glass-card p-4 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <span className="text-ink-900 font-bold">{c.from}</span>
                        <ArrowRight className="w-4 h-4 text-ink-400" />
                        <span className="text-ink-900 font-bold">{c.to}</span>
                     </div>
                     <span className={`badge ${c.status === 'allowed' ? 'badge-pass' : 'badge-blocked'}`}>
                        {c.status}
                     </span>
                  </div>
                ))}
             </div>

             <div className="relative">
                <div className="aspect-square glass-card rounded-full flex items-center justify-center p-8">
                   <div className="w-full h-full rounded-full border border-surface-border relative overflow-hidden">
                      {/* Abstract map lines */}
                      <div className="absolute inset-0 opacity-30" style={{
                        backgroundImage: 'radial-gradient(circle at 100px 100px, rgba(37,99,235,0.15) 1px, transparent 0)',
                        backgroundSize: '30px 30px',
                      }} />
                      {/* Animated arcs */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
                         <path d="M 20 50 Q 50 10 80 50" fill="none" stroke="#2563eb" strokeWidth="0.5" strokeDasharray="1 2" className="animate-dash" />
                         <path d="M 30 70 Q 50 30 70 70" fill="none" stroke="#2563eb" strokeWidth="0.5" strokeDasharray="1 2" className="animate-dash" style={{ animationDelay: '1s' }} />
                         <path d="M 10 30 Q 50 0 90 30" fill="none" stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1 2" className="animate-dash" style={{ animationDelay: '2s' }} />
                      </svg>
                      {/* Points */}
                      <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-brand-primary rounded-full" />
                      <div className="absolute bottom-1/3 right-1/4 w-2 h-2 bg-brand-primary rounded-full" />
                      <div className="absolute top-1/2 right-1/2 w-2 h-2 bg-status-blocked rounded-full" />
                   </div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: ROLES */}
      <section className="py-24 bg-surface-elevated border-y border-surface-border">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-2xl mx-auto mb-16 space-y-4">
             <h2 className="text-4xl font-bold tracking-tight text-ink-900">Built for Every Stakeholder</h2>
             <p className="text-ink-600 text-lg">
                Five roles. Each with a purpose-built dashboard.
             </p>
          </div>

          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
             {[
               { role: 'Admin', icon: Shield, desc: 'Full system control. Policy management. User oversight.' },
               { role: 'Treasury Officer', icon: Wallet, desc: 'Create payments. Approve settlements. Monitor wallet balances.' },
               { role: 'Compliance Officer', icon: Scale, desc: 'Review flagged payments. Sanctions oversight. Risk analysis.' },
               { role: 'Reviewer', icon: Eye, desc: 'Decision queue. Approve or escalate. Full reasoning visible.' },
               { role: 'Auditor', icon: FileText, desc: 'Read-only audit logs. PDF reports. Revalidation history.' },
             ].map((r, i) => {
               const Icon = r.icon;
               return (
                 <div key={i} className="glass-card-hover p-6 text-left">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-6 bg-brand-primary/10 text-brand-primary">
                       <Icon className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-ink-900 mb-2">{r.role}</h4>
                    <p className="text-ink-600 text-sm leading-relaxed">{r.desc}</p>
                 </div>
               );
             })}
          </div>
        </div>
      </section>

      {/* SECTION 6: CTA — dark navy band */}
      <section className="py-24 relative overflow-hidden bg-navy-950">
        <div className="container mx-auto px-6 relative z-10 text-center space-y-8">
           <h2 className="text-5xl lg:text-6xl font-extrabold tracking-tight text-white">
              Ready to See <br />
              It in Action?
           </h2>
           <p className="text-navy-200 text-xl max-w-lg mx-auto">
              Sign in with your role and explore the full settlement pipeline.
           </p>
           <div className="flex justify-center gap-4">
              <button
                onClick={() => navigate('/login')}
                className="btn-primary px-10 py-5 text-base"
              >
                Sign In
              </button>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-10 py-5 bg-navy-900 border border-navy-700 text-navy-200 font-bold rounded-lg hover:bg-navy-800 hover:text-white transition-all"
              >
                Learn More
              </button>
           </div>
        </div>
      </section>

      {/* SECTION 7: FOOTER */}
      <footer className="py-12 border-t border-navy-800 bg-navy-950">
         <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-12 items-start mb-12">
               <div className="space-y-4">
                  <div className="flex items-center gap-2">
                     <Shield className="w-6 h-6 text-brand-primary" />
                     <span className="text-xl font-bold tracking-tight text-white">SettleGuard</span>
                  </div>
                  <p className="text-navy-200 text-sm leading-relaxed">
                     Compliance-aware settlement orchestration for the stablecoin economy.
                  </p>
               </div>
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                     <h5 className="text-xs font-bold uppercase tracking-widest text-navy-200">Platform</h5>
                     <ul className="space-y-2 text-sm text-navy-400">
                        <li><a href="#" className="hover:text-white transition-colors">Dashboard</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Pipeline</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Docs</a></li>
                     </ul>
                  </div>
                  <div className="space-y-4">
                     <h5 className="text-xs font-bold uppercase tracking-widest text-navy-200">Legal</h5>
                     <ul className="space-y-2 text-sm text-navy-400">
                        <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Policy</a></li>
                     </ul>
                  </div>
               </div>
               <div className="space-y-4 text-right md:text-left">
                  <h5 className="text-xs font-bold uppercase tracking-widest text-navy-200">Technology Stack</h5>
                  <p className="text-navy-400 text-xs leading-loose uppercase tracking-tighter">
                     Base Sepolia settlement <br />
                     AI advisory routing <br />
                     Neo4j graph intelligence <br />
                     Simulated ZK compliance proofs
                  </p>
               </div>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-navy-800 gap-4">
               <p className="text-navy-400 text-[10px] font-bold uppercase tracking-widest">© 2026 SettleGuard. Hackathon Demo.</p>
               <div className="flex items-center gap-6">
                  <a href="#" className="text-navy-400 hover:text-white transition-colors"><Zap className="w-4 h-4" /></a>
                  <a href="#" className="text-navy-400 hover:text-white transition-colors"><Shield className="w-4 h-4" /></a>
                  <a href="#" className="text-navy-400 hover:text-white transition-colors"><LinkIcon className="w-4 h-4" /></a>
               </div>
            </div>
         </div>
      </footer>

      {/* Styles for animations */}
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -20;
          }
        }
        .animate-dash {
          stroke-dasharray: 4 4;
          animation: dash 10s linear infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
