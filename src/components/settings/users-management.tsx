'use client';

import React, { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Users,
  UserPlus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Key,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Lock,
  Eye,
  ShoppingBag,
  ShieldCheck,
  Mail,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CreateUserDialog } from './create-user-dialog';
import { EditUserDialog } from './edit-user-dialog';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '@/firebase';

export function UsersManagement() {
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resetEmailUser, setResetEmailUser] = useState<UserProfile | null>(null);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const usersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'users') : null),
    [firestore]
  );
  const { data: users, isLoading } = useCollection<UserProfile>(usersQuery);

  const filteredUsers = React.useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      const full = `${u.firstName || ''} ${u.lastName || ''} ${u.email || ''} ${u.username || ''}`.toLowerCase();
      return full.includes(searchTerm.toLowerCase());
    });
  }, [users, searchTerm]);

  const handleToggleActive = async (user: UserProfile) => {
    if (!firestore) return;
    try {
      const userRef = doc(firestore, 'users', user.id);
      await updateDoc(userRef, {
        isActive: !user.isActive,
        updatedAt: serverTimestamp(),
      });
      toast({
        title: user.isActive ? 'Usuario Desactivado' : 'Usuario Activado',
        description: `El estado del usuario ${user.email || 'seleccionado'} se ha actualizado.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cambiar el estado del usuario.',
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!firestore || !deletingUser) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(firestore, 'users', deletingUser.id));
      toast({
        title: 'Usuario Eliminado',
        description: `El usuario ${deletingUser.email || 'seleccionado'} ha sido removido del sistema.`,
      });
      setDeletingUser(null);
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el usuario de la base de datos.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!auth || !resetEmailUser || !resetEmailUser.email) return;
    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, resetEmailUser.email);
      toast({
        title: 'Correo Enviado',
        description: `Se ha enviado el enlace de restablecimiento de contraseña a ${resetEmailUser.email}.`,
      });
      setResetEmailUser(null);
    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Error al enviar correo',
        description: err.message || 'No se pudo enviar el correo de recuperación.',
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'Admin':
        return <Badge className="bg-purple-600 hover:bg-purple-700 text-white gap-1"><ShieldCheck className="h-3 w-3" /> Administrador</Badge>;
      case 'Sales':
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white gap-1"><ShoppingBag className="h-3 w-3" /> Ventas</Badge>;
      case 'Viewer':
        return <Badge variant="secondary" className="gap-1"><Eye className="h-3 w-3" /> Observador</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Users Table Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl text-primary">
              <Users className="h-5 w-5" />
              Gestión de Usuarios y Accesos
            </CardTitle>
            <CardDescription>
              Administra las cuentas de los usuarios del sistema, sus roles de acceso y contraseñas.
            </CardDescription>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" /> Registrar Usuario
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o usuario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 max-w-md"
              />
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Total usuarios: <span className="text-foreground">{filteredUsers.length}</span>
            </div>
          </div>

          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Usuario / Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol de Acceso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Cargando usuarios...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No se encontraron usuarios registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div>
                          {user.firstName || ''} {user.lastName || ''}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          @{user.username || (user.email ? user.email.split('@')[0] : user.id?.slice(0, 8) || 'usuario')}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{user.email || 'Sin correo'}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-xs font-medium">
                          {user.isActive ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">
                              <CheckCircle className="h-3 w-3 mr-1" /> Activo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">
                              <XCircle className="h-3 w-3 mr-1" /> Inactivo
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Opciones de Cuenta</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setEditingUser(user)} className="gap-2 cursor-pointer">
                              <Edit className="h-4 w-4 text-blue-600" /> Editar Perfil y Rol
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setResetEmailUser(user)} className="gap-2 cursor-pointer">
                              <Key className="h-4 w-4 text-amber-600" /> Restablecer Contraseña
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(user)} className="gap-2 cursor-pointer">
                              {user.isActive ? (
                                <>
                                  <XCircle className="h-4 w-4 text-orange-600" /> Desactivar Acceso
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 text-emerald-600" /> Activar Acceso
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeletingUser(user)} className="gap-2 text-destructive cursor-pointer">
                              <Trash2 className="h-4 w-4" /> Eliminar Usuario
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Role Access Matrix Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" /> Matriz de Permisos por Rol
          </CardTitle>
          <CardDescription>
            Resumen de privilegios y módulos habilitados según el perfil asignado a cada usuario.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border bg-purple-50/50 dark:bg-purple-950/10 space-y-2">
              <div className="flex items-center gap-2 font-bold text-purple-700 dark:text-purple-300">
                <ShieldCheck className="h-5 w-5" /> Administrador (Admin)
              </div>
              <p className="text-xs text-muted-foreground">
                Control absoluto sobre la plataforma, incluyendo configuraciones críticas.
              </p>
              <ul className="text-xs space-y-1 list-disc list-inside text-foreground/80 pt-2">
                <li>Gestión de Usuarios y Roles</li>
                <li>Inventario, Cotizaciones y Órdenes</li>
                <li>Clientes, Proveedores e Importaciones</li>
                <li>PIN Maestro y Preferencias del Sistema</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-950/10 space-y-2">
              <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-300">
                <ShoppingBag className="h-5 w-5" /> Ventas (Sales)
              </div>
              <p className="text-xs text-muted-foreground">
                Perfil comercial para operaciones diarias de facturación y cotizaciones.
              </p>
              <ul className="text-xs space-y-1 list-disc list-inside text-foreground/80 pt-2">
                <li>Crear y Emitir Cotizaciones</li>
                <li>Procesar Órdenes de Venta</li>
                <li>Administrar Catálogo de Productos</li>
                <li>Gestión de Clientes y Proveedores</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-900/50 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                <Eye className="h-5 w-5" /> Observador (Viewer)
              </div>
              <p className="text-xs text-muted-foreground">
                Perfil de consulta de métricas y existencias de almacén sin edición.
              </p>
              <ul className="text-xs space-y-1 list-disc list-inside text-foreground/80 pt-2">
                <li>Ver Dashboard y Reportes Generales</li>
                <li>Consultar Catálogo de Productos y Stock</li>
                <li>Ver Histórico de Cotizaciones</li>
                <li>Sin permisos de creación o borrado</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateUserDialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />

      <EditUserDialog
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        user={editingUser}
      />

      {/* Reset Password Dialog */}
      <Dialog open={!!resetEmailUser} onOpenChange={() => setResetEmailUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-600" /> Restablecer Contraseña
            </DialogTitle>
            <DialogDescription>
              Se enviará un correo electrónico a <strong>{resetEmailUser?.email}</strong> con las instrucciones y un enlace seguro para definir una nueva contraseña.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setResetEmailUser(null)} disabled={isSendingReset}>
              Cancelar
            </Button>
            <Button onClick={handleSendResetEmail} disabled={isSendingReset} className="gap-2 bg-amber-600 hover:bg-amber-700">
              {isSendingReset ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {isSendingReset ? 'Enviando...' : 'Enviar Correo de Recuperación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" /> Confirmar Eliminación de Usuario
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar la cuenta de <strong>{deletingUser?.firstName} {deletingUser?.lastName}</strong> ({deletingUser?.email})? Esta acción removerá el perfil del sistema.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeletingUser(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting} className="gap-2">
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isDeleting ? 'Eliminando...' : 'Eliminar Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
