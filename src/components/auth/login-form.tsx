'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  KeyRound,
} from 'lucide-react';

export function LoginForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password reset modal state
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    const rawIdentifier = identifier.trim();
    if (!rawIdentifier || !password) {
      setErrorMessage('Por favor ingresa tu usuario o correo y tu contraseña.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      let emailToAuth = rawIdentifier;

      // If the user typed a username instead of an email (does not have '@'),
      // find their registered email in the Firestore users collection
      if (!rawIdentifier.includes('@') && firestore) {
        try {
          const usersRef = collection(firestore, 'users');
          
          // Case 1: lowercase username lookup
          const qLower = query(usersRef, where('username', '==', rawIdentifier.toLowerCase()));
          let querySnapshot = await getDocs(qLower);

          // Case 2: exact match lookup
          if (querySnapshot.empty) {
            const qExact = query(usersRef, where('username', '==', rawIdentifier));
            querySnapshot = await getDocs(qExact);
          }

          // Case 3: lookup by firstName if username wasn't stored separately
          if (querySnapshot.empty) {
            const qFirst = query(usersRef, where('firstName', '==', rawIdentifier));
            querySnapshot = await getDocs(qFirst);
          }

          if (!querySnapshot.empty) {
            const foundUser = querySnapshot.docs[0].data();
            if (foundUser.email) {
              emailToAuth = foundUser.email;
            }
          }
        } catch (queryErr) {
          console.warn('Firestore lookup note:', queryErr);
        }
      }

      const normalizedEmail = emailToAuth.trim().toLowerCase();

      // Authenticate directly with Firebase Authentication using their created profile
      await signInWithEmailAndPassword(auth, normalizedEmail, password);

      toast({
        title: '¡Bienvenido!',
        description: 'Inicio de sesión exitoso. Redirigiendo al panel...',
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Error logging in:', error);
      const code = error?.code || '';

      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password'
      ) {
        setErrorMessage('Usuario o contraseña incorrectos. Verifica que la contraseña coincida con tu usuario en Firebase.');
      } else if (code === 'auth/too-many-requests') {
        setErrorMessage('Demasiados intentos fallidos. Por favor espera unos momentos antes de intentar de nuevo.');
      } else if (code === 'auth/invalid-email') {
        setErrorMessage('El formato de correo o usuario ingresado no es válido.');
      } else if (code === 'auth/user-disabled') {
        setErrorMessage('Esta cuenta de usuario ha sido desactivada en el sistema.');
      } else {
        setErrorMessage(error.message || 'No se pudo iniciar sesión. Por favor verifica tus credenciales.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    const trimmed = resetInput.trim();
    if (!trimmed) {
      toast({
        variant: 'destructive',
        title: 'Campo requerido',
        description: 'Por favor introduce tu correo electrónico o usuario registrado.',
      });
      return;
    }

    setIsResetting(true);
    try {
      let targetEmail = trimmed.toLowerCase();

      // If username provided, look up email in Firestore
      if (!trimmed.includes('@') && firestore) {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('username', '==', trimmed.toLowerCase()));
        const snap = await getDocs(q);
        if (!snap.empty && snap.docs[0].data()?.email) {
          targetEmail = snap.docs[0].data().email.toLowerCase();
        }
      }

      await sendPasswordResetEmail(auth, targetEmail);
      toast({
        title: 'Correo Enviado',
        description: `Se ha enviado el enlace de restablecimiento a ${targetEmail}. Revisa tu bandeja de entrada.`,
      });
      setIsResetOpen(false);
      setResetInput('');
    } catch (error: any) {
      console.error('Error sending reset email:', error);
      const code = error?.code || '';
      if (code === 'auth/user-not-found') {
        toast({
          variant: 'destructive',
          title: 'Usuario no encontrado',
          description: 'No existe una cuenta registrada con este correo en Firebase.',
        });
      } else if (code === 'auth/invalid-email') {
        toast({
          variant: 'destructive',
          title: 'Correo inválido',
          description: 'El formato del correo electrónico no es válido.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'No se pudo enviar el correo de restablecimiento.',
        });
      }
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="bg-destructive/10 border border-destructive/20 p-3.5 rounded-lg flex flex-col gap-2 text-xs text-destructive animate-in fade-in-50">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="leading-snug font-medium">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setResetInput(identifier);
              setIsResetOpen(true);
            }}
            className="text-left text-xs text-primary font-semibold hover:underline pl-6"
          >
            ¿Olvidaste tu contraseña? Restablécela aquí
          </button>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-identifier" className="text-xs font-medium">
            Usuario o Correo Electrónico
          </Label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="login-identifier"
              type="text"
              placeholder="ej. usuario o correo@empresa.com"
              className="pl-9 h-10 text-sm"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="username"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password" className="text-xs font-medium">
              Contraseña
            </Label>
            <button
              type="button"
              onClick={() => {
                setResetInput(identifier);
                setIsResetOpen(true);
              }}
              className="text-xs text-primary hover:underline font-medium"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className="pl-9 pr-9 h-10 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-11 font-semibold text-sm mt-2"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Iniciando sesión...
            </>
          ) : (
            'Iniciar Sesión'
          )}
        </Button>
      </form>

      {/* Modal Olvidé mi Contraseña */}
      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Recuperar Contraseña
            </DialogTitle>
            <DialogDescription>
              Ingresa tu correo o usuario registrado en Firebase y te enviaremos un enlace para restablecer tu contraseña.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordReset} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="reset-input" className="text-xs font-medium">
                Usuario o Correo Registrado
              </Label>
              <Input
                id="reset-input"
                type="text"
                placeholder="tu@empresa.com o tu_usuario"
                value={resetInput}
                onChange={(e) => setResetInput(e.target.value)}
                required
                disabled={isResetting}
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsResetOpen(false)}
                disabled={isResetting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isResetting || !resetInput.trim()}>
                {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar Enlace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
