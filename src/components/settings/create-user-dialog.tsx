'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const formSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido.'),
  lastName: z.string().min(1, 'El apellido es requerido.'),
  email: z.string().email('Debe ser un email válido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
  role: z.enum(['Admin', 'Sales', 'Viewer', 'User'], {
    required_error: 'Debe seleccionar un rol.',
  }),
});

type CreateUserFormValues = z.infer<typeof formSchema>;

function CreateUserForm({ onSaveSuccess, onCancel }: { onSaveSuccess: () => void; onCancel: () => void; }) {
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'Sales',
    },
  });

  // Limpiar error de autenticación cuando el usuario cambia el email
  const watchEmail = form.watch('email');
  useEffect(() => {
    if (authError) setAuthError(null);
  }, [watchEmail, authError]);

  const onSubmit = async (values: CreateUserFormValues) => {
    if (!firestore) return;

    setIsLoading(true);
    setAuthError(null);
    
    const tempAppName = `temp-user-creation-${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);

    try {
      const userCredential = await createUserWithEmailAndPassword(tempAuth, values.email, values.password);
      const newUserUid = userCredential.user.uid;

      const userDocRef = doc(firestore, 'users', newUserUid);
      const newUserProfile = {
        id: newUserUid,
        email: values.email,
        firstName: values.firstName,
        lastName: values.lastName,
        username: values.email ? values.email.split('@')[0] : (values.firstName?.toLowerCase() || 'user'),
        role: values.role,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userDocRef, newUserProfile);

      toast({
        title: "Usuario Creado",
        description: `El perfil para ${values.email} se ha creado correctamente en el sistema.`,
      });
      onSaveSuccess();
    } catch (error: any) {
      console.error("Error creating user:", error);
      
      if (error.code === 'auth/email-already-in-use') {
        setAuthError("Este correo todavía está registrado en el sistema de acceso de Firebase. Por favor, asegúrate de haberlo borrado en la Consola > Authentication.");
      } else {
        toast({
          variant: "destructive",
          title: "Error al Crear Usuario",
          description: error.message || "No se pudo crear el usuario.",
        });
      }
    } finally {
      await signOut(tempAuth);
      await deleteApp(tempApp);
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {authError && (
          <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-md flex gap-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{authError}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="firstName" render={({ field }) => (
            <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input placeholder="Jane" {...field} disabled={isLoading}/></FormControl><FormMessage /></FormItem>
          )}/>
          <FormField control={form.control} name="lastName" render={({ field }) => (
            <FormItem><FormLabel>Apellido</FormLabel><FormControl><Input placeholder="Doe" {...field} disabled={isLoading}/></FormControl><FormMessage /></FormItem>
          )}/>
        </div>
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="usuario@ejemplo.com" {...field} disabled={isLoading}/></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem><FormLabel>Contraseña</FormLabel><FormControl><Input type="password" placeholder="Min. 6 caracteres" {...field} disabled={isLoading}/></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="role" render={({ field }) => (
          <FormItem><FormLabel>Rol</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona un rol" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Admin">Administrador</SelectItem><SelectItem value="Sales">Ventas</SelectItem><SelectItem value="Viewer">Observador</SelectItem><SelectItem value="User">Usuario</SelectItem></SelectContent></Select><FormMessage /></FormItem>
        )}/>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancelar</Button>
          <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crear Usuario</Button>
        </div>
      </form>
    </Form>
  );
}

interface CreateUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateUserDialog({ isOpen, onClose }: CreateUserDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Usuario</DialogTitle>
          <DialogDescription>
            Registra un nuevo miembro del equipo. Si el correo fue borrado recientemente de la consola, ahora debería permitirte agregarlo.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <CreateUserForm onSaveSuccess={onClose} onCancel={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
