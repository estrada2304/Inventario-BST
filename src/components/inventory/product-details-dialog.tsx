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
import type { Product } from '@/lib/types';
import { Loader2, Download, Package, Component, FileText, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { InventoryMovements } from './inventory-movements';
import { useCurrentUser } from '@/hooks/use-current-user';

interface ProductDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product;
  onViewImage?: (product: Product) => void;
}

const formatCurrency = (amount: number, currency: 'USD' | 'VES' = 'USD') => {
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-VE', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

const getStatusVariant = (status: Product['status']) => {
    switch (status) {
        case 'In Stock': return 'default';
        case 'Low Stock': return 'secondary';
        case 'Out of Stock': return 'destructive';
        default: return 'secondary';
    }
}
const getStatusText = (status: Product['status']) => {
    switch (status) {
        case 'In Stock': return 'En Stock';
        case 'Low Stock': return 'Stock Bajo';
        case 'Out of Stock': return 'Sin Stock';
        default: return 'Desconocido';
    }
}

export function ProductDetailsDialog({ isOpen, onClose, product, onViewImage }: ProductDetailsDialogProps) {
  const { isAdmin } = useCurrentUser();
  const [isDownloading, setIsDownloading] = React.useState(false);
  const { toast } = useToast();

  const handleDownloadPdf = async () => {
    const input = document.getElementById('printable-product-content');
    if (!input || !product) return;

    setIsDownloading(true);
    
    const scrollViewport = input.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    const scrollArea = scrollViewport?.parentElement as HTMLElement | null;
    
    const originalScrollAreaStyle = scrollArea ? scrollArea.style.cssText : '';
    const originalScrollViewportStyle = scrollViewport ? scrollViewport.style.cssText : '';

    if (scrollArea) {
      scrollArea.style.height = 'auto';
      scrollArea.style.maxHeight = 'none';
    }
    if (scrollViewport) {
      scrollViewport.style.height = 'auto';
      scrollViewport.style.maxHeight = 'none';
      scrollViewport.style.overflow = 'visible';
    }

    try {
      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      });

      const imgData = canvas.toDataURL('image/png');
      const { width: canvasWidth, height: canvasHeight } = canvas;
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const margin = 20;
      const availableWidth = pdfWidth - (margin * 2);
      const availableHeight = pdfHeight - (margin * 2);

      const canvasAspectRatio = canvasWidth / canvasHeight;
      
      let finalImgWidth = availableWidth;
      let finalImgHeight = finalImgWidth / canvasAspectRatio;

      if (finalImgHeight > availableHeight) {
          finalImgHeight = availableHeight;
          finalImgWidth = finalImgHeight * canvasAspectRatio;
      }
      
      const x = (pdfWidth - finalImgWidth) / 2;
      const y = (pdfHeight - finalImgHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, finalImgWidth, finalImgHeight);
      pdf.save(`Ficha-Producto-BST-${product.id}.pdf`);
      
    } catch (error) {
        console.error("Error generating PDF:", error);
        toast({
            variant: "destructive",
            title: "Error al generar PDF",
            description: "No se pudo crear el archivo PDF. Inténtalo de nuevo."
        });
    } finally {
        if (scrollArea) scrollArea.style.cssText = originalScrollAreaStyle;
        if (scrollViewport) scrollViewport.style.cssText = originalScrollViewportStyle;
        setIsDownloading(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Detalles del Producto {product.name}</DialogTitle>
          <DialogDescription>
            Ficha técnica del producto, stock y movimientos de inventario.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[90vh]">
          <div id="printable-product-content" className="bg-background p-8 rounded-lg">
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
                <h1 className="text-sm font-bold uppercase text-primary tracking-wider mb-1">Ficha de Producto</h1>
                <p className="text-sm"><span className="font-semibold text-muted-foreground">ID:</span> {product.id}</p>
                <p className="text-sm"><span className="font-semibold text-muted-foreground">Serial:</span> {product.serialNumber}</p>
                <Badge variant={getStatusVariant(product.status)} className="mt-2 text-sm px-3 py-0.5">{getStatusText(product.status)}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div className="md:col-span-1">
                <button onClick={() => onViewImage?.(product)} className="block w-full">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="rounded-lg border object-cover aspect-square w-full"
                  />
                </button>
              </div>
              <div className="md:col-span-2 space-y-4">
                <h3 className="text-2xl font-bold text-primary">{product.name}</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div><span className="font-semibold text-muted-foreground">Unidad:</span> {product.unit}</div>
                    <div className="flex items-center gap-2"><span className="font-semibold text-muted-foreground">Tipo:</span> {product.isComposite ? <><Component className="h-4 w-4"/> Compuesto</> : <><Package className="h-4 w-4"/> Simple</>}</div>
                    <div><span className="font-semibold text-muted-foreground">Almacén:</span> {product.warehouse}</div>
                    <div><span className="font-semibold text-muted-foreground">Total Histórico:</span> <span className="font-bold">{product.quantity ?? product.stock ?? 0}</span></div>
                    <div className="col-span-2 sm:col-span-1"><span className="font-semibold text-muted-foreground">Total Real (Stock):</span> <span className="font-bold text-primary">{product.stock ?? product.quantity ?? 0}</span></div>
                    {product.createdAt && (
                      <div className="col-span-2">
                        <span className="font-semibold text-muted-foreground">Registrado:</span>{' '}
                        {typeof (product.createdAt as any)?.toDate === 'function'
                          ? format((product.createdAt as any).toDate(), 'dd/MM/yyyy HH:mm')
                          : String(product.createdAt)}
                      </div>
                    )}
                </div>
              </div>
            </div>

            {product.description && (
              <div className="mb-8">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Descripción</h3>
                <div className="p-4 border rounded-md bg-muted/20 text-sm whitespace-pre-wrap">
                  {product.description}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Precios de Venta</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-md bg-primary/5">
                    <p className="text-[10px] text-muted-foreground uppercase">Precio USD</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(product.retailPrice || 0, 'USD')}</p>
                  </div>
                  <div className="p-3 border rounded-md bg-secondary/5">
                    <p className="text-[10px] text-muted-foreground uppercase">Precio (BCV)</p>
                    <p className="text-lg font-bold text-secondary-foreground">{formatCurrency(product.bcvPrice || product.vesPrice || 0, 'VES')}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Costos (Incoterms)</h3>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {isAdmin ? (
                    <>
                      <div className="p-2 border rounded bg-muted/10">EXW: {formatCurrency(product.exw ?? 0)}</div>
                      <div className="p-2 border rounded bg-muted/10">FOB: {formatCurrency(product.fob ?? 0)}</div>
                      <div className="p-2 border rounded bg-primary/10 font-bold col-span-2 text-center">CIF: {formatCurrency(product.cif ?? 0)}</div>
                    </>
                  ) : (
                    <div className="p-4 border rounded bg-muted/10 col-span-2 text-center italic text-muted-foreground">
                      Información de costos restringida a administradores.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {product.datasheets && product.datasheets.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Documentos y Fichas Técnicas</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {product.datasheets.map((doc, index) => (
                        <a 
                            key={index} 
                            href={doc.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center p-3 border rounded-md hover:bg-muted/50 transition-colors group"
                        >
                            <FileText className="h-5 w-5 text-primary mr-3" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate group-hover:underline">{doc.name}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">Ver Archivo</p>
                            </div>
                            <ExternalLink className="h-3 w-3 text-muted-foreground ml-2" />
                        </a>
                    ))}
                </div>
              </div>
            )}

            {product.isComposite && product.components && product.components.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Componentes</h3>
                <Table>
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="text-center">Cantidad</TableHead>
                      <TableHead>Unidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {product.components.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="mb-8">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Movimientos Recientes</h3>
              <InventoryMovements productId={product.id} />
            </div>

            <div className="mt-12 text-center text-xs text-muted-foreground">
                <p>Reporte de Inventario</p>
                <p>Byte Services Telecom</p>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="p-4 border-t print-hidden">
          <div className="w-full flex justify-between items-center">
             <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloading}>
                {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {isDownloading ? 'Generando...' : 'Descargar Ficha'}
            </Button>
            <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
