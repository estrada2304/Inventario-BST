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
import { useFirestore, useUser } from '@/firebase';
import { doc, updateDoc, serverTimestamp, runTransaction, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Order, Product } from '@/lib/types';
import { Loader2, Download } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface OrderDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order?: Order;
}

const formatCurrency = (amount: number, currency: string = 'USD') => {
  const curr = currency === 'VES' ? 'VES' : 'USD';
  return new Intl.NumberFormat(curr === 'USD' ? 'en-US' : 'es-VE', {
    style: 'currency',
    currency: curr,
  }).format(amount);
};

const getStatusVariant = (status: Order['status']) => {
  switch (status) {
    case 'Completed':
    case 'Completado':
      return 'default';
    case 'Processing':
    case 'Procesando':
      return 'secondary';
    case 'Pending':
    case 'Pendiente':
      return 'outline';
    case 'Cancelled':
    case 'Cancelado':
      return 'destructive';
    default:
      return 'secondary';
  }
};

const getStatusText = (status: Order['status']) => {
  switch (status) {
    case 'Completed':
    case 'Completado':
      return 'Completado';
    case 'Processing':
    case 'Procesando':
      return 'Procesando';
    case 'Pending':
    case 'Pendiente':
      return 'Pendiente';
    case 'Cancelled':
    case 'Cancelado':
      return 'Cancelado';
    default:
      return 'Desconocido';
  }
};

export function OrderDetailsDialog({ isOpen, onClose, order }: OrderDetailsDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleDownloadPdf = async () => {
    const input = document.getElementById('printable-content');
    if (!input || !order) return;

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
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const ratio = canvasWidth / canvasHeight;

      let imgWidth = pdfWidth - 20;
      let imgHeight = imgWidth / ratio;

      if (imgHeight > pdfHeight - 20) {
          imgHeight = pdfHeight - 20;
          imgWidth = imgHeight * ratio;
      }

      const x = (pdfWidth - imgWidth) / 2;
      const y = 10;

      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      pdf.save(`Venta-BST-${order.id}.pdf`);
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

  const handleStatusUpdate = async (newStatus: Order['status']) => {
    if (!firestore || !order) return;
    setIsUpdating(true);

    const orderRef = doc(firestore, 'orders', order.id);
    
    try {
      const isCompleting = (newStatus === 'Completed' || newStatus === 'Completado') && 
                           (order.status !== 'Completed' && order.status !== 'Completado');
      if (isCompleting) {
        await runTransaction(firestore, async (transaction) => {
          const productDocs = new Map();
          for (const item of order.items) {
            const productRef = doc(firestore, 'products', item.productId);
            const productDoc = await transaction.get(productRef);
            if (!productDoc.exists()) {
              throw new Error(`El producto "${item.name}" (ID: ${item.productId}) no fue encontrado en el inventario.`);
            }
            productDocs.set(item.productId, productDoc);
          }

          const currentUserName = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Ventas');
          const nowIso = new Date().toISOString();

          for (const item of order.items) {
             const productDoc = productDocs.get(item.productId);
             const prodData = productDoc.data();
             const productRef = doc(firestore, 'products', item.productId);
             const currentStock = prodData.stock;
             const newStock = currentStock - item.quantity;
            
             if (newStock < 0) {
               throw new Error(`No hay suficiente stock para "${item.name}". Stock actual: ${currentStock}, se requieren: ${item.quantity}.`);
             }
             
             let newProductStatus: Product['status'];
             if (newStock <= 0) {
                newProductStatus = 'Out of Stock';
             } else if (newStock <= 5) {
                newProductStatus = 'Low Stock';
             } else {
                newProductStatus = 'In Stock';
             }
             
             transaction.update(productRef, { stock: newStock, status: newProductStatus, updatedAt: serverTimestamp() });

             const movementId = doc(collection(firestore, 'inventoryMovements')).id;
             const movementData = {
               id: movementId,
               productId: item.productId,
               productName: item.name || prodData.name || '',
               serialNumber: prodData.serialNumber || '',
               type: 'exit',
               quantity: item.quantity,
               delta: -item.quantity,
               previousStock: currentStock,
               newStock: newStock,
               date: nowIso,
               notes: `Venta Completada #${order.id.slice(0, 8)} - Cliente: ${order.customer?.name || 'Cliente'}`,
               userName: currentUserName,
               userEmail: user?.email || '',
               createdBy: user?.uid || '',
               createdAt: serverTimestamp(),
             };

             transaction.set(doc(firestore, 'inventoryMovements', movementId), movementData);
             transaction.set(doc(firestore, `products/${item.productId}/inventoryMovements`, movementId), movementData);
          }

          transaction.update(orderRef, {
            status: newStatus,
            updatedAt: serverTimestamp(),
          });
        });

        toast({
          title: 'Venta Completada y Stock Actualizado',
          description: 'El stock ha sido descontado del inventario exitosamente.',
        });
      } else {
        await updateDoc(orderRef, {
          status: newStatus,
          updatedAt: serverTimestamp(),
        });
        toast({
          title: 'Estado de la Venta Actualizado',
          description: `La venta ahora está en estado: ${getStatusText(newStatus)}.`,
        });
      }
      onClose();

    } catch (error: any) {
      console.error("Error updating order status:", error);
      const description = error.message || 'No se pudo actualizar el estado de la venta o el stock.';
      
      if (error?.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: orderRef.path,
            operation: 'update',
            requestResourceData: { status: newStatus }
        }));
      } else {
        toast({
          variant: 'destructive',
          title: 'Error en la Operación',
          description: description,
        });
      }
    } finally {
      setIsUpdating(false);
    }
  };


  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Detalles de la Venta {order.id}</DialogTitle>
          <DialogDescription>
            Vista detallada del pedido, incluyendo cliente, productos y totales.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[90vh]">
          <div id="printable-content" className="bg-background p-8 rounded-lg">
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
                <h1 className="text-sm font-bold uppercase text-primary tracking-wider mb-1">Nota de Venta</h1>
                <p className="text-sm"><span className="font-semibold text-muted-foreground">ID:</span> {order.id}</p>
                <p className="text-sm"><span className="font-semibold text-muted-foreground">Fecha:</span> {order.date}</p>
                <Badge variant={getStatusVariant(order.status)} className="mt-2 text-sm px-3 py-0.5">{getStatusText(order.status)}</Badge>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Cliente</h3>
              <div className="p-4 border rounded-md bg-muted/20 text-sm">
                <p className="font-bold text-base">{order.customer.company || order.customer.name}</p>
                {order.customer.company && <p className="text-muted-foreground">{order.customer.name}</p>}
                <p className="text-muted-foreground">{order.customer.taxId}</p>
                {order.customer.address && <p className="text-muted-foreground mt-1">Dirección: {order.customer.address}</p>}
              </div>
            </div>

            <div>
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="w-1/2">Producto / Descripción</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Precio Unitario</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="font-bold text-sm text-foreground">{item.name}</div>
                        {item.description && (
                            <div className="text-[11px] text-muted-foreground font-normal mt-1 leading-snug max-w-md">
                                {item.description}
                            </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.price, order.currency)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.price * item.quantity, order.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex justify-end pt-6">
                <div className="text-xl font-bold text-primary border-t border-primary pt-2">
                    Total: {formatCurrency(order.amount, order.currency)}
                </div>
            </div>

            {order.notes && (
              <div className="mt-8">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Notas</h3>
                <p className="text-xs text-muted-foreground p-3 border rounded-md whitespace-pre-wrap bg-muted/20">
                  {order.notes}
                </p>
              </div>
            )}

            <div className="mt-12 text-center text-xs text-muted-foreground">
                <p>Gracias por su preferencia.</p>
                <p>Byte Services Telecom</p>
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
              <Button variant="ghost" onClick={onClose} disabled={isUpdating}>Cerrar</Button>
            </div>
            <div className="flex gap-2">
                {(order.status === 'Pending' || order.status === 'Pendiente') && (
                    <Button onClick={() => handleStatusUpdate('Processing')} disabled={isUpdating}>
                        {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Marcar como Procesando
                    </Button>
                )}
                {(order.status === 'Processing' || order.status === 'Procesando') && (
                    <Button onClick={() => handleStatusUpdate('Completed')} disabled={isUpdating}>
                        {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Marcar como Completado
                    </Button>
                )}
                 {(order.status === 'Pending' || order.status === 'Pendiente' || order.status === 'Processing' || order.status === 'Procesando') && (
                    <Button variant="destructive" onClick={() => handleStatusUpdate('Cancelled')} disabled={isUpdating}>
                        {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Cancelar Venta
                    </Button>
                )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
