'use client';

import { useState } from 'react';
import { SidebarToggle } from './sidebar-toggle';
import { UserNav } from './user-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Database, Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { seedSampleData } from '@/lib/seed-data';
import { useToast } from '@/hooks/use-toast';

export function Header() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedData = async () => {
    if (!firestore) return;
    setIsSeeding(true);
    try {
      const ok = await seedSampleData(firestore, true);
      if (ok) {
        toast({
          title: 'Datos de Demostración Cargados',
          description: 'Se han creado/restaurado los productos, clientes, cotizaciones y órdenes de muestra.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudieron cargar todos los datos de muestra.',
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error al intentar cargar los datos de muestra.',
      });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2">
        <SidebarToggle />
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSeedData}
          disabled={isSeeding || !firestore}
          className="text-xs h-8 gap-1.5 hidden sm:flex"
          title="Cargar datos de demostración en la base de datos"
        >
          {isSeeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5 text-primary" />}
          {isSeeding ? 'Cargando...' : 'Restaurar Datos Muestra'}
        </Button>
        <ThemeToggle />
        <UserNav />
      </div>
    </header>
  );
}

