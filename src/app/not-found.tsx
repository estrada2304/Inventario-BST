import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-background">
      <h1 className="text-6xl font-bold text-foreground">404</h1>
      <h2 className="mt-4 text-2xl font-semibold text-muted-foreground">Página no encontrada</h2>
      <p className="max-w-md mt-2 text-sm text-muted-foreground">
        La página que estás buscando no existe o ha sido movida.
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Volver al Panel Principal</Link>
      </Button>
    </div>
  );
}

