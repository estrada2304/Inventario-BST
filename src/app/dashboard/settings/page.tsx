'use client';

import React from 'react';
import { SecuritySettings } from '@/components/settings/security-settings';
import { UsersManagement } from '@/components/settings/users-management';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/theme-toggle';
import { Settings, Palette, Users, ShieldCheck } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración del Sistema</h1>
        <p className="text-muted-foreground">
          Gestión de usuarios, asignación de roles, contraseñas, PIN de seguridad y apariencia.
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" /> Usuarios y Roles
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <ShieldCheck className="h-4 w-4" /> PIN Maestro
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4" /> Apariencia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersManagement />
        </TabsContent>

        <TabsContent value="security">
          <SecuritySettings />
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Palette className="h-5 w-5" />
                Apariencia y Tema
              </CardTitle>
              <CardDescription>
                Personaliza el modo visual (claro u oscuro) para adaptarlo a tus preferencias de trabajo.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-medium text-sm">Tema de Interfaz</div>
                <div className="text-xs text-muted-foreground">
                  Alternar entre modo claro, oscuro o automático según la configuración de tu sistema.
                </div>
              </div>
              <ThemeToggle />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


