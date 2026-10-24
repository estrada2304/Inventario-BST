'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/lib/types';
import { runTransaction, doc, collection, serverTimestamp } from 'firebase/firestore';
import { Loader2, ArrowDownLeft, ArrowUpRight, SlidersHorizontal, AlertCircle, CheckCircle2, UserCheck } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface AddStockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product;
}

const formSchema = z.object({
  type: z.enum(['entry', 'exit', 'adjustment']),
  quantity: z.coerce.number().int().min(1, 'La cantidad debe ser al menos 1 unidad.'),
  notes: z.string().optional(),
});

type StockFormValues = z.infer<typeof formSchema>;

export function AddStockDialog({ isOpen, onClose, product }: AddStockDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const form = useForm<StockFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'entry',
      quantity: 1,
      notes: '',
    },
  });

  const selectedType = form.watch('type');
  const enteredQty = Number(form.watch('quantity')) || 0;

  // Reset form when dialog opens with product
  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        type: 'entry',
        quantity: 1,
        notes: '',
      });
    }
  }, [isOpen, form]);

  const currentStock = product?.stock ?? product?.quantity ?? 0;

  // Real-time stock calculation & subtraction verification
  const { resultingStock, isNegativeStock, deltaQuantity } = React.useMemo(() => {
    let result = currentStock;
    let isNeg = false;
    let delta = enteredQty;

    if (selectedType === 'entry') {
      result = currentStock + enteredQty;
      delta = enteredQty;
    } else if (selectedType === 'exit') {
      result = currentStock - enteredQty;
      delta = -enteredQty;
      if (result < 0) {
        isNeg = true;
      }
    } else if (selectedType === 'adjustment') {
      result = enteredQty;
      delta = enteredQty - currentStock;
      if (result < 0) {
        isNeg = true;
      }
    }

    return {
      resultingStock: result,
      isNegativeStock: isNeg,
      deltaQuantity: delta,
    };
  }, [currentStock, selectedType, enteredQty]);

  const currentUserName = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Administrador');

  const onSubmit = async (values: StockFormValues) => {
    if (!firestore || !product || !user) return;

    if (values.type === 'exit' && values.quantity > currentStock) {
      toast({
        variant: 'destructive',
        title: 'Resta Inválida',
        description: `No puedes descontar ${values.quantity} unidades porque el stock actual es de solo ${currentStock} unidades.`,
      });
      return;
    }

    setIsLoading(true);

    try {
      await runTransaction(firestore, async (transaction) => {
        const productRef = doc(firestore, 'products', product.id);
        const productDoc = await transaction.get(productRef);

        if (!productDoc.exists()) {
          throw new Error('El producto no existe en el catálogo.');
        }

        const prodData = productDoc.data();
        const liveStock = Number(prodData.stock ?? prodData.quantity ?? 0);
        const liveTotalQty = Number(prodData.quantity ?? liveStock);

        let finalStock = liveStock;
        let finalTotalQty = liveTotalQty;
        let movementDelta = values.quantity;

        if (values.type === 'entry') {
          finalStock = liveStock + values.quantity;
          finalTotalQty = liveTotalQty + values.quantity;
          movementDelta = values.quantity;
        } else if (values.type === 'exit') {
          if (liveStock < values.quantity) {
            throw new Error(`Stock insuficiente al procesar. Stock disponible: ${liveStock}, a restar: ${values.quantity}.`);
          }
          finalStock = liveStock - values.quantity;
          // quantity (total histórico) se mantiene o actualiza según lógica de almacén
          finalTotalQty = Math.max(0, liveTotalQty - values.quantity);
          movementDelta = -values.quantity;
        } else if (values.type === 'adjustment') {
          finalStock = values.quantity;
          finalTotalQty = values.quantity;
          movementDelta = values.quantity - liveStock;
        }

        let newStatus: Product['status'] = 'In Stock';
        if (finalStock <= 0) newStatus = 'Out of Stock';
        else if (finalStock <= 5) newStatus = 'Low Stock';

        // Update product document
        transaction.update(productRef, {
          stock: finalStock,
          quantity: finalTotalQty,
          status: newStatus,
          updatedAt: serverTimestamp(),
        });

        const movementId = doc(collection(firestore, 'inventoryMovements')).id;
        const nowIso = new Date().toISOString();

        const movementData = {
          id: movementId,
          productId: product.id,
          productName: product.name || prodData.name || '',
          serialNumber: product.serialNumber || prodData.serialNumber || '',
          type: values.type,
          quantity: values.quantity,
          delta: movementDelta,
          previousStock: liveStock,
          newStock: finalStock,
          date: nowIso,
          notes: values.notes?.trim() || (values.type === 'entry' ? 'Entrada manual de stock' : values.type === 'exit' ? 'Salida/Resta manual de stock' : 'Ajuste manual de inventario'),
          userName: currentUserName,
          userEmail: user.email || '',
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        };

        // 1. Root collection for global history
        const rootMovementRef = doc(firestore, 'inventoryMovements', movementId);
        transaction.set(rootMovementRef, movementData);

        // 2. Subcollection inside product for product-specific view
        const subMovementRef = doc(firestore, `products/${product.id}/inventoryMovements`, movementId);
        transaction.set(subMovementRef, movementData);
      });

      const actionText =
        values.type === 'entry'
          ? `Se sumaron +${values.quantity} unidades`
          : values.type === 'exit'
          ? `Se restaron -${values.quantity} unidades`
          : `Stock fijado en ${values.quantity} unidades`;

      toast({
        title: 'Movimiento Registrado con Éxito',
        description: `${actionText} al producto "${product.name}". Nuevo stock: ${resultingStock}.`,
      });

      form.reset();
      onClose();
    } catch (error: any) {
      console.error('Error recording inventory movement:', error);
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: `products/${product.id}/inventoryMovements`,
          operation: 'update',
          requestResourceData: { stock: resultingStock },
        })
      );
      toast({
        variant: 'destructive',
        title: 'Error al actualizar inventario',
        description: error.message || 'No se pudo registrar el movimiento.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            Ajustar Stock / Registrar Movimiento
          </DialogTitle>
          <DialogDescription>
            Registra una entrada, salida (resta) o ajuste de inventario para <strong>{product.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Movement Type Selector */}
            <div className="space-y-1.5">
              <FormLabel className="text-xs font-semibold">Tipo de Movimiento</FormLabel>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => form.setValue('type', 'entry')}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                    selectedType === 'entry'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold ring-2 ring-emerald-500/20'
                      : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <ArrowDownLeft className="h-5 w-5 mb-1 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-medium">Entrada (+)</span>
                  <span className="text-[10px] text-muted-foreground">Ingreso / Compras</span>
                </button>

                <button
                  type="button"
                  onClick={() => form.setValue('type', 'exit')}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                    selectedType === 'exit'
                      ? 'border-red-600 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-semibold ring-2 ring-red-500/20'
                      : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <ArrowUpRight className="h-5 w-5 mb-1 text-red-600 dark:text-red-400" />
                  <span className="text-xs font-medium">Salida / Resta (-)</span>
                  <span className="text-[10px] text-muted-foreground">Merma / Uso interno</span>
                </button>

                <button
                  type="button"
                  onClick={() => form.setValue('type', 'adjustment')}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                    selectedType === 'adjustment'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold ring-2 ring-blue-500/20'
                      : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <SlidersHorizontal className="h-5 w-5 mb-1 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium">Ajuste Directo (=)</span>
                  <span className="text-[10px] text-muted-foreground">Conteo físico</span>
                </button>
              </div>
            </div>

            {/* Quantity Input */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">
                    {selectedType === 'entry'
                      ? 'Cantidad a Ingresar'
                      : selectedType === 'exit'
                      ? 'Cantidad a Restar / Descontar'
                      : 'Nuevo Stock Real Físico'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder="1"
                      className="h-10 text-base font-semibold"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Verification of Subtraction & Stock Math Card */}
            <div className="p-3.5 rounded-lg border bg-muted/40 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Verificación del Cálculo de Stock:</span>
                <span className="flex items-center gap-1 text-[11px] text-foreground font-medium">
                  <UserCheck className="h-3.5 w-3.5 text-primary" />
                  Registrado por: <strong>{currentUserName}</strong>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-1 pb-1">
                <div className="bg-background/80 p-2 rounded border">
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Stock Actual</div>
                  <div className="text-sm font-bold text-foreground font-mono">
                    {currentStock} {product.unit || 'uds'}
                  </div>
                </div>

                <div className="bg-background/80 p-2 rounded border flex flex-col justify-center">
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    {selectedType === 'entry' ? 'Añadir' : selectedType === 'exit' ? 'Restar' : 'Ajustar'}
                  </div>
                  <div
                    className={`text-sm font-bold font-mono ${
                      selectedType === 'entry'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : selectedType === 'exit'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {selectedType === 'entry' ? `+${enteredQty}` : selectedType === 'exit' ? `-${enteredQty}` : `-> ${enteredQty}`}
                  </div>
                </div>

                <div
                  className={`p-2 rounded border ${
                    isNegativeStock
                      ? 'bg-destructive/10 border-destructive text-destructive'
                      : 'bg-background/80 text-foreground'
                  }`}
                >
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Stock Resultante</div>
                  <div className="text-sm font-bold font-mono">
                    {isNegativeStock ? 'Inválido (<0)' : `${resultingStock} ${product.unit || 'uds'}`}
                  </div>
                </div>
              </div>

              {/* Subtraction error warning if quantity exceeds stock */}
              {isNegativeStock && (
                <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Resta no permitida:</strong> Estás intentando restar {enteredQty} unidades, pero solo hay {currentStock} en existencias.
                  </div>
                </div>
              )}

              {!isNegativeStock && selectedType === 'exit' && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Resta verificada: Se descontarán {enteredQty} unidades. Quedarán {resultingStock} disponibles.
                  </span>
                </div>
              )}
            </div>

            {/* Notes / Reason Field */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">
                    Motivo / Referencia del Movimiento (Recomendado)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={
                        selectedType === 'entry'
                          ? 'Ej: Recepción de pedido importación #IMP-001, lote nuevo'
                          : selectedType === 'exit'
                          ? 'Ej: Merma por daño en traslado, retiro para prueba técnica'
                          : 'Ej: Conteo físico mensual de almacén'
                      }
                      className="resize-none h-18 text-xs"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading || isNegativeStock || enteredQty <= 0}
                className={
                  selectedType === 'exit'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : selectedType === 'entry'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : ''
                }
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedType === 'entry'
                  ? 'Confirmar Entrada (+)'
                  : selectedType === 'exit'
                  ? 'Confirmar Salida / Resta (-)'
                  : 'Guardar Ajuste'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
