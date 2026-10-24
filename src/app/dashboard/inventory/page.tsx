'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { ProductDialog } from '@/components/inventory/product-dialog';
import { ProductDetailsDialog } from '@/components/inventory/product-details-dialog';
import { AddStockDialog } from '@/components/inventory/add-stock-dialog';
import { LowStockDialog } from '@/components/inventory/low-stock-dialog';
import { InventoryMovements } from '@/components/inventory/inventory-movements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, MoreHorizontal, Eye, Edit, Trash2, Package, ArrowUpDown, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DataImportExport, FieldMapping } from '@/components/shared/data-import-export';

const productFields: FieldMapping[] = [
  { key: 'name', label: 'Nombre del Producto', example: 'Generador Eléctrico 5000W' },
  { key: 'serialNumber', label: 'Serial / Modelo', example: 'BST-5000W', aliases: ['Serial', 'Modelo', 'Número de Serie'] },
  { key: 'description', label: 'Descripción', example: 'Generador diésel trifásico' },
  {
    key: 'quantity',
    label: 'Total Histórico',
    example: '15',
    type: 'number',
    aliases: ['Cantidad', 'Total Historico', 'Histórico', 'Historico'],
    getValue: (item: any) => (item.quantity !== undefined && item.quantity !== null) ? item.quantity : (item.stock ?? 0),
  },
  {
    key: 'stock',
    label: 'Total Real',
    example: '12',
    type: 'number',
    aliases: ['Stock', 'Stock Actual', 'Total Real', 'Existencias', 'Disponible', 'Cantidad Real'],
    getValue: (item: any) => (item.stock !== undefined && item.stock !== null) ? item.stock : (item.quantity ?? 0),
  },
  { key: 'unit', label: 'Unidad', example: 'unidades' },
  { key: 'warehouse', label: 'Almacén', example: 'Principal - Caracas', aliases: ['Almacen', 'Depósito', 'Deposito'] },
  { key: 'fob', label: 'FOB (USD)', example: '490', type: 'number', aliases: ['FOB'] },
  { key: 'cif', label: 'CIF (USD)', example: '530', type: 'number', aliases: ['CIF'] },
  { key: 'retailPrice', label: 'Precio USD', example: '750', type: 'number', aliases: ['Precio Venta', 'Precio Venta (USD)', 'Precio'] },
  { key: 'vesPrice', label: 'Precio VES', example: '27375', type: 'number', aliases: ['Precio (VES)', 'VES'] },
  {
    key: 'bcvPrice',
    label: 'Precio BCV (VES)',
    example: '27375',
    type: 'number',
    aliases: ['Precio BCV', 'BCV', 'Precio Venta (BCV)'],
    getValue: (item: any) => item.bcvPrice ?? item.vesPrice ?? 0,
  },
  { key: 'image', label: 'URL Imagen', example: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758', aliases: ['Imagen', 'Foto'] },
  { key: 'status', label: 'Estado', example: 'In Stock' },
];

export default function InventoryPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isLowStockDialogOpen, setIsLowStockDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);
  const hasAutoTriggeredLowStockRef = useRef(false);

  const productsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'products') : null),
    [firestore]
  );
  const { data: products, isLoading } = useCollection<Product>(productsQuery);

  // Identify all low-stock products (<= 5 units or 'Low Stock' / 'Out of Stock')
  const lowStockProducts = React.useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    return products.filter((p) => {
      const stock = p.stock ?? p.quantity ?? 0;
      return stock <= 5 || p.status === 'Low Stock' || p.status === 'Out of Stock';
    });
  }, [products]);

  // Open low stock popup modal automatically once on load if there are low stock items
  useEffect(() => {
    if (!isLoading && products && lowStockProducts.length > 0 && !hasAutoTriggeredLowStockRef.current) {
      hasAutoTriggeredLowStockRef.current = true;
      setIsLowStockDialogOpen(true);
    }
  }, [isLoading, products, lowStockProducts.length]);

  // Comprehensive filter across any item field or property
  const filteredProducts = React.useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;

    return products.filter((p) => {
      const nameMatch = p?.name?.toLowerCase().includes(term);
      const serialMatch = p?.serialNumber?.toLowerCase().includes(term);
      const descMatch = p?.description?.toLowerCase().includes(term);
      const warehouseMatch = p?.warehouse?.toLowerCase().includes(term);
      const unitMatch = p?.unit?.toLowerCase().includes(term);
      const createdByMatch = p?.createdByName?.toLowerCase().includes(term) || p?.createdByEmail?.toLowerCase().includes(term);
      
      // Status match (in English or Spanish)
      const statusText = p?.status === 'In Stock' ? 'disponible' : p?.status === 'Low Stock' ? 'bajo stock' : 'agotado';
      const statusMatch = p?.status?.toLowerCase().includes(term) || statusText.includes(term);

      // Components match (for composite products)
      const componentsMatch = p?.components?.some((c) =>
        c.name?.toLowerCase().includes(term) || c.unit?.toLowerCase().includes(term)
      );

      // Number values match
      const stockMatch = String(p?.stock ?? '').includes(term) || String(p?.quantity ?? '').includes(term);
      const priceMatch = String(p?.retailPrice ?? '').includes(term) || String(p?.vesPrice ?? '').includes(term) || String(p?.bcvPrice ?? '').includes(term);

      return (
        nameMatch ||
        serialMatch ||
        descMatch ||
        warehouseMatch ||
        unitMatch ||
        statusMatch ||
        createdByMatch ||
        componentsMatch ||
        stockMatch ||
        priceMatch
      );
    });
  }, [products, searchTerm]);

  const handleOpenCreate = () => {
    setSelectedProduct(undefined);
    setIsProductDialogOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsProductDialogOpen(true);
  };

  const handleOpenDetails = (product: Product) => {
    setSelectedProduct(product);
    setIsDetailsDialogOpen(true);
  };

  const handleOpenAddStock = (product: Product) => {
    setSelectedProduct(product);
    setIsAddStockOpen(true);
  };

  const handleDelete = async (productId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'products', productId));
      toast({
        title: 'Producto Eliminado',
        description: 'El producto fue eliminado del inventario correctamente.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el producto.',
      });
    }
  };

  const getStatusBadge = (status: Product['status'], stock: number) => {
    if (stock <= 0 || status === 'Out of Stock') {
      return <Badge variant="destructive">Agotado</Badge>;
    }
    if (stock <= 5 || status === 'Low Stock') {
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Bajo Stock</Badge>;
    }
    return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">Disponible</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventario</h1>
          <p className="text-muted-foreground">
            Gestión completa de catálogo de productos, existencias y movimientos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lowStockProducts.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setIsLowStockDialogOpen(true)}
              className="gap-2 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            >
              <AlertTriangle className="h-4 w-4" />
              Stock Bajo ({lowStockProducts.length})
            </Button>
          )}
          <DataImportExport
            entityName="Productos"
            collectionName="products"
            data={products || []}
            fields={productFields}
          />
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Añadir Producto
          </Button>
        </div>
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList>
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="movements">Historial de Movimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Catálogo de Inventario
                </CardTitle>
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por cualquier producto, serial, almacén..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="font-medium">No se encontraron productos</p>
                  <p className="text-xs mt-1">
                    {searchTerm
                      ? 'No hay productos que coincidan con el término de búsqueda.'
                      : 'Agrega productos al catálogo haciendo clic en "Añadir Producto".'}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Foto</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Serial / Modelo</TableHead>
                        <TableHead>Almacén</TableHead>
                        <TableHead className="text-right">Total Histórico</TableHead>
                        <TableHead className="text-right">Total Real</TableHead>
                        <TableHead className="text-right">Precio Venta (USD)</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="w-16 p-2">
                            <div 
                              className="h-12 w-12 rounded-md border bg-muted/50 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                              onClick={() => handleOpenDetails(product)}
                              title="Click para ver detalles y fotos"
                            >
                              {product.image ? (
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Package className="h-6 w-6 text-muted-foreground/40" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div>{product.name}</div>
                            {product.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-xs">
                                {product.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {product.serialNumber || 'N/A'}
                          </TableCell>
                          <TableCell>{product.warehouse || 'Principal'}</TableCell>
                          <TableCell className="text-right text-muted-foreground font-medium">
                            {product.quantity ?? product.stock ?? 0} {product.unit || 'uds'}
                          </TableCell>
                          <TableCell className="text-right font-bold text-foreground">
                            {product.stock ?? product.quantity ?? 0} {product.unit || 'uds'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            ${(product.retailPrice ?? 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(product.status, product.stock ?? product.quantity ?? 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleOpenDetails(product)}>
                                  <Eye className="mr-2 h-4 w-4" /> Ver Detalles
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenAddStock(product)}>
                                  <ArrowUpDown className="mr-2 h-4 w-4" /> Ajustar Stock
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenEdit(product)}>
                                  <Edit className="mr-2 h-4 w-4" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(product.id)}
                                  className="text-red-600 dark:text-red-400"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          <InventoryMovements />
        </TabsContent>
      </Tabs>

      <LowStockDialog
        isOpen={isLowStockDialogOpen}
        onClose={() => setIsLowStockDialogOpen(false)}
        products={lowStockProducts}
      />

      <ProductDialog
        isOpen={isProductDialogOpen}
        onClose={() => setIsProductDialogOpen(false)}
        product={selectedProduct}
      />

      <ProductDetailsDialog
        isOpen={isDetailsDialogOpen}
        onClose={() => setIsDetailsDialogOpen(false)}
        product={selectedProduct}
      />

      <AddStockDialog
        isOpen={isAddStockOpen}
        onClose={() => setIsAddStockOpen(false)}
        product={selectedProduct}
      />
    </div>
  );
}

