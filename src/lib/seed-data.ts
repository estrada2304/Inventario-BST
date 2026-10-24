import { collection, addDoc, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Firestore } from 'firebase/firestore';

export async function seedSampleData(firestore: Firestore, forceReSeed = false) {
  try {
    // 1. Seed products
    const prodSnap = await getDocs(collection(firestore, 'products'));
    if (prodSnap.empty || forceReSeed) {
      const sampleProducts = [
        {
          name: 'Generador Eléctrico BST-5000W',
          serialNumber: 'BST-GEN-001',
          description: 'Generador diésel de alta potencia trifásico para uso industrial continuo.',
          quantity: 15,
          stock: 15,
          unit: 'unidades',
          warehouse: 'Principal - Caracas',
          image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop',
          exw: 450,
          fob: 490,
          cif: 530,
          retailPrice: 750,
          vesPrice: 27375,
          bcvPrice: 27375,
          status: 'In Stock',
          createdAt: serverTimestamp(),
        },
        {
          name: 'Bomba centrífuga de agua 2HP',
          serialNumber: 'BST-PUMP-002',
          description: 'Bomba de agua de acero inoxidable para presión constante en sistemas industriales.',
          quantity: 4,
          stock: 4,
          unit: 'unidades',
          warehouse: 'Secundario - Valencia',
          image: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop',
          exw: 120,
          fob: 140,
          cif: 160,
          retailPrice: 240,
          vesPrice: 8760,
          bcvPrice: 8760,
          status: 'Low Stock',
          createdAt: serverTimestamp(),
        },
        {
          name: 'Panel Solar Monocristalino 450W',
          serialNumber: 'BST-SOL-003',
          description: 'Panel fotovoltaico de alta eficiencia con protección UV y marco de aluminio reforzado.',
          quantity: 80,
          stock: 80,
          unit: 'unidades',
          warehouse: 'Principal - Caracas',
          image: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=500&auto=format&fit=crop',
          exw: 95,
          fob: 110,
          cif: 125,
          retailPrice: 180,
          vesPrice: 6570,
          bcvPrice: 6570,
          status: 'In Stock',
          createdAt: serverTimestamp(),
        },
        {
          name: 'Inversor Solar Híbrido 5KW',
          serialNumber: 'BST-INV-004',
          description: 'Inversor senoidal puro con controlador MPPT integrado y gestión de baterías de litio.',
          quantity: 12,
          stock: 12,
          unit: 'unidades',
          warehouse: 'Principal - Caracas',
          image: 'https://images.unsplash.com/photo-1592833159057-651427233c4b?w=500&auto=format&fit=crop',
          exw: 380,
          fob: 410,
          cif: 440,
          retailPrice: 650,
          vesPrice: 23725,
          bcvPrice: 23725,
          status: 'In Stock',
          createdAt: serverTimestamp(),
        },
      ];
      for (const p of sampleProducts) {
        await addDoc(collection(firestore, 'products'), p);
      }
    }

    // 2. Seed clients
    const clientsSnap = await getDocs(collection(firestore, 'clients'));
    if (clientsSnap.empty || forceReSeed) {
      const sampleClients = [
        {
          name: 'Corporación Venezolana de Energía',
          company: 'CorpoEner C.A.',
          taxId: 'J-30948571-0',
          email: 'contacto@corpoener.com',
          phone: '+58 212-555-0199',
          clientType: 'Empresa',
          country: 'Venezuela',
          address: 'Av. Francisco de Miranda, Edif. Galipán, Piso 4, Caracas',
          createdAt: serverTimestamp(),
        },
        {
          name: 'Inversiones Industriales del Centro',
          company: 'Inversiones Ind. C.A.',
          taxId: 'J-40192837-5',
          email: 'compras@inversionescentro.ve',
          phone: '+58 241-888-4422',
          clientType: 'Empresa',
          country: 'Venezuela',
          address: 'Zona Industrial Castillito, Calle 102, Valencia, Carabobo',
          createdAt: serverTimestamp(),
        },
        {
          name: 'Soluciones Agrícolas de los Andes',
          company: 'AgroSol S.A.',
          taxId: 'J-50123984-2',
          email: 'info@agrosolandes.com',
          phone: '+58 274-222-1100',
          clientType: 'Empresa',
          country: 'Venezuela',
          address: 'Av. Las Américas, Sector Santa Bárbara, Mérida',
          createdAt: serverTimestamp(),
        },
      ];
      for (const c of sampleClients) {
        await addDoc(collection(firestore, 'clients'), c);
      }
    }

    // 3. Seed suppliers
    const supSnap = await getDocs(collection(firestore, 'suppliers'));
    if (supSnap.empty || forceReSeed) {
      const sampleSuppliers = [
        {
          name: 'Ningbo Power Machinery Co., Ltd.',
          seller: 'David Chen',
          email: 'sales@ningbopower.cn',
          phone: '+86 574-87654321',
          country: 'China',
          status: 'Activo',
          createdAt: serverTimestamp(),
        },
        {
          name: 'Shenzhen SolarTech Energy',
          seller: 'Elena Wang',
          email: 'export@solartech-sz.com',
          phone: '+86 755-12345678',
          country: 'China',
          status: 'Activo',
          createdAt: serverTimestamp(),
        },
      ];
      for (const s of sampleSuppliers) {
        await addDoc(collection(firestore, 'suppliers'), s);
      }
    }

    // 4. Seed quotes
    const quotesSnap = await getDocs(collection(firestore, 'quotes'));
    if (quotesSnap.empty || forceReSeed) {
      const sampleQuotes = [
        {
          quoteNumber: 'COR_04082026_0001',
          date: '2026-08-04',
          customer: {
            id: 'client-1',
            name: 'Corporación Venezolana de Energía',
            company: 'CorpoEner C.A.',
            taxId: 'J-30948571-0',
            email: 'contacto@corpoener.com',
            phone: '+58 212-555-0199',
            address: 'Av. Francisco de Miranda, Edif. Galipán, Piso 4, Caracas',
          },
          items: [
            {
              productId: 'prod-1',
              name: 'Generador Eléctrico BST-5000W',
              description: 'Generador diésel de alta potencia trifásico para uso industrial continuo.',
              quantity: 2,
              price: 750,
            },
            {
              productId: 'prod-3',
              name: 'Panel Solar Monocristalino 450W',
              description: 'Panel fotovoltaico de alta eficiencia.',
              quantity: 10,
              price: 180,
            }
          ],
          subtotal: 3300,
          ivaAmount: 0,
          applyIgtf: false,
          igtfAmount: 0,
          amount: 3300,
          currency: 'USD',
          status: 'Sent',
          notes: 'Incluye pruebas de encendido y manual técnico en español.',
          termsAndConditions: 'Vigencia: 30 días continuos. Precios en USD.',
          paymentMethods: 'Transferencia bancaria o Zelle.',
          createdAt: serverTimestamp(),
        },
        {
          quoteNumber: 'INV_04082026_0002',
          date: '2026-08-03',
          customer: {
            id: 'client-2',
            name: 'Inversiones Industriales del Centro',
            company: 'Inversiones Ind. C.A.',
            taxId: 'J-40192837-5',
            email: 'compras@inversionescentro.ve',
            phone: '+58 241-888-4422',
            address: 'Zona Industrial Castillito, Calle 102, Valencia, Carabobo',
          },
          items: [
            {
              productId: 'prod-2',
              name: 'Bomba centrífuga de agua 2HP',
              description: 'Bomba de agua de acero inoxidable para presión constante.',
              quantity: 1,
              price: 240,
            }
          ],
          subtotal: 240,
          ivaAmount: 0,
          applyIgtf: false,
          igtfAmount: 0,
          amount: 240,
          currency: 'USD',
          status: 'Accepted',
          notes: 'Entrega en almacén de Valencia.',
          termsAndConditions: 'Vigencia: 30 días continuos. Precios en USD.',
          paymentMethods: 'Transferencia bancaria.',
          createdAt: serverTimestamp(),
        }
      ];
      for (const q of sampleQuotes) {
        await addDoc(collection(firestore, 'quotes'), q);
      }
    }

    // 5. Seed orders
    const ordersSnap = await getDocs(collection(firestore, 'orders'));
    if (ordersSnap.empty || forceReSeed) {
      const sampleOrders = [
        {
          customer: {
            name: 'Inversiones Industriales del Centro',
            company: 'Inversiones Ind. C.A.',
            taxId: 'J-40192837-5',
            email: 'compras@inversionescentro.ve',
            phone: '+58 241-888-4422',
            address: 'Zona Industrial Castillito, Calle 102, Valencia',
          },
          items: [
            {
              productId: 'prod-2',
              name: 'Bomba centrífuga de agua 2HP',
              description: 'Bomba de agua de acero inoxidable',
              quantity: 1,
              price: 240,
            }
          ],
          amount: 240,
          status: 'Processing',
          date: '2026-08-03',
          currency: 'USD',
          notes: 'Generada automáticamente desde Cotización INV_04082026_0002.',
          createdByName: 'Sistema',
          createdAt: serverTimestamp(),
        }
      ];
      for (const o of sampleOrders) {
        await addDoc(collection(firestore, 'orders'), o);
      }
    }

    // 6. Seed users
    const usersSnap = await getDocs(collection(firestore, 'users'));
    if (usersSnap.empty || forceReSeed) {
      const sampleUsers = [
        {
          id: 'admin-default',
          firstName: 'Administrador',
          lastName: 'Sistema',
          email: 'admin@empresa.com',
          username: 'admin',
          role: 'Admin',
          isActive: true,
          createdAt: serverTimestamp(),
        },
        {
          id: 'sales-default',
          firstName: 'Carlos',
          lastName: 'Mendoza',
          email: 'ventas@empresa.com',
          username: 'cmendoza',
          role: 'Sales',
          isActive: true,
          createdAt: serverTimestamp(),
        },
        {
          id: 'viewer-default',
          firstName: 'María',
          lastName: 'García',
          email: 'observador@empresa.com',
          username: 'mgarcia',
          role: 'Viewer',
          isActive: true,
          createdAt: serverTimestamp(),
        },
      ];
      for (const u of sampleUsers) {
        await setDoc(doc(firestore, 'users', u.id), u);
      }
    }

    return true;
  } catch (err) {
    console.error('Error seeding data:', err);
    return false;
  }
}

