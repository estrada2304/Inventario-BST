'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useUser } from '@/firebase';
import { LoginForm } from '@/components/auth/login-form';
import { Logo } from '@/components/logo';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function LoginPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isUserLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isUserLoading, router, mounted]);

  if (!mounted || isUserLoading || user) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Logo className="h-12 w-auto animate-pulse text-primary" />
        <p className="mt-4 text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-md border-border/80">
        <CardHeader className="text-center pb-2">
          <div className="mb-3 flex justify-center">
            <Logo className="h-10 w-auto text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Sistema BST Inventario
          </CardTitle>
          <CardDescription>
            Acceso al panel de gestión y operaciones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <LoginForm />
        </CardContent>
        <CardFooter className="flex-col gap-2 pt-0 pb-6">
          <p className="px-8 text-center text-xs text-muted-foreground">
            Al continuar, aceptas nuestros{' '}
            <Link
              href="#"
              className="underline underline-offset-4 hover:text-primary"
            >
              Términos de Servicio
            </Link>{' '}
            y{' '}
            <Link
              href="#"
              className="underline underline-offset-4 hover:text-primary"
            >
              Política de Privacidad
            </Link>
            .
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
