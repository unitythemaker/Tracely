'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  AlertTriangle,
  Server,
  Activity,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Olaylar', href: '/incidents', icon: AlertTriangle },
  { name: 'Servisler', href: '/services', icon: Server },
  { name: 'Metrikler', href: '/metrics', icon: Activity },
  { name: 'Kurallar', href: '/rules', icon: SlidersHorizontal },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen sticky top-0 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00d9ff] to-[#00a8cc] flex items-center justify-center glow-primary">
            <Zap className="w-5 h-5 text-[#0a0e14]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">TRACELY</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Service Monitor</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-accent text-[#00d9ff] border border-[#00d9ff]/20 glow-primary'
                  : 'text-sidebar-foreground hover:bg-[#00d9ff]/10 hover:text-[#00d9ff]'
              )}
            >
              <item.icon className={cn('w-5 h-5', isActive && 'text-[#00d9ff]')} />
              {item.name}
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00d9ff] status-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

    </aside>
  );
}
