'use client';

import * as React from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useUser } from '@/firebase';
import { doc, updateDoc, serverTimestamp, runTransaction, collection, getDocs, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Quote, Product, Order } from '@/lib/types';
import { Loader2, Download, Check, X, Mail } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { format } from 'date-fns';
import { GmailComposerDialog } from '@/components/gmail/gmail-composer-dialog';

interface QuoteDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  quote?: Quote;
}

const formatCurrency = (amount: number, currency: string = 'USD') => {
  const curr = currency === 'VES' ? 'VES' : 'USD';
  return new Intl.NumberFormat(curr === 'USD' ? 'en-US' : 'es-VE', {
    style: 'currency',
    currency: curr,
  }).format(amount);
};

const statusTextMap: Record<string, string> = {
    'Draft': 'Borrador',
    'Sent': 'Enviada',
    'Accepted': 'Aceptada',
    'Rejected': 'Rechazada',
    'Cancelled': 'Cancelada',
    'Borrador': 'Borrador',
    'Enviada': 'Enviada',
    'Aprobada': 'Aprobada',
    'Rechazada': 'Rechazada',
};

const statusVariantMap: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    'Accepted': 'default',
    'Aprobada': 'default',
    'Sent': 'secondary',
    'Enviada': 'secondary',
    'Draft': 'outline',
    'Borrador': 'outline',
    'Rejected': 'destructive',
    'Rechazada': 'destructive',
    'Cancelled': 'destructive',
};

export function QuoteDetailsDialog({ isOpen, onClose, quote }: QuoteDetailsDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [isGmailComposerOpen, setIsGmailComposerOpen] = React.useState(false);

  const handleDownloadPdf = async () => {
    const input = document.getElementById('printable-quote-content');
    if (!input || !quote) return;

    setIsDownloading(true);

    try {
      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const contentWidth = canvas.width;
      const contentHeight = canvas.height;
      const ratio = contentWidth / contentHeight;

      let imgWidth = pdfWidth - 40; 
      let imgHeight = imgWidth / ratio;
      
      if (imgHeight > pdfHeight - 40) {
        imgHeight = pdfHeight - 40;
        imgWidth = imgHeight * ratio;
      }

      const x = (pdfWidth - imgWidth) / 2;
      const y = 20;

      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      pdf.save(`Cotizacion-BST-${quote.quoteNumber}.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        toast({
            variant: "destructive",
            title: "Error al generar PDF",
            description: "No se pudo crear el archivo PDF. Inténtalo de nuevo."
        });
    } finally {
        setIsDownloading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: Quote['status']) => {
    if (!firestore || !quote || !user) return;
    setIsUpdating(true);

    const oldStatus = quote.status;
    const quoteRef = doc(firestore, 'quotes', quote.id);
    
    try {
        let shouldDownload = false;
        const currentUserName = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Ventas');
        const nowIso = new Date().toISOString();

        if (newStatus === 'Accepted' && oldStatus !== 'Accepted') {
             await runTransaction(firestore, async (transaction) => {
                // READ PHASE
                const productQuantities = new Map<string, { name: string; quantity: number }>();
                for (const item of (quote.items || [])) {
                    if (!item.productId) continue;
                    const existing = productQuantities.get(item.productId);
                    if (existing) {
                        existing.quantity += Number(item.quantity) || 0;
                    } else {
                        productQuantities.set(item.productId, {
                            name: item.name || '',
                            quantity: Number(item.quantity) || 0,
                        });
                    }
                }

                const productUpdates: { ref: any; newStock: number; status: Product['status']; productId: string; prodName: string; serialNumber: string; prevStock: number; qty: number }[] = [];

                for (const [productId, info] of productQuantities.entries()) {
                    const productRef = doc(firestore, 'products', productId);
                    const productDoc = await transaction.get(productRef);
                    if (!productDoc.exists()) {
                        throw new Error(`El producto "${info.name}" no fue encontrado en el inventario.`);
                    }
                    
                    const prodData = productDoc.data();
                    const currentStock = Number(prodData.stock) || 0;
                    const newStock = currentStock - info.quantity;

                    if (newStock < 0) {
                        throw new Error(`Stock insuficiente para "${info.name}". Stock actual: ${currentStock}, se requieren ${info.quantity}.`);
                    }

                    let newProductStatus: Product['status'] = 'In Stock';
                    if (newStock <= 0) {
                        newProductStatus = 'Out of Stock';
                    } else if (newStock <= 5) {
                        newProductStatus = 'Low Stock';
                    }
                    
                    productUpdates.push({
                      ref: productRef,
                      newStock,
                      status: newProductStatus,
                      productId,
                      prodName: prodData.name || info.name,
                      serialNumber: prodData.serialNumber || '',
                      prevStock: currentStock,
                      qty: info.quantity,
                    });
                }

                // WRITE PHASE
                for (const update of productUpdates) {
                    transaction.update(update.ref, { stock: update.newStock, status: update.status, updatedAt: serverTimestamp() });

                    // Record movement exit
                    const movementId = doc(collection(firestore, 'inventoryMovements')).id;
                    const movementData = {
                      id: movementId,
                      productId: update.productId,
                      productName: update.prodName,
                      serialNumber: update.serialNumber,
                      type: 'exit',
                      quantity: update.qty,
                      delta: -update.qty,
                      previousStock: update.prevStock,
                      newStock: update.newStock,
                      date: nowIso,
                      notes: `Cotización Aceptada #${quote.quoteNumber} - Cliente: ${quote.customer?.name || 'Cliente'}`,
                      userName: currentUserName,
                      userEmail: user?.email || '',
                      createdBy: user?.uid || '',
                      createdAt: serverTimestamp(),
                    };
                    transaction.set(doc(firestore, 'inventoryMovements', movementId), movementData);
                    transaction.set(doc(firestore, `products/${update.productId}/inventoryMovements`, movementId), movementData);
                }

                const orderRef = doc(collection(firestore, 'orders'));
                const newOrderData: Record<string, any> = {
                    id: orderRef.id,
                    orderNumber: `ORD-${quote.quoteNumber}`,
                    quoteId: quote.id,
                    quoteNumber: quote.quoteNumber,
                    customer: quote.customer,
                    items: (quote.items || []).map(item => ({
                        productId: item.productId || '',
                        name: item.name || '',
                        description: item.description || '',
                        quantity: Number(item.quantity) || 1,
                        price: Number(item.price) || 0
                    })),
                    amount: Number(quote.amount) || 0,
                    status: 'Processing',
                    date: format(new Date(), 'yyyy-MM-dd'),
                    currency: quote.currency || 'USD',
                    notes: `Generada automáticamente desde Cotización ${quote.quoteNumber || ''}. ${quote.notes || ''}`.trim(),
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    createdByName: user?.displayName || (user?.email ? user.email.split('@')[0] : 'Sistema'),
                    createdByEmail: user.email || '',
                };
                transaction.set(orderRef, newOrderData);
                transaction.update(quoteRef, { status: newStatus, orderId: orderRef.id, updatedAt: serverTimestamp() });
            });

            toast({
                title: 'Cotización Aceptada',
                description: 'El stock ha sido descontado y se ha generado la orden de venta en estado "En Proceso". El PDF se descargará automáticamente.',
            });
            shouldDownload = true;
        } 
        else if (newStatus !== 'Accepted' && oldStatus === 'Accepted') {
            // Find linked orders before transaction
            const linkedOrderIds: string[] = [];
            if (quote.orderId) {
                linkedOrderIds.push(quote.orderId);
            }
            try {
                const qSnap = await getDocs(query(collection(firestore, 'orders'), where('quoteId', '==', quote.id)));
                qSnap.forEach(d => {
                    if (!linkedOrderIds.includes(d.id)) linkedOrderIds.push(d.id);
                });
            } catch (e) {
                console.error("Error looking up linked orders:", e);
            }

            await runTransaction(firestore, async (transaction) => {
                // READ PHASE
                const productQuantities = new Map<string, { name: string; quantity: number }>();
                for (const item of (quote.items || [])) {
                    if (!item.productId) continue;
                    const existing = productQuantities.get(item.productId);
                    if (existing) {
                        existing.quantity += Number(item.quantity) || 0;
                    } else {
                        productQuantities.set(item.productId, {
                            name: item.name || '',
                            quantity: Number(item.quantity) || 0,
                        });
                    }
                }

                const productUpdates: { ref: any; newStock: number; status: Product['status']; productId: string; prodName: string; serialNumber: string; prevStock: number; qty: number }[] = [];

                for (const [productId, info] of productQuantities.entries()) {
                    const productRef = doc(firestore, 'products', productId);
                    const productDoc = await transaction.get(productRef);
                    
                    if (productDoc.exists()) {
                        const prodData = productDoc.data();
                        const currentStock = Number(prodData.stock) || 0;
                        const newStock = currentStock + info.quantity;
                        
                        let newProductStatus: Product['status'] = 'In Stock';
                        if (newStock > 0 && newStock <= 5) {
                            newProductStatus = 'Low Stock';
                        } else if (newStock <= 0) {
                            newProductStatus = 'Out of Stock';
                        }
                        
                        productUpdates.push({
                          ref: productRef,
                          newStock,
                          status: newProductStatus,
                          productId,
                          prodName: prodData.name || info.name,
                          serialNumber: prodData.serialNumber || '',
                          prevStock: currentStock,
                          qty: info.quantity,
                        });
                    }
                }

                // WRITE PHASE
                for (const update of productUpdates) {
                    transaction.update(update.ref, { stock: update.newStock, status: update.status, updatedAt: serverTimestamp() });

                    // Record movement entry (reversion)
                    const movementId = doc(collection(firestore, 'inventoryMovements')).id;
                    const movementData = {
                      id: movementId,
                      productId: update.productId,
                      productName: update.prodName,
                      serialNumber: update.serialNumber,
                      type: 'entry',
                      quantity: update.qty,
                      delta: update.qty,
                      previousStock: update.prevStock,
                      newStock: update.newStock,
                      date: nowIso,
                      notes: `Reversión por cambio de estado en Cotización #${quote.quoteNumber}`,
                      userName: currentUserName,
                      userEmail: user?.email || '',
                      createdBy: user?.uid || '',
                      createdAt: serverTimestamp(),
                    };
                    transaction.set(doc(firestore, 'inventoryMovements', movementId), movementData);
                    transaction.set(doc(firestore, `products/${update.productId}/inventoryMovements`, movementId), movementData);
                }

                // Remove linked order from Orders section
                for (const orderId of linkedOrderIds) {
                    transaction.delete(doc(firestore, 'orders', orderId));
                }

                transaction.update(quoteRef, { status: newStatus, orderId: null, updatedAt: serverTimestamp() });
            });
            toast({
                title: 'Cambio de Estado de Cotización',
                description: 'El stock ha sido devuelto al inventario y la orden vinculada fue retirada de la sección Órdenes.',
            });
        }
        else {
            await updateDoc(quoteRef, {
                status: newStatus,
                updatedAt: serverTimestamp(),
            });
            toast({
              title: 'Estado de la Cotización Actualizado',
              description: `La cotización ahora está en estado: ${statusTextMap[newStatus]}.`,
            });
            if (newStatus === 'Sent') {
              setIsGmailComposerOpen(true);
              setIsUpdating(false);
              return;
            }
        }
        
        if (shouldDownload) {
            await handleDownloadPdf();
        }

        onClose();

    } catch (error: any) {
      console.error("Error updating quote status:", error);
      const description = error.message || 'No se pudo actualizar el estado de la cotización.';
      
      if (error?.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: quoteRef.path,
            operation: 'update',
            requestResourceData: { status: newStatus }
        }));
      } else {
        toast({
            variant: 'destructive',
            title: 'Error al Actualizar',
            description: description,
        });
      }
    } finally {
      setIsUpdating(false);
    }
  };


  if (!quote) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Detalles de la Cotización {quote.quoteNumber}</DialogTitle>
          <DialogDescription>
            Vista detallada de la cotización, incluyendo cliente, productos, y totales.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[90vh]">
        <div id="printable-quote-content" className="bg-background p-8 rounded-lg">

            <div className="flex justify-between items-start mb-8">
                <div className="space-y-1">
                    <img src="/bst-logo.png" alt="BST Logo" style={{ width: '120px', height: 'auto' }} className="rounded-sm mb-2" />
                    <h2 className="text-xl font-bold">Byte Services Telecom</h2>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                        Calle El Arenal, Quinta la Gonzalera,<br />
                        Zona Industrial de La Trinidad, Caracas,<br />
                        Miranda, Zona Postal 1080<br />
                        <span className="mt-1 block font-medium">
                          Omar Ramirez: +58 426-5130004<br />
                          Alexis Bruzual: +507 6905-9317
                        </span>
                    </p>
                </div>
                <div className="text-right">
                    <h1 className="text-sm font-bold uppercase text-primary tracking-wider mb-1">Cotización</h1>
                    <p className="text-sm"><span className="font-semibold text-muted-foreground">N°:</span> {quote.quoteNumber}</p>
                    <p className="text-sm"><span className="font-semibold text-muted-foreground">Fecha:</span> {quote.date}</p>
                    <Badge variant={statusVariantMap[quote.status]} className="mt-2 text-sm px-3 py-0.5">{statusTextMap[quote.status]}</Badge>
                </div>
            </div>

            <div className="mb-8">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Cliente</h3>
                <div className="p-4 border rounded-md bg-muted/20 text-sm">
                    <p className="font-bold text-base">{quote.customer.company || quote.customer.name}</p>
                    {quote.customer.company && <p className="text-muted-foreground">{quote.customer.name}</p>}
                    {quote.customer.address && <p className="text-muted-foreground mt-1">Dirección: {quote.customer.address}</p>}
                </div>
            </div>
          
            <div>
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="w-1/2">Producto / Descripción</TableHead>
                    <TableHead className="text-center">Cantidad</TableHead>
                    <TableHead className="text-right">Precio Unitario</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quote.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="font-bold text-sm text-foreground">{item.name}</div>
                        {item.description && (
                            <div className="text-[11px] text-muted-foreground font-normal mt-1 leading-snug max-w-md">
                                {item.description}
                            </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.price, quote.currency)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.price * item.quantity, quote.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex justify-end mt-6">
                <div className="w-full max-w-xs space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium">{formatCurrency(quote.subtotal ?? quote.amount, quote.currency)}</span>
                    </div>
                    {((quote.ivaAmount ?? 0) > 0) && (
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">IVA (16%)</span>
                            <span className="font-medium">{formatCurrency(quote.ivaAmount ?? 0, quote.currency)}</span>
                        </div>
                    )}
                    {((quote.igtfAmount ?? 0) > 0) && (
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">IGTF (3%)</span>
                            <span className="font-medium">{formatCurrency(quote.igtfAmount ?? 0, quote.currency)}</span>
                        </div>
                    )}
                    <Separator className="my-2" />
                    <div className="flex justify-between items-center text-lg font-bold text-primary border-t border-primary pt-2 mt-2">
                        <span>TOTAL</span>
                        <span>{formatCurrency(quote.amount, quote.currency)}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                <div className="space-y-6">
                    {quote.notes && (
                        <div>
                            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2 border-b pb-1">Notas Adicionales</h3>
                            <div className="text-xs text-muted-foreground p-3 border rounded-md whitespace-pre-wrap bg-muted/20">
                                {quote.notes}
                            </div>
                        </div>
                    )}
                </div>
                <div className="space-y-6">
                    {quote.termsAndConditions && (
                        <div>
                            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2 border-b pb-1">Términos y Condiciones</h3>
                            <div className="text-[10px] text-muted-foreground p-3 border rounded-md whitespace-pre-wrap bg-muted/20">
                                {quote.termsAndConditions}
                            </div>
                        </div>
                    )}
                    {quote.paymentMethods && (
                        <div>
                            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2 border-b pb-1">Métodos de Pago</h3>
                            <div className="text-[10px] text-muted-foreground p-3 border rounded-md whitespace-pre-wrap bg-muted/20">
                                {quote.paymentMethods}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-12 text-center text-sm font-medium text-primary italic">
                <p>Gracias por confiar en BST: Conectando su empresa con el futuro.</p>
            </div>

        </div>
        </ScrollArea>
        <DialogFooter className="p-4 border-t print-hidden">
          <div className="w-full flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloading}>
                  {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  {isDownloading ? 'Generando...' : 'Descargar PDF'}
              </Button>
              {quote && (
                <Button
                  variant="outline"
                  className="border-red-500/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => setIsGmailComposerOpen(true)}
                >
                  <Mail className="mr-2 h-4 w-4 text-red-500" />
                  Enviar por Gmail
                </Button>
              )}
              <Button variant="ghost" onClick={onClose}>Cerrar</Button>
            </div>
            <div className="flex gap-2">
                {(quote?.status === 'Draft' || quote?.status === 'Rejected') && (
                    <Button onClick={() => handleStatusUpdate('Sent')} disabled={isUpdating}>
                        {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Marcar como Enviada
                    </Button>
                )}
                {quote?.status === 'Sent' && (
                    <>
                    <Button onClick={() => handleStatusUpdate('Accepted')} disabled={isUpdating}>
                        {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                        Aceptar
                    </Button>
                    <Button variant="destructive" onClick={() => handleStatusUpdate('Rejected')} disabled={isUpdating}>
                        {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <X className="mr-2 h-4 w-4" />}
                        Rechazar
                    </Button>
                    </>
                )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>

      {quote && (
        <GmailComposerDialog
          isOpen={isGmailComposerOpen}
          onClose={() => {
            setIsGmailComposerOpen(false);
            onClose();
          }}
          defaultTo={quote.customer?.email || ''}
          defaultSubject={`Cotización #${quote.quoteNumber} - BST`}
          defaultBody={`Estimado(a) ${quote.customer?.name || 'Cliente'},\n\nLe enviamos adjunta la cotización #${quote.quoteNumber} solicitada.\n\n` +
            `Resumen de la Cotización:\n` +
            `- N° Cotización: #${quote.quoteNumber}\n` +
            `- Fecha: ${quote.date}\n` +
            `- Cliente: ${quote.customer?.name || 'N/A'} ${quote.customer?.company ? `(${quote.customer.company})` : ''}\n` +
            `- Monto Total: ${formatCurrency(quote.amount, quote.currency)}\n\n` +
            `Productos/Servicios:\n` +
            (Array.isArray(quote.items) ? quote.items.map(item => `  • ${item.name} x${item.quantity} - ${formatCurrency(item.price * item.quantity, quote.currency)}`).join('\n') : '') +
            `\n\nSi tiene alguna duda o consulta, por favor responda a este correo.\n\nAtentamente,\nEquipo BST`}
          title={`Enviar Cotización #${quote.quoteNumber} por Gmail`}
        />
      )}
    </Dialog>
  );
}
