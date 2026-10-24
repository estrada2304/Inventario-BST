'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Next.js Client Error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center space-y-4 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight">Ocurrió un error inesperado</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Hubo un problema al cargar esta página o componente. Puedes intentar recargar para solucionarlo.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => reset()} variant="default">
          Reintentar
        </Button>
        <Button onClick={() => window.location.reload()} variant="outline">
          Recargar Página
        </Button>
      </div>
    </div>
  );
}
