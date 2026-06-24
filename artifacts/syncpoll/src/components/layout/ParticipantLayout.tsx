import { ShieldCheck } from "lucide-react";

interface ParticipantLayoutProps {
  children: React.ReactNode;
}

export function ParticipantLayout({ children }: ParticipantLayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20">
      <header className="border-b border-border bg-card">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="font-bold tracking-tight text-foreground">Perimtr</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start pt-8 pb-12 px-4 max-w-md mx-auto w-full">
        {children}
      </main>
      
      <footer className="py-6 text-center text-xs text-muted-foreground">
        Secure check-in powered by Perimtr
      </footer>
    </div>
  );
}
