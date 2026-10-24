'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export async function summarizeProductReviewsAction(input: { productName: string; reviews: string[] }) {
  try {
    const response = await ai.generate({
      prompt: `Resume las siguientes opiniones sobre el producto ${input.productName}:\n\n${input.reviews.join('\n\n')}`,
    });
    return { success: true, text: response.text };
  } catch (error: any) {
    console.error('Error in summarizeProductReviewsAction:', error);
    return { success: false, error: error?.message || 'Error al resumir opiniones' };
  }
}

export async function identifyProductKPIsAction(input: { productName: string; description?: string }) {
  try {
    const response = await ai.generate({
      prompt: `Identifica los KPIs clave y métricas de rendimiento para el producto "${input.productName}". Descripción: ${input.description || 'N/A'}`,
    });
    return { success: true, text: response.text };
  } catch (error: any) {
    console.error('Error in identifyProductKPIsAction:', error);
    return { success: false, error: error?.message || 'Error al identificar KPIs' };
  }
}

export async function generateProductDatasheetAction(input: { productName: string; specs?: string }) {
  try {
    const response = await ai.generate({
      prompt: `Genera una ficha técnica profesional para el producto "${input.productName}". Especificaciones: ${input.specs || 'N/A'}`,
    });
    return { success: true, text: response.text };
  } catch (error: any) {
    console.error('Error in generateProductDatasheetAction:', error);
    return { success: false, error: error?.message || 'Error al generar ficha técnica' };
  }
}
