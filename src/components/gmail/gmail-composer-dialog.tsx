'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  connectGmailAccount,
  getGmailAccessToken,
  sendGmailMessage,
  getGmailProfile,
} from '@/lib/gmail';
import { Mail, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface GmailComposerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  title?: string;
  onSentSuccess?: () => void;
}

export function GmailComposerDialog({
  isOpen,
  onClose,
  defaultTo = '',
  defaultSubject = '',
  defaultBody = '',
  title = 'Enviar Correo por Gmail',
  onSentSuccess,
}: GmailComposerDialogProps) {
  const auth = useAuth();
  const { toast } = useToast();

  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [cc, setCc] = useState('');
  const [showCc, setShowCc] = useState(false);

  const [isConnected, setIsConnected] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTo(defaultTo);
      setSubject(defaultSubject);
      setBody(defaultBody);
      checkConnection();
    }
  }, [isOpen, defaultTo, defaultSubject, defaultBody]);

  const checkConnection = async () => {
    const token = getGmailAccessToken();
    if (token) {
      const profile = await getGmailProfile(token);
      if (profile?.emailAddress) {
        setIsConnected(true);
        setUserEmail(profile.emailAddress);
        return;
      }
    }
    setIsConnected(false);
    setUserEmail(null);
  };

  const handleConnect = async () => {
    if (!auth) return;
    setIsConnecting(true);
    try {
      const { accessToken } = await connectGmailAccount(auth);
      const profile = await getGmailProfile(accessToken);
      setIsConnected(true);
      setUserEmail(profile?.emailAddress || 'Cuenta Conectada');
      toast({
        title: 'Gmail Conectado',
        description: `Se ha vinculado la cuenta ${profile?.emailAddress || ''} correctamente.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error de Conexión',
        description: error.message || 'No se pudo conectar con tu cuenta de Gmail.',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSendClick = () => {
    if (!to || !to.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campo Requerido',
        description: 'Por favor ingresa un correo electrónico de destino.',
      });
      return;
    }
    if (!subject || !subject.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campo Requerido',
        description: 'Por favor ingresa el asunto del correo.',
      });
      return;
    }
    setShowConfirm(true);
  };

  const confirmAndSend = async () => {
    setShowConfirm(false);
    setIsSending(true);

    try {
      await sendGmailMessage({
        to,
        subject,
        body: body.replace(/\n/g, '<br/>'),
        cc: showCc && cc ? cc : undefined,
      });

      toast({
        title: 'Correo Enviado con Éxito',
        description: `El correo fue enviado a ${to} utilizando tu cuenta de Gmail.`,
      });

      if (onSentSuccess) {
        onSentSuccess();
      }

      onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al enviar correo',
        description: error.message || 'Ocurrió un problema al enviar el mensaje por Gmail.',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <Mail className="h-5 w-5 text-red-500" />
                {title}
              </DialogTitle>
              {isConnected && userEmail ? (
                <Badge variant="outline" className="flex items-center gap-1.5 border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="max-w-[160px] truncate">{userEmail}</span>
                </Badge>
              ) : (
                <Badge variant="secondary" className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  No Conectado
                </Badge>
              )}
            </div>
            <DialogDescription>
              Envía la cotización o mensaje directamente al cliente mediante tu cuenta oficial de Gmail.
            </DialogDescription>
          </DialogHeader>

          {!isConnected ? (
            <div className="my-6 flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center bg-muted/20">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 mb-3">
                <Mail className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Autorizar Cuenta de Gmail</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                Para enviar cotizaciones por correo directamente al cliente, autoriza tu cuenta de Google Gmail.
              </p>

              <button
                type="button"
                onClick={handleConnect}
                disabled={isConnecting}
                className="inline-flex items-center justify-center gap-3 rounded-md bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-700"
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M24 12.276c0-.816-.073-1.638-.22-2.428H12v4.597h6.732c-.29 1.562-1.168 2.888-2.483 3.77v3.132h4.02c2.353-2.164 3.731-5.352 3.731-9.071z"
                    />
                    <path
                      fill="#4285F4"
                      d="M12 24c3.24 0 5.957-1.075 7.942-2.915l-4.02-3.132c-1.074.72-2.448 1.147-3.922 1.147-3.018 0-5.572-2.039-6.483-4.783H1.365v3.22C3.35 21.468 7.378 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.517 14.317c-.23-.69-.362-1.428-.362-2.317 0-.889.132-1.627.362-2.317V6.463H1.365C.495 8.2 0 10.043 0 12s.495 3.8 1.365 5.537l4.152-3.22z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 4.75c1.763 0 3.348.607 4.593 1.793l3.445-3.445C17.952 1.25 15.235 0 12 0 7.378 0 3.35 2.532 1.365 6.463l4.152 3.22c.911-2.744 3.465-4.783 6.483-4.783z"
                    />
                  </svg>
                )}
                <span>Conectar con Google Gmail</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="gmail-to">Para (Destinatario)</Label>
                  {!showCc && (
                    <button
                      type="button"
                      onClick={() => setShowCc(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      + Añadir CC
                    </button>
                  )}
                </div>
                <Input
                  id="gmail-to"
                  placeholder="cliente@ejemplo.com"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>

              {showCc && (
                <div className="space-y-1.5">
                  <Label htmlFor="gmail-cc">Con Copia (CC)</Label>
                  <Input
                    id="gmail-cc"
                    placeholder="copia@ejemplo.com"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="gmail-subject">Asunto</Label>
                <Input
                  id="gmail-subject"
                  placeholder="Cotización o Mensaje Importante"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gmail-body">Mensaje</Label>
                <Textarea
                  id="gmail-body"
                  rows={8}
                  placeholder="Escribe el contenido del mensaje aquí..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="font-mono text-sm leading-relaxed"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={onClose} disabled={isSending}>
              Cancelar
            </Button>
            {isConnected && (
              <Button
                onClick={handleSendClick}
                disabled={isSending}
                className="bg-red-600 hover:bg-red-700 text-white gap-2"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>Enviar por Gmail</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-red-500" />
              Confirmar envío de correo
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 pt-2 text-foreground text-sm">
                <p>
                  ¿Estás seguro de que deseas enviar este correo al cliente mediante tu cuenta de Gmail?
                </p>
                <div className="rounded-lg bg-muted p-3 text-xs space-y-1.5 text-muted-foreground border">
                  <div>
                    <strong className="text-foreground">Para:</strong> {to}
                  </div>
                  {cc && (
                    <div>
                      <strong className="text-foreground">CC:</strong> {cc}
                    </div>
                  )}
                  <div>
                    <strong className="text-foreground">Asunto:</strong> {subject}
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAndSend}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Sí, enviar mensaje
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
