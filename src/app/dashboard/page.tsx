'use client';

import React from 'react';
import { KPICards } from '@/components/dashboard/kpi-cards';
import { SalesOverview } from '@/components/dashboard/sales-chart';
import { AdvancedAnalytics } from '@/components/dashboard/recent-sales';
import { GeneralReport } from '@/components/dashboard/general-report';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Panel Principal</h1>
        <p className="text-muted-foreground">
          Resumen general del estado de tu inventario, ventas y operaciones.
        </p>
      </div>

      <KPICards />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 lg:col-span-7">
          <SalesOverview />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 lg:col-span-7">
          <AdvancedAnalytics />
        </div>
      </div>

      <GeneralReport />
    </div>
  );
}

