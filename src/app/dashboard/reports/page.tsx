'use client';

import React from 'react';
import { GeneralReport } from '@/components/dashboard/general-report';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reportes Financieros y de Operación</h1>
        <p className="text-muted-foreground">
          Análisis de ventas, estimación de inventario y generación de informes exportables.
        </p>
      </div>

      <GeneralReport />
    </div>
  );
}

