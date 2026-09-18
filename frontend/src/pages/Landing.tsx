import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  Brain, 
  Lock, 
  Link as LinkIcon, 
  ArrowRight, 
  CheckCircle2, 
  Globe, 
  Settings, 
  Wallet, 
  Scale, 
  Eye, 
  FileText,
  ChevronDown,
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
  const [activeTab, setActiveTab] = useState(0);

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

    // Globe
    const geometry = new THREE.SphereGeometry(2, 32, 32);
    const material = new THREE.MeshPhongMaterial({
      color: 0x3b82f6,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    // Dots/Points on globe
    const pointsGeometry = new THREE.SphereGeometry(2.05, 32, 32);
    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.05,
      color: 0x60a5fa,
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
      const material = new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.6 });
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
    { id: 9, name: 'AI Decision', desc: 'Gemma/Groq advisory routing decision', icon: Brain },
    { id: 10, name: 'Policy Veto', desc: 'Deterministic override. AI cannot bypass this.', icon: Shield, special: true },
    { id: 11, name: 'FHE Checks', desc: 'Private threshold checks without revealing amounts', icon: Lock },
    { id: 12, name: 'ZK Proofs', desc: 'Verifiable compliance proofs, no data exposure', icon: Shield },
    { id: 13, name: 'Human Approval', desc: 'Role-gated approval for flagged transactions', icon: CheckCircle2 },
    { id: 14, name: 'On-Chain Settlement', desc: 'Token transfer + immutable proof registry', icon: Network },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 font-inter selection:bg-blue-500/30">
      {/* SECTION 1: HERO */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background Particles (Canvas fallback for pure CSS) */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
           <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse-slow" />
           <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        </div>

        <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Globe Container */}
          <div className="relative order-2 lg:order-1 flex justify-center items-center h-[500px]">
             <div ref={globeRef} className="w-full h-full max-w-[500px] max-h-[500px]" />
             
             {/* Floating Badges */}
             <div className="absolute top-10 left-0 glass-card px-4 py-2 flex items-center gap-2 animate-float border-white/10">
                <Layers className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold uppercase tracking-wider">24 Compliance Layers</span>
             </div>
             <div className="absolute bottom-20 right-0 glass-card px-4 py-2 flex items-center gap-2 animate-float border-white/10" style={{ animationDelay: '1s' }}>
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold uppercase tracking-wider">AI + Policy Veto</span>
             </div>
             <div className="absolute top-20 right-10 glass-card px-4 py-2 flex items-center gap-2 animate-float border-white/10" style={{ animationDelay: '2s' }}>
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider">ZK Proof On-Chain</span>
             </div>
             <div className="absolute bottom-10 left-10 glass-card px-4 py-2 flex items-center gap-2 animate-float border-white/10" style={{ animationDelay: '0.5s' }}>
                <Lock className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider">FHE Protected</span>
             </div>
          </div>

          {/* Hero Content */}
          <div className="order-1 lg:order-2 space-y-8">
            <div className="space-y-4">
              <span className="text-blue-500 font-bold tracking-[0.3em] uppercase text-xs animate-slide-up">
                Compliance-Aware Settlement Infrastructure
              </span>
              <h1 className="text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight animate-slide-up">
                Intelligent <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400">Stablecoin</span><br />
                Settlement.
              </h1>
              <p className="text-slate-400 text-xl max-w-lg leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
                24-layer deterministic compliance pipeline. AI-assisted routing. 
                Policy-enforced finality. On-chain proof. Zero compromise.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <button 
                onClick={() => navigate('/login')}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 active:scale-[0.98]"
              >
                Get Started
              </button>
              <button 
                onClick={() => document.getElementById('pipeline')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-4 bg-transparent border border-blue-500/50 hover:border-blue-400 text-blue-400 hover:bg-blue-400/10 font-bold rounded-xl transition-all"
              >
                View Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: PIPELINE */}
      <section id="pipeline" className="py-24 bg-slate-950/50 border-y border-slate-800/30">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mb-16 space-y-4">
             <h2 className="text-4xl font-bold">Every Payment. Every Rule. <span className="text-blue-500">Zero Exceptions.</span></h2>
             <p className="text-slate-500 text-lg">
                Our 24-layer pipeline processes every settlement through deterministic 
                compliance checks before a single token moves.
             </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             {pipelineStages.map((stage, i) => {
               const Icon = stage.icon;
               return (
                 <div 
                  key={stage.id} 
                  className={`glass-card p-6 border-white/5 transition-all duration-300 hover:-translate-y-2 group ${stage.special ? 'ring-2 ring-amber-500/50 bg-amber-500/[0.02]' : 'hover:border-blue-500/30'}`}
                 >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${stage.special ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-800 group-hover:bg-blue-600/20 group-hover:text-blue-400 text-slate-400'}`}>
                       <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                       <span className="text-[10px] font-bold text-slate-600 bg-slate-900 px-1.5 py-0.5 rounded uppercase">{String(stage.id).padStart(2, '0')}</span>
                       <h3 className="font-bold text-white tracking-tight">{stage.name}</h3>
                    </div>
                    <p className="text-slate-500 text-sm leading-relaxed">{stage.desc}</p>
                 </div>
               );
             })}
          </div>
        </div>
      </section>

      {/* SECTION 3: FEATURES */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
             <h2 className="text-4xl font-bold">Enterprise-Grade. <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">Hackathon-Built.</span></h2>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
             <div className="glass-card p-10 border-white/5 hover:border-blue-500/30 transition-all group">
                <div className="w-16 h-16 rounded-2xl bg-blue-600/10 flex items-center justify-center mb-8 group-hover:bg-blue-600/20 transition-colors">
                   <Brain className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold mb-4">AI Advisory. Policy Enforced.</h3>
                <p className="text-slate-500 leading-relaxed text-lg">
                  Gemma AI recommends routes. Policy Final Veto has the last word. 
                  No AI hallucination can approve a sanctioned payment.
                </p>
             </div>

             <div className="glass-card p-10 border-white/5 hover:border-purple-500/30 transition-all group">
                <div className="w-16 h-16 rounded-2xl bg-purple-600/10 flex items-center justify-center mb-8 group-hover:bg-purple-600/20 transition-colors">
                   <Lock className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold mb-4">FHE + ZK Privacy Layer</h3>
                <p className="text-slate-500 leading-relaxed text-lg">
                   Amount threshold checks run on encrypted values. 
                   ZK proofs verify compliance without revealing sensitive data.
                </p>
             </div>

             <div className="glass-card p-10 border-white/5 hover:border-cyan-500/30 transition-all group">
                <div className="w-16 h-16 rounded-2xl bg-cyan-600/10 flex items-center justify-center mb-8 group-hover:bg-cyan-600/20 transition-colors">
                   <LinkIcon className="w-8 h-8 text-cyan-400" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Immutable On-Chain Evidence</h3>
                <p className="text-slate-500 leading-relaxed text-lg">
                   Every settlement writes a proof to Base Sepolia. 
                   Every decision is logged, auditable, and downloadable as PDF.
                </p>
             </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: CORRIDORS */}
      <section className="py-24 bg-slate-950/30 overflow-hidden relative">
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-2xl mb-16 space-y-4">
             <h2 className="text-4xl font-bold tracking-tight">Global Corridors. <span className="text-blue-500">Local Rules.</span></h2>
             <p className="text-slate-500 text-lg">
                Policy rules enforced per corridor. Some blocked. Some require KYC. None bypassed.
             </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
             <div className="space-y-4">
                {[
                  { from: 'Singapore', to: 'UAE', status: 'allowed', color: 'text-emerald-400' },
                  { from: 'Singapore', to: 'USA', status: 'allowed', color: 'text-emerald-400' },
                  { from: 'UK', to: 'UAE', status: 'allowed', color: 'text-emerald-400' },
                  { from: 'USA', to: 'Iran', status: 'blocked', color: 'text-rose-500' },
                  { from: 'Singapore', to: 'Russia', status: 'blocked', color: 'text-rose-500' },
                ].map((c, i) => (
                  <div key={i} className="glass-card p-4 flex items-center justify-between border-white/5 hover:bg-white/[0.02] transition-colors">
                     <div className="flex items-center gap-4">
                        <span className="text-slate-100 font-bold">{c.from}</span>
                        <ArrowRight className="w-4 h-4 text-slate-700" />
                        <span className="text-slate-100 font-bold">{c.to}</span>
                     </div>
                     <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-slate-900 border border-white/5 ${c.color}`}>
                        {c.status}
                     </span>
                  </div>
                ))}
             </div>
             
             <div className="relative">
                <div className="aspect-square glass-card rounded-full border-white/5 flex items-center justify-center p-8 bg-blue-500/[0.01]">
                   <div className="w-full h-full rounded-full border border-slate-800/50 relative overflow-hidden">
                      {/* Abstract map lines */}
                      <div className="absolute inset-0 opacity-20" style={{
                        backgroundImage: 'radial-gradient(circle at 100px 100px, rgba(59,130,246,0.3) 1px, transparent 0)',
                        backgroundSize: '30px 30px',
                      }} />
                      {/* Animated arcs */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
                         <path d="M 20 50 Q 50 10 80 50" fill="none" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="1 2" className="animate-dash" />
                         <path d="M 30 70 Q 50 30 70 70" fill="none" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="1 2" className="animate-dash" style={{ animationDelay: '1s' }} />
                         <path d="M 10 30 Q 50 0 90 30" fill="none" stroke="#f43f5e" strokeWidth="0.5" strokeDasharray="1 2" className="animate-dash" style={{ animationDelay: '2s' }} />
                      </svg>
                      {/* Points */}
                      <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-400 rounded-full shadow-[0_0_10px_rgba(96,165,250,0.8)]" />
                      <div className="absolute bottom-1/3 right-1/4 w-2 h-2 bg-blue-400 rounded-full shadow-[0_0_10px_rgba(96,165,250,0.8)]" />
                      <div className="absolute top-1/2 right-1/2 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.8)]" />
                   </div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: ROLES */}
      <section className="py-24">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-2xl mx-auto mb-16 space-y-4">
             <h2 className="text-4xl font-bold tracking-tight">Built for Every Stakeholder</h2>
             <p className="text-slate-500 text-lg">
                Five roles. Each with a purpose-built dashboard.
             </p>
          </div>

          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
             {[
               { role: 'Admin', icon: Shield, color: 'text-purple-400', border: 'border-purple-500/20', bg: 'bg-purple-500/5', desc: 'Full system control. Policy management. User oversight.' },
               { role: 'Treasury Officer', icon: Wallet, color: 'text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/5', desc: 'Create payments. Approve settlements. Monitor wallet balances.' },
               { role: 'Compliance Officer', icon: Scale, color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', desc: 'Review flagged payments. Sanctions oversight. Risk analysis.' },
               { role: 'Reviewer', icon: Eye, color: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/5', desc: 'Decision queue. Approve or escalate. Full reasoning visible.' },
               { role: 'Auditor', icon: FileText, color: 'text-cyan-400', border: 'border-cyan-500/20', bg: 'bg-cyan-500/5', desc: 'Read-only audit logs. PDF reports. Revalidation history.' },
             ].map((r, i) => {
               const Icon = r.icon;
               return (
                 <div key={i} className={`glass-card p-6 ${r.border} ${r.bg} text-left hover:bg-white/[0.04] transition-all cursor-default`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-6 bg-slate-900 ${r.color}`}>
                       <Icon className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-white mb-2">{r.role}</h4>
                    <p className="text-slate-500 text-sm leading-relaxed">{r.desc}</p>
                 </div>
               );
             })}
          </div>
        </div>
      </section>

      {/* SECTION 6: CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/5" />
        <div className="container mx-auto px-6 relative z-10 text-center space-y-8">
           <h2 className="text-5xl lg:text-6xl font-extrabold tracking-tight">
              Ready to See <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">It in Action?</span>
           </h2>
           <p className="text-slate-500 text-xl max-w-lg mx-auto">
              Sign in with your role and explore the full 24-layer pipeline.
           </p>
           <div className="flex justify-center gap-4">
              <button 
                onClick={() => navigate('/login')}
                className="px-10 py-5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98]"
              >
                Sign In
              </button>
              <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-10 py-5 bg-slate-900 border border-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-800 transition-all"
              >
                Learn More
              </button>
           </div>
        </div>
      </section>

      {/* SECTION 7: FOOTER */}
      <footer className="py-12 border-t border-slate-800/30 bg-slate-950/80">
         <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-12 items-start mb-12">
               <div className="space-y-4">
                  <div className="flex items-center gap-2">
                     <Shield className="w-6 h-6 text-blue-500" />
                     <span className="text-xl font-bold tracking-tight">SettleGuard</span>
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed">
                     Enterprise-grade compliance-aware settlement orchestration for the stablecoin economy.
                  </p>
               </div>
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                     <h5 className="text-xs font-bold uppercase tracking-widest text-slate-300">Platform</h5>
                     <ul className="space-y-2 text-sm text-slate-500">
                        <li><a href="#" className="hover:text-blue-400 transition-colors">Dashboard</a></li>
                        <li><a href="#" className="hover:text-blue-400 transition-colors">Pipeline</a></li>
                        <li><a href="#" className="hover:text-blue-400 transition-colors">Docs</a></li>
                     </ul>
                  </div>
                  <div className="space-y-4">
                     <h5 className="text-xs font-bold uppercase tracking-widest text-slate-300">Legal</h5>
                     <ul className="space-y-2 text-sm text-slate-500">
                        <li><a href="#" className="hover:text-blue-400 transition-colors">Privacy</a></li>
                        <li><a href="#" className="hover:text-blue-400 transition-colors">Terms</a></li>
                        <li><a href="#" className="hover:text-blue-400 transition-colors">Policy</a></li>
                     </ul>
                  </div>
               </div>
               <div className="space-y-4 text-right md:text-left">
                  <h5 className="text-xs font-bold uppercase tracking-widest text-slate-300">Technology Stack</h5>
                  <p className="text-slate-500 text-xs leading-loose uppercase tracking-tighter">
                     Built on Base Sepolia <br />
                     Powered by Gemma AI <br />
                     Neo4j Graph Intelligence <br />
                     ZK-SNARK Compliance Proofs
                  </p>
               </div>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-slate-800/20 gap-4">
               <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">© 2025 SettleGuard. Hackathon Demo.</p>
               <div className="flex items-center gap-6">
                  <a href="#" className="text-slate-600 hover:text-blue-400 transition-colors"><Zap className="w-4 h-4" /></a>
                  <a href="#" className="text-slate-600 hover:text-blue-400 transition-colors"><Shield className="w-4 h-4" /></a>
                  <a href="#" className="text-slate-600 hover:text-blue-400 transition-colors"><LinkIcon className="w-4 h-4" /></a>
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
