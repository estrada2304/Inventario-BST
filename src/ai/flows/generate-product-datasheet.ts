'use server';

/**
 * @fileOverview Generates a product datasheet using AI based on the product description and specifications.
 *
 * - generateProductDatasheet - A function that generates the product datasheet.
 * - GenerateProductDatasheetInput - The input type for the generateProductDatasheet function.
 * - GenerateProductDatasheetOutput - The return type for the generateProductDatasheet function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateProductDatasheetInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  productDescription: z.string().describe('A detailed description of the product.'),
  productSpecifications: z.string().describe('The specifications of the product.'),
});
export type GenerateProductDatasheetInput = z.infer<typeof GenerateProductDatasheetInputSchema>;

const GenerateProductDatasheetOutputSchema = z.object({
  datasheet: z.string().describe('The generated product datasheet.'),
});
export type GenerateProductDatasheetOutput = z.infer<typeof GenerateProductDatasheetOutputSchema>;

export async function generateProductDatasheet(input: GenerateProductDatasheetInput): Promise<GenerateProductDatasheetOutput> {
  return generateProductDatasheetFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateProductDatasheetPrompt',
  input: {schema: GenerateProductDatasheetInputSchema},
  output: {schema: GenerateProductDatasheetOutputSchema},
  prompt: `You are an AI assistant specialized in creating product datasheets.

  Based on the product name, description, and specifications provided, generate a comprehensive and informative product datasheet.

  Product Name: {{{productName}}}
  Product Description: {{{productDescription}}}
  Product Specifications: {{{productSpecifications}}}

  Datasheet:`, // Removed Handlebars {{safe}} to ensure proper formatting
});

const generateProductDatasheetFlow = ai.defineFlow(
  {
    name: 'generateProductDatasheetFlow',
    inputSchema: GenerateProductDatasheetInputSchema,
    outputSchema: GenerateProductDatasheetOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
