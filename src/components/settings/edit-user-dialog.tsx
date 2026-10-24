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
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const formSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido.'),
  lastName: z.string().min(1, 'El apellido es requerido.'),
  email: z.string().email(),
  role: z.enum(['Admin', 'Sales', 'Viewer', 'User']),
  isActive: z.boolean(),
});

type EditUserFormValues = z.infer<typeof formSchema>;

function EditUserForm({ user, onSaveSuccess, onCancel }: { user: UserProfile; onSaveSuccess: () => void; onCancel: () => void; }) {
  const [isLoading, setIsLoading] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
  });

  const onSubmit = async (values: EditUserFormValues) => {
    if (!firestore) return;

    setIsLoading(true);
    const userDocRef = doc(firestore, 'users', user.id);

    try {
      const dataToUpdate = {
        firstName: values.firstName,
        lastName: values.lastName,
        role: values.role,
        isActive: values.isActive,
        updatedAt: serverTimestamp(),
      };
      
      await updateDoc(userDocRef, dataToUpdate);

      toast({
        title: "Usuario Actualizado",
        description: `Los cambios para el usuario ${values.email} se han guardado.`,
      });
      onSaveSuccess();
    } catch (error: any) {
      console.error("Error updating user:", error);
       errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'update',
          requestResourceData: values
        }));
      toast({
        variant: "destructive",
        title: "Error al Actualizar Usuario",
        description: "No se pudo actualizar el perfil. Verifica que tengas los permisos necesarios.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="firstName" render={({ field }) => (
            <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input placeholder="Jane" {...field} disabled={isLoading} /></FormControl><FormMessage /></FormItem>
          )}/>
          <FormField control={form.control} name="lastName" render={({ field }) => (
            <FormItem><FormLabel>Apellido</FormLabel><FormControl><Input placeholder="Doe" {...field} disabled={isLoading} /></FormControl><FormMessage /></FormItem>
          )}/>
        </div>
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" readOnly disabled {...field} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="role" render={({ field }) => (
          <FormItem><FormLabel>Rol</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona un rol" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Admin">Administrador</SelectItem><SelectItem value="Sales">Ventas</SelectItem><SelectItem value="Viewer">Observador</SelectItem><SelectItem value="User">Usuario</SelectItem></SelectContent></Select><FormMessage /></FormItem>
        )}/>
        <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Usuario Activo</FormLabel>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancelar</Button>
          <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar Cambios</Button>
        </div>
      </form>
    </Form>
  );
}

interface EditUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

export function EditUserDialog({ isOpen, onClose, user }: EditUserDialogProps) {
    if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
          <DialogDescription>
            Actualiza los datos del perfil y asigna roles según las necesidades del equipo.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <EditUserForm user={user} onSaveSuccess={onClose} onCancel={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
