'use client';

import * as React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';
import type { Product } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';

interface LowStockAlertProps {
  products?: Product[];
}

const LOW_STOCK_THRESHOLD = 5;

export function LowStockAlert({ products: propProducts }: LowStockAlertProps) {
  const [isVisible, setIsVisible] = React.useState(true);
  const firestore = useFirestore();

  const productsQuery = useMemoFirebase(
    () => (!propProducts && firestore ? collection(firestore, 'products') : null),
    [propProducts, firestore]
  );
  const { data: fetchedProducts } = useCollection<Product>(productsQuery);

  const lowStockProducts = React.useMemo(() => {
    const productsList = propProducts || fetchedProducts;
    if (!Array.isArray(productsList)) return [];
    return productsList.filter((p) => {
      const stock = p.stock ?? p.quantity ?? 0;
      return stock <= LOW_STOCK_THRESHOLD;
    });
  }, [propProducts, fetchedProducts]);

  if (lowStockProducts.length === 0 || !isVisible) {
    return null;
  }

  return (
    <Alert variant="destructive" className="relative">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Alerta de Stock Bajo / Agotado</AlertTitle>
      <AlertDescription>
        Hay {lowStockProducts.length} producto(s) con stock crítico (5 unidades o menos).
        <ul className="list-disc list-inside mt-2 text-xs">
          {lowStockProducts.slice(0, 3).map((p) => (
            <li key={p.id}>
              {p.name} ({p.stock ?? p.quantity ?? 0} {p.unit || 'uds'})
            </li>
          ))}
        </ul>
        {lowStockProducts.length > 3 && (
          <p className="text-xs mt-1">y {lowStockProducts.length - 3} más...</p>
        )}
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={() => setIsVisible(false)}
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
}

