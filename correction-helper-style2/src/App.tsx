import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Database, 
  BarChart3, 
  Users, 
  Upload, 
  ChevronRight, 
  LogOut,
  ExternalLink,
  Printer,
  CheckCircle2,
  Clock,
  PlayCircle,
  Activity,
  Calendar
} from 'lucide-react';
import { motion } from 'motion/react';

export default function App() {
  return (
    <div className="flex min-h-screen bg-bg-base font-sans text-slate-900">
      {/* Sidebar - Modular Version */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col fixed h-screen z-10 p-6">
        <div className="mb-10 flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-primary rounded-lg flex items-center justify-center font-bold text-white shadow-sm ring-4 ring-brand-primary/10">
            <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight italic">CORRECT.IO</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold font-mono">V1.1 PLATFORM</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarLink icon={<LayoutDashboard size={18} />} label="Dashboard" />
          <SidebarLink icon={<FileText size={18} />} label="Paper Grading" active />
          <SidebarLink icon={<Database size={18} />} label="Answer Bank" />
          <SidebarLink icon={<BarChart3 size={18} />} label="Class Analytics" />
          <SidebarLink icon={<Users size={18} />} label="Student Portal" />
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center font-bold text-slate-400">ML</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate">Ms. Lin</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Pro Teacher</p>
          </div>
          <button className="text-slate-300 hover:text-slate-900 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-72 flex-1 p-8 grid grid-cols-4 grid-rows-[auto_1fr_1fr] gap-6">
        
        {/* Header - Top Row Span */}
        <header className="col-span-4 flex justify-between items-center bg-white/50 backdrop-blur-sm rounded-3xl p-6 border border-slate-200 mb-2">
          <div className="flex items-center gap-4">
            <div className="w-px h-8 bg-slate-200 mx-2"></div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Active Workflow</p>
              <h2 className="text-xl font-bold tracking-tight">Paper Grading Suite</h2>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary flex items-center gap-2 text-sm">
              <Calendar size={16} />
              Schedule
            </button>
            <button className="btn-primary flex items-center gap-2 text-sm">
              <Printer size={16} />
              Quick Scan
            </button>
          </div>
        </header>

        {/* Hero Card - Large Bento Box */}
        <div className="col-span-2 row-span-2 bento-card overflow-hidden relative">
          <div className="flex justify-between items-start mb-10">
            <span className="px-3 py-1 bg-brand-primary/5 text-brand-primary text-[10px] font-bold uppercase tracking-widest rounded-full border border-brand-primary/10">Live Status</span>
            <span className="text-slate-300 text-[10px] font-bold font-mono tracking-tighter uppercase">ID: CORRECT-V1.1-2026</span>
          </div>
          
          <h1 className="text-5xl font-light tracking-tight mb-4 text-slate-800">
            Smart <span className="font-bold text-slate-900 underline decoration-brand-primary decoration-4 underline-offset-8">Registration</span> & Analytics
          </h1>
          <p className="text-slate-500 text-sm mb-12 max-w-sm leading-relaxed">
            Paper-based grading mapped into high-density digital flows. Manage answer banks, student review, and exports in one ecosystem.
          </p>
          
          <div className="mt-auto space-y-6">
            <div>
              <div className="flex justify-between text-[11px] font-bold mb-2 uppercase tracking-widest text-slate-400">
                <span>Batch processing progress</span>
                <span className="text-brand-primary">78% Full</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '78%' }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="h-full bg-brand-primary rounded-full relative"
                >
                  <div className="absolute top-0 right-0 w-1 h-full bg-white/20"></div>
                </motion.div>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-[1.5rem] p-4 flex items-center justify-between border border-slate-100">
              <div className="flex gap-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 shadow-sm" />
                ))}
                <div className="w-8 h-8 rounded-full border-2 border-white bg-brand-primary/10 flex items-center justify-center text-[10px] font-bold text-brand-primary shadow-sm">+8</div>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Class Grade 7 Jade</p>
            </div>
          </div>
        </div>

        {/* Stats 1 - Dark Bento */}
        <div className="col-span-1 row-span-1 bento-card-dark justify-between group overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
              <FileText size={22} />
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mt-2"></div>
          </div>
          <div>
            <p className="text-4xl font-bold mb-1 tracking-tighter">02</p>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] leading-tight">Teacher Papers<br/>Scanned Today</p>
          </div>
        </div>

        {/* Stats 2 - Accent Bento */}
        <div className="col-span-1 row-span-1 bento-card-accent justify-between relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-white/5 -rotate-12 transform group-hover:rotate-0 transition-transform">
            <Activity size={120} />
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white relative z-10">
            <Activity size={22} />
          </div>
          <div className="relative z-10">
            <p className="text-4xl font-bold mb-1 tracking-tighter">00</p>
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.2em] leading-tight">Answer Banks<br/>Ready for Link</p>
          </div>
        </div>

        {/* Pipeline Card - Large Bento */}
        <div className="col-span-2 row-span-1 bento-card justify-between">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Grading Pipeline</h4>
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-slate-200"></div>
              <div className="w-2 h-2 rounded-full bg-slate-100"></div>
            </div>
          </div>
          
          <div className="flex gap-4 items-end overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex-1 space-y-4">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase text-slate-400">
                <span>V1.1 Workflow</span>
                <span className="text-brand-primary">Step 02/04</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <StatusDot active completed />
                <StatusDot active />
                <StatusDot />
                <StatusDot />
              </div>
              <p className="text-sm font-bold text-slate-800 leading-snug">Current: Question Segmentation & ID Box Definition</p>
            </div>
          </div>
        </div>

        {/* Form Card - Modern Bento */}
        <div className="col-span-2 row-span-1 bento-card bg-slate-50/50 border-dashed border-2 border-slate-200">
           <div className="flex gap-4 items-center mb-6">
             <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400">
               <Printer size={24} />
             </div>
             <div>
               <h4 className="text-sm font-bold text-slate-800">New Scan Job</h4>
               <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Configure batch parameters</p>
             </div>
           </div>
           
           <div className="grid grid-cols-3 gap-3 mb-6">
              <select className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:ring-2 ring-brand-primary/10 transition-all appearance-none cursor-pointer">
                <option>Grade 7 Jade</option>
              </select>
              <select className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:ring-2 ring-brand-primary/10 transition-all appearance-none cursor-pointer">
                <option>Mathematics</option>
              </select>
              <button className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-brand-primary hover:bg-brand-primary hover:text-white transition-all shadow-sm">
                + Create
              </button>
           </div>
           
           <div className="mt-auto flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Printer System Active</span>
              </div>
              <button className="text-[10px] font-black uppercase text-brand-primary underline decoration-2 underline-offset-4">Advanced Settings</button>
           </div>
        </div>

      </main>
    </div>
  );
}

function SidebarLink({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <a href="#" className={`sidebar-link ${active ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}>
      {icon}
      <span>{label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white"></div>}
    </a>
  );
}

function StatusDot({ active = false, completed = false }: { active?: boolean, completed?: boolean }) {
  return (
    <div className={`h-2 rounded-full transition-all duration-500 ${
      completed ? 'bg-emerald-500 w-full' : 
      active ? 'bg-brand-primary w-full shadow-[0_0_12px_rgba(45,90,76,0.4)]' : 
      'bg-slate-200 w-full'
    }`} />
  );
}
