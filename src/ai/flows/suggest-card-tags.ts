'use server';

/**
 * @fileOverview Suggests relevant tags for a flashcard based on its content.
 *
 * - suggestCardTags - A function that suggests tags for a given flashcard.
 * - SuggestCardTagsInput - The input type for the suggestCardTags function.
 * - SuggestCardTagsOutput - The output type for the suggestCardTags function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestCardTagsInputSchema = z.object({
  frontText: z
    .string()
    .describe('The text on the front of the flashcard.'),
  backText: z
    .string()
    .describe('The text on the back of the flashcard.'),
});
export type SuggestCardTagsInput = z.infer<typeof SuggestCardTagsInputSchema>;

const SuggestCardTagsOutputSchema = z.object({
  tags: z.array(z.string()).describe('An array of suggested tags for the flashcard.'),
});
export type SuggestCardTagsOutput = z.infer<typeof SuggestCardTagsOutputSchema>;

export async function suggestCardTags(input: SuggestCardTagsInput): Promise<SuggestCardTagsOutput> {
  return suggestCardTagsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestCardTagsPrompt',
  input: {schema: SuggestCardTagsInputSchema},
  output: {schema: SuggestCardTagsOutputSchema},
  prompt: `You are an expert in generating relevant tags for flashcards.

  Given the content of the flashcard, suggest a few relevant tags that can be used to categorize and organize the flashcard.
  Return a list of tags that are comma seperated.

  Front Text: {{{frontText}}}
  Back Text: {{{backText}}}
  `,
});

const suggestCardTagsFlow = ai.defineFlow(
  {
    name: 'suggestCardTagsFlow',
    inputSchema: SuggestCardTagsInputSchema,
    outputSchema: SuggestCardTagsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
