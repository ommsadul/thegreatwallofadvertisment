import Link from "next/link";
import { Zap, Globe, ShieldCheck, Target, Layers, Cpu } from "lucide-react";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-black text-white/90 font-mono selection:bg-yellow-200 selection:text-black pb-24">
      {/* Background Grid Effect */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', size: '40px 40px', backgroundSize: '40px 40px' }} 
      />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 border-b border-white/10 overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-6">
          <div className="inline-block px-3 py-1 border border-yellow-200/30 text-yellow-200 text-[10px] uppercase tracking-[0.3em] mb-4">
            Established 2026 // v1.0.4-Infinite
          </div>
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-tighter leading-none">
            The World is <span className="text-yellow-200">Infinite</span>.<br />
            So is your <span className="text-white border-b-4 border-yellow-200">Impact.</span>
          </h1>
          <p className="max-w-xl mx-auto text-sm text-white/60 leading-relaxed pt-4">
            We've taken the legendary 2005 concept and evolved it for the modern web. 
            No boundaries. No limits. Just pure, unadulterated spatial ownership on 
            a canvas that stretches as far as your imagination.
          </p>
        </div>
      </section>

      {/* Stats/Quick Info */}
      <section className="py-12 border-b border-white/10 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-2xl font-bold text-yellow-200">∞</div>
            <div className="text-[10px] uppercase tracking-widest text-white/40">Grid Size</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-200">$2.00</div>
            <div className="text-[10px] uppercase tracking-widest text-white/40">Price / Pixel</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-200">365D</div>
            <div className="text-[10px] uppercase tracking-widest text-white/40">Lease Term</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-200">100%</div>
            <div className="text-[10px] uppercase tracking-widest text-white/40">Uptime</div>
          </div>
        </div>
      </section>

      {/* Core Features - Landing Style */}
      <section className="py-24 px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-4 group">
            <div className="w-12 h-12 bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-yellow-200/50 transition-colors">
              <Layers size={24} className="text-yellow-200" />
            </div>
            <h3 className="text-lg font-bold uppercase tracking-tight">Infinite Layers</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Our spatial engine handles coordinates beyond standard floating points. 
              The wall isn't just a grid; it's a persistent, expanding universe.
            </p>
          </div>

          <div className="space-y-4 group">
            <div className="w-12 h-12 bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-yellow-200/50 transition-colors">
              <Target size={24} className="text-yellow-200" />
            </div>
            <h3 className="text-lg font-bold uppercase tracking-tight">Precision Selection</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Pixel-perfect precision. Select any rectangular region and claim it. 
              Real-time quoting ensures you know exactly what you're buying.
            </p>
          </div>

          <div className="space-y-4 group">
            <div className="w-12 h-12 bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-yellow-200/50 transition-colors">
              <Cpu size={24} className="text-yellow-200" />
            </div>
            <h3 className="text-lg font-bold uppercase tracking-tight">Automated Flow</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              From selection to Stripe checkout to live publication. 
              Our automated moderation queue keeps the wall clean and functional.
            </p>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="px-6">
        <div className="max-w-4xl mx-auto p-12 border border-yellow-200/20 bg-yellow-200/5 text-center space-y-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-2 bg-yellow-200" />
          <div className="absolute top-0 right-0 w-2 h-2 bg-yellow-200" />
          <div className="absolute bottom-0 left-0 w-2 h-2 bg-yellow-200" />
          <div className="absolute bottom-0 right-0 w-2 h-2 bg-yellow-200" />
          
          <h2 className="text-2xl md:text-4xl font-bold uppercase tracking-tighter">
            Ready to claim your piece of history?
          </h2>
          <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
            <Link 
              href="/#buy" 
              className="px-8 py-3 bg-yellow-200 text-black font-bold uppercase text-xs tracking-[0.2em] hover:bg-white transition-colors"
            >
              Enter the Grid
            </Link>
            <Link 
              href="/faq" 
              className="px-8 py-3 border border-white/20 text-white font-bold uppercase text-xs tracking-[0.2em] hover:bg-white/10 transition-colors"
            >
              Read Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Technical Footer */}
      <section className="mt-24 text-center px-6">
        <p className="text-[9px] uppercase tracking-[0.4em] text-white/20">
          Transmission encrypted // Protocol 8-BIT-SECURE // No rights reserved
        </p>
      </section>
    </main>
  );
}

