import { PromptIdea, PromptGenerationBatch } from '../types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiService {
  constructor(private apiKey: string) {}

  async generatePromptIdeas(): Promise<PromptGenerationBatch> {
    const systemPrompt = `You are a creative AI specialized in generating adorable bird video prompts featuring Northern German Baltic coastal species.

Generate exactly 10 unique video prompt ideas with these requirements:
1. Focus on Baltic coastal birds: Common Eider, Great Cormorant, Mute Swan, Common Tern, Eurasian Oystercatcher, Common Gull, Red-breasted Merganser, Barnacle Goose, White-tailed Eagle
2. Mix realistic and cartoon-like styles
3. Emphasize cuteness factors: baby birds, fluffy feathers, playful behavior, group activities
4. Include Baltic settings: beaches, coastal marshes, cliff colonies, harbor scenes`;

    const response = await fetch(
      `${GEMINI_API_BASE}/models/gemini-2.5-pro:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemPrompt}\n\nGenerate 10 unique bird video prompts following the requirements above.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 4000,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: {
                prompts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      prompt: {
                        type: 'string',
                        description: 'The prompt text (10-20 words, vivid and specific)'
                      },
                      cutenessScore: {
                        type: 'number',
                        description: 'How adorable the resulting video would be (1-10)'
                      },
                      alignmentScore: {
                        type: 'number',
                        description: 'How well it fits Baltic coastal bird theme (1-10)'
                      },
                      visualAppealScore: {
                        type: 'number',
                        description: 'How visually interesting it would be (1-10)'
                      },
                      uniquenessScore: {
                        type: 'number',
                        description: 'How novel and creative the concept is (1-10)'
                      },
                      reasoning: {
                        type: 'string',
                        description: 'Brief reasoning for the scores'
                      },
                      tags: {
                        type: 'array',
                        items: {
                          type: 'string'
                        },
                        description: 'Relevant tags for the prompt'
                      },
                      species: {
                        type: 'array',
                        items: {
                          type: 'string'
                        },
                        description: 'Species featured in the prompt'
                      }
                    },
                    required: ['prompt', 'cutenessScore', 'alignmentScore', 'visualAppealScore', 'uniquenessScore', 'reasoning', 'tags', 'species']
                  }
                }
              },
              required: ['prompts']
            }
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // With structured output, the response should already be properly formatted
    const textContent = data.candidates[0].content.parts[0].text;
    const parsedData = JSON.parse(textContent);

    // The response should have a 'prompts' array based on our schema
    const ideas = parsedData.prompts || parsedData;

    return {
      ideas: ideas.map((idea: any) => ({
        prompt: idea.prompt,
        cutenessScore: idea.cutenessScore,
        alignmentScore: idea.alignmentScore,
        visualAppealScore: idea.visualAppealScore,
        uniquenessScore: idea.uniquenessScore,
        reasoning: idea.reasoning,
        tags: idea.tags || [],
        species: idea.species || [],
      })),
      generatedAt: Date.now(),
      modelVersion: 'gemini-2.5-pro',
    };
  }

  async generateVideo(prompt: string): Promise<{ videoUrl: string }> {
    const response = await fetch(
      `${GEMINI_API_BASE}/models/gemini-2.5-pro:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Generate a video based on this prompt: ${prompt}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: 'video/mp4',
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Video generation error: ${response.status}`);
    }

    const data = await response.json();

    return {
      videoUrl: data.candidates[0].content.parts[0].videoUrl || 'pending',
    };
  }
}