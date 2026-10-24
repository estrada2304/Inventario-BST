'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { seedSampleData } from '@/lib/seed-data';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileText,
  Users,
  Building2,
  Ship,
  BarChart2,
  Settings,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Logo } from '@/components/logo';
import { Header } from '@/components/dashboard/header';

const navItems = [
  { title: 'Panel Principal', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Inventario', href: '/dashboard/inventory', icon: Package },
  { title: 'Órdenes', href: '/dashboard/orders', icon: ShoppingCart },
  { title: 'Cotizaciones', href: '/dashboard/quotes', icon: FileText },
  { title: 'Clientes', href: '/dashboard/clients', icon: Users },
  { title: 'Proveedores', href: '/dashboard/suppliers', icon: Building2 },
  { title: 'Importaciones', href: '/dashboard/imports', icon: Ship },
  { title: 'Reportes', href: '/dashboard/reports', icon: BarChart2 },
  { title: 'Configuración', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const firestore = useFirestore();

  useEffect(() => {
    if (firestore) {
      seedSampleData(firestore, false);
    }
  }, [firestore]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b p-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Logo />
            </Link>
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="border-t p-2">
            <p className="text-xs text-center text-muted-foreground group-data-[collapsible=icon]:hidden">
              v1.0.0 BST Inventario
            </p>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <div className="flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

