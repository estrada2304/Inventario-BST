'use server';

/**
 * @fileOverview Identifies key product KPIs such as top-selling, highest-profit, worst-selling, and lowest-profit products.
 *
 * - identifyProductKPIs - A function that identifies product KPIs.
 * - IdentifyProductKPIsInput - The input type for the identifyProductKPIs function.
 * - IdentifyProductKPIsOutput - The return type for the identifyProductKPIs function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const IdentifyProductKPIsInputSchema = z.object({
  salesData: z
    .string()
    .describe('Sales data in JSON format, including product names, sales quantities, and profit margins.'),
});
export type IdentifyProductKPIsInput = z.infer<typeof IdentifyProductKPIsInputSchema>;

const IdentifyProductKPIsOutputSchema = z.object({
  topSellingProducts: z
    .string()
    .describe('A list of the top-selling products based on sales quantity.'),
  highestProfitProducts: z
    .string()
    .describe('A list of the products with the highest profit margins.'),
  worstSellingProducts: z
    .string()
    .describe('A list of the worst-selling products based on sales quantity.'),
  lowestProfitProducts: z
    .string()
    .describe('A list of the products with the lowest profit margins.'),
});
export type IdentifyProductKPIsOutput = z.infer<typeof IdentifyProductKPIsOutputSchema>;

export async function identifyProductKPIs(input: IdentifyProductKPIsInput): Promise<IdentifyProductKPIsOutput> {
  return identifyProductKPIsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'identifyProductKPIsPrompt',
  input: {schema: IdentifyProductKPIsInputSchema},
  output: {schema: IdentifyProductKPIsOutputSchema},
  prompt: `You are an expert sales data analyst. Analyze the provided sales data and identify key product KPIs.

Sales Data: {{{salesData}}}

Based on this data, determine and list the top-selling products, the products with the highest profit margins, the worst-selling products, and the products with the lowest profit margins. Format the output in a way that is easily readable and understandable.

Ensure that the output provides actionable insights for the administrator.`,
});

const identifyProductKPIsFlow = ai.defineFlow(
  {
    name: 'identifyProductKPIsFlow',
    inputSchema: IdentifyProductKPIsInputSchema,
    outputSchema: IdentifyProductKPIsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
