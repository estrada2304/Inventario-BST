'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useFirestore } from '@/firebase';
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, Upload, FileSpreadsheet, FileJson, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export interface FieldMapping {
  key: string;
  label: string;
  example?: string;
  type?: 'string' | 'number' | 'boolean' | 'date';
  getValue?: (item: any) => any;
  aliases?: string[];
}

export interface DataImportExportProps {
  entityName: string;
  collectionName: string;
  data: any[];
  fields: FieldMapping[];
}

export function DataImportExport({
  entityName,
  collectionName,
  data,
  fields,
}: DataImportExportProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // EXPORT LOGIC
  const handleExportExcel = () => {
    if (!data || data.length === 0) {
      toast({
        title: 'Sin datos',
        description: `No hay registros de ${entityName.toLowerCase()} para exportar.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      // Map data according to labels for clean column names
      const mappedData = data.map((item) => {
        const row: Record<string, any> = {};
        fields.forEach((field) => {
          let val = field.getValue ? field.getValue(item) : item[field.key];
          if (val === undefined || val === null) val = '';
          row[field.label] = val;
        });
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(mappedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, entityName);

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `${entityName}_${dateStr}.xlsx`);

      toast({
        title: 'Exportación exitosa',
        description: `Se han exportado ${data.length} registros a Excel.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error al exportar',
        description: error.message || 'Ocurrió un problema al generar el archivo Excel.',
        variant: 'destructive',
      });
    }
  };

  const handleExportCSV = () => {
    if (!data || data.length === 0) {
      toast({
        title: 'Sin datos',
        description: `No hay registros de ${entityName.toLowerCase()} para exportar.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      const mappedData = data.map((item) => {
        const row: Record<string, any> = {};
        fields.forEach((field) => {
          let val = field.getValue ? field.getValue(item) : item[field.key];
          if (val === undefined || val === null) val = '';
          row[field.label] = val;
        });
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(mappedData);
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);

      const blob = new Blob(['\uFEFF' + csvOutput], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];

      link.setAttribute('href', url);
      link.setAttribute('download', `${entityName}_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Exportación exitosa',
        description: `Se han exportado ${data.length} registros a CSV.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error al exportar',
        description: error.message || 'Ocurrió un problema al generar el archivo CSV.',
        variant: 'destructive',
      });
    }
  };

  const handleExportJSON = () => {
    if (!data || data.length === 0) {
      toast({
        title: 'Sin datos',
        description: `No hay registros de ${entityName.toLowerCase()} para exportar.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      // Clean JSON export (custom getters supported)
      const cleanData = data.map((item) => {
        const row: Record<string, any> = {};
        fields.forEach((field) => {
          let val = field.getValue ? field.getValue(item) : item[field.key];
          if (val !== undefined && val !== null) {
            row[field.key] = val;
          }
        });
        Object.keys(item).forEach((k) => {
          if (k !== 'id' && row[k] === undefined && item[k] !== undefined) {
            row[k] = item[k];
          }
        });
        return row;
      });

      const jsonStr = JSON.stringify(cleanData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];

      link.setAttribute('href', url);
      link.setAttribute('download', `${entityName}_${dateStr}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Exportación exitosa',
        description: `Se han exportado ${data.length} registros a JSON.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error al exportar',
        description: error.message || 'Ocurrió un problema al generar el archivo JSON.',
        variant: 'destructive',
      });
    }
  };

  // TEMPLATE DOWNLOAD
  const handleDownloadTemplate = () => {
    try {
      const sampleRow: Record<string, any> = {};
      fields.forEach((f) => {
        sampleRow[f.label] = f.example || (f.type === 'number' ? 100 : `Ejemplo ${f.label}`);
      });

      const worksheet = XLSX.utils.json_to_sheet([sampleRow]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla');

      XLSX.writeFile(workbook, `Plantilla_Importacion_${entityName}.xlsx`);

      toast({
        title: 'Plantilla descargada',
        description: 'Usa esta plantilla como referencia para preparar tus datos.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'No se pudo descargar la plantilla.',
        variant: 'destructive',
      });
    }
  };

  // IMPORT FILE PARSING
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    if (file.name.endsWith('.json')) {
      reader.onload = (evt) => {
        try {
          const content = evt.target?.result as string;
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            setParsedItems(parsed);
          } else {
            toast({
              title: 'Formato inválido',
              description: 'El archivo JSON debe contener un arreglo de objetos.',
              variant: 'destructive',
            });
          }
        } catch (err: any) {
          toast({
            title: 'Error al leer JSON',
            description: err.message,
            variant: 'destructive',
          });
        }
      };
      reader.readAsText(file);
    } else {
      reader.onload = (evt) => {
        try {
          const dataBuffer = evt.target?.result;
          const workbook = XLSX.read(dataBuffer, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);

          // Map headers (key or label matching)
          const normalizedRows = rawRows.map((row) => {
            const normalizedItem: Record<string, any> = {};

            fields.forEach((f) => {
              // Look for key match, label match, or aliases
              let val = row[f.key] ?? row[f.label];
              if (val === undefined && f.aliases) {
                for (const alias of f.aliases) {
                  if (row[alias] !== undefined) {
                    val = row[alias];
                    break;
                  }
                }
              }
              if (val === undefined) {
                const matchedKey = Object.keys(row).find(
                  (k) =>
                    k.toLowerCase().trim() === f.key.toLowerCase() ||
                    k.toLowerCase().trim() === f.label.toLowerCase() ||
                    (f.aliases && f.aliases.some((a) => a.toLowerCase().trim() === k.toLowerCase().trim()))
                );
                if (matchedKey) val = row[matchedKey];
              }

              if (val !== undefined && val !== null && val !== '') {
                if (f.type === 'number') {
                  const num = Number(val);
                  normalizedItem[f.key] = isNaN(num) ? val : num;
                } else if (f.type === 'boolean') {
                  normalizedItem[f.key] =
                    val === true || String(val).toLowerCase() === 'true' || String(val) === '1';
                } else {
                  normalizedItem[f.key] = String(val).trim();
                }
              }
            });

            // Retain any remaining fields if direct JSON format was uploaded
            Object.keys(row).forEach((k) => {
              if (normalizedItem[k] === undefined && !fields.some((f) => f.label === k)) {
                normalizedItem[k] = row[k];
              }
            });

            return normalizedItem;
          });

          setParsedItems(normalizedRows);
        } catch (err: any) {
          toast({
            title: 'Error al procesar archivo',
            description: err.message || 'No se pudo leer el archivo de Excel/CSV.',
            variant: 'destructive',
          });
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  // SAVE IMPORT TO FIRESTORE
  const handleExecuteImport = async () => {
    if (!firestore) {
      toast({
        title: 'Error',
        description: 'No hay conexión a la base de datos.',
        variant: 'destructive',
      });
      return;
    }

    if (parsedItems.length === 0) {
      toast({
        title: 'Sin datos',
        description: 'No hay registros válidos para importar.',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);

    try {
      const colRef = collection(firestore, collectionName);
      
      // Batch in groups of 400
      const chunkSize = 400;
      for (let i = 0; i < parsedItems.length; i += chunkSize) {
        const chunk = parsedItems.slice(i, i + chunkSize);
        const batch = writeBatch(firestore);

        chunk.forEach((item) => {
          const docRef = doc(colRef);
          batch.set(docRef, {
            ...item,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();
      }

      toast({
        title: 'Importación finalizada',
        description: `Se han importado ${parsedItems.length} registros en ${entityName}.`,
      });

      setIsImportOpen(false);
      setParsedItems([]);
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      toast({
        title: 'Error al guardar en base de datos',
        description: error.message || 'Ocurrió un error inesperado durante la importación.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleResetImport = () => {
    setParsedItems([]);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex items-center gap-2">
      {/* EXPORT DROPDOWN */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Exportar {entityName}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            A Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
            <FileText className="h-4 w-4 text-blue-600" />
            A CSV (.csv)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportJSON} className="gap-2 cursor-pointer">
            <FileJson className="h-4 w-4 text-amber-600" />
            A JSON (.json)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* IMPORT BUTTON */}
      <Button variant="outline" onClick={() => setIsImportOpen(true)} className="gap-2">
        <Upload className="h-4 w-4" />
        Importar
      </Button>

      {/* IMPORT MODAL */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar {entityName}</DialogTitle>
            <DialogDescription>
              Carga tus datos masivamente desde un archivo Excel (.xlsx), CSV (.csv) o JSON (.json).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 overflow-y-auto pr-1">
            {/* FILE UPLOAD & TEMPLATE DOWNLOAD */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border rounded-xl bg-muted/30">
              <div className="space-y-1">
                <p className="text-sm font-medium">¿Primera vez importando?</p>
                <p className="text-xs text-muted-foreground">
                  Descarga la plantilla con el formato exacto requerido.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleDownloadTemplate}
                className="gap-2 shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar Plantilla
              </Button>
            </div>

            {/* DROP / SELECT ZONE */}
            {parsedItems.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-8 text-center hover:bg-muted/40 transition-colors cursor-pointer space-y-3"
              >
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium">Selecciona o arrastra un archivo</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Soporta formatos .xlsx, .csv y .json
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              /* PREVIEW AREA */
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      Archivo <strong>{fileName}</strong> cargado con exito. ({parsedItems.length} registros listos)
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetImport}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cambiar archivo
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Vista previa de datos (Primeros 5 registros)
                  </p>
                  <div className="border rounded-lg overflow-x-auto max-h-56">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow>
                          {fields.map((f) => (
                            <TableHead key={f.key} className="whitespace-nowrap font-medium">
                              {f.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedItems.slice(0, 5).map((item, idx) => (
                          <TableRow key={idx}>
                            {fields.map((f) => (
                              <TableCell key={f.key} className="whitespace-nowrap max-w-[180px] truncate">
                                {item[f.key] !== undefined && item[f.key] !== null
                                  ? String(item[f.key])
                                  : '-'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsImportOpen(false)}
              disabled={isImporting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleExecuteImport}
              disabled={parsedItems.length === 0 || isImporting}
              className="gap-2"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Importar {parsedItems.length} Registros
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
