import Link from "next/link";
import { MessageSquare, HelpCircle, ChevronRight, Mail } from "lucide-react";

const faqs = [
  {
    q: "How long does my ad stay on the wall?",
    a: "Every pixel purchase includes a 1-year lease. After one year, the region becomes available for purchase again unless renewed."
  },
  {
    q: "Can I change my ad image or link later?",
    a: "Currently, ad submissions are final once approved. We are working on a dashboard feature to allow users to manage their active regions."
  },
  {
    q: "What kind of content is allowed?",
    a: "We allow most legal content. However, we reserve the right to reject ads that contain explicit material, hate speech, or malicious links. If rejected, you will receive a full refund."
  },
  {
    q: "How does the 'Infinite' grid work?",
    a: "Unlike the original 1000x1000 board, our system uses arbitrary-precision coordinates. This means the board can expand in any direction indefinitely as users purchase new space."
  },
  {
    q: "I paid but my ad isn't showing up yet.",
    a: "Ads usually appear instantly after successful payment. If you don't see it, try refreshing the page. If it still hasn't appeared after 10 minutes, please contact support."
  }
];

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-black text-white/90 font-mono selection:bg-yellow-200 selection:text-black pb-24">
      {/* Background Grid Effect */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
      />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 border-b border-white/10 overflow-hidden bg-white/[0.01]">
        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-200/10 border border-yellow-200/30 text-yellow-200 text-[10px] uppercase tracking-[0.3em] mb-4">
            <HelpCircle size={12} />
            Support Terminal
          </div>
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-tighter leading-none">
            Frequently Asked <br />
            <span className="text-yellow-200 underline decoration-4 underline-offset-8">Questions</span>
          </h1>
          <p className="max-w-xl mx-auto text-sm text-white/60 leading-relaxed pt-4">
            Everything you need to know about claiming your spot on the wall. 
            Can't find what you're looking for? Reach out to our operators.
          </p>
        </div>
      </section>

      {/* FAQ Grid Section */}
      <section className="py-24 px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {faqs.map((faq, index) => (
            <div key={index} className="space-y-4 group p-6 border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all relative">
              <div className="absolute top-0 left-0 w-1 h-1 bg-yellow-200 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-yellow-200 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                <span>QUERY // 0{index + 1}</span>
                <ChevronRight size={10} />
              </div>
              <h3 className="text-lg font-bold uppercase tracking-tight text-white group-hover:text-yellow-200 transition-colors leading-tight">
                {faq.q}
              </h3>
              <p className="text-xs text-white/50 leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact Section */}
      <section className="px-6 py-20 bg-white/[0.02] border-y border-white/10">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="w-16 h-16 bg-yellow-200 text-black mx-auto flex items-center justify-center">
            <Mail size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold uppercase tracking-tighter text-white">
              Still Have Questions?
            </h2>
            <p className="text-sm text-white/50">
              Our support terminal is active 24/7. Send us an encrypted message.
            </p>
          </div>
          <a 
            href="mailto:support@2milliondollarwall.com" 
            className="inline-block px-10 py-4 bg-white text-black font-bold uppercase text-xs tracking-[0.2em] hover:bg-yellow-200 transition-colors shadow-lg shadow-white/5"
          >
            Contact Support
          </a>
        </div>
      </section>

      {/* Quick Links Section */}
      <section className="py-20 px-6 text-center space-y-12">
        <div className="flex flex-wrap justify-center gap-8">
          <Link href="/about" className="text-[10px] uppercase tracking-widest text-white/40 hover:text-yellow-200 transition-colors flex items-center gap-2">
            <div className="w-1 h-1 bg-yellow-200" />
            About Project
          </Link>
          <Link href="/" className="text-[10px] uppercase tracking-widest text-white/40 hover:text-yellow-200 transition-colors flex items-center gap-2">
            <div className="w-1 h-1 bg-yellow-200" />
            Main Wall
          </Link>
        </div>
        
        <p className="text-[9px] uppercase tracking-[0.4em] text-white/20">
          Transmission end // Documentation ID: FAQ-V1.0.4 // Grid Status: Active
        </p>
      </section>
    </main>
  );
}
