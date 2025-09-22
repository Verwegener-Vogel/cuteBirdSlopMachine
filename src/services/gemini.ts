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

  async pollOperation(operationName: string): Promise<any> {
    const response = await fetch(
      `${GEMINI_API_BASE}/${operationName}`,
      {
        method: 'GET',
        headers: {
          'x-goog-api-key': this.apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to poll operation: ${response.status}`);
    }

    return response.json();
  }

  async generateVideo(prompt: string): Promise<{ videoUrl: string; operationName?: string }> {
    // Using Veo 3.0 API with predictLongRunning endpoint
    console.log(`Generating video with Veo 3.0 for prompt: ${prompt}`);

    try {
      // Start the video generation with Veo
      const response = await fetch(
        `${GEMINI_API_BASE}/models/veo-3.0-generate-001:predictLongRunning`,
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instances: [{
              prompt: `A cute video of ${prompt}. Nature documentary style, high quality, adorable moments.`
            }]
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Veo API error: ${response.status}`, errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const operation = await response.json();
      console.log('Veo operation started:', operation.name);
      const operationName = operation.name;

      // Poll the operation until it's done
      const maxAttempts = 60; // 5 minutes max (5 seconds * 60)
      let attempts = 0;

      while (attempts < maxAttempts) {
        // In test environment, skip the delay
        if (this.apiKey !== 'test-api-key') {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        }

        const statusResponse = await fetch(
          `${GEMINI_API_BASE}/${operation.name}`,
          {
            method: 'GET',
            headers: {
              'x-goog-api-key': this.apiKey,
            },
          }
        );

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text();
          console.error('Failed to check operation status:', errorText);
          attempts++;
          continue;
        }

        const status = await statusResponse.json();
        console.log(`Operation status (attempt ${attempts + 1}):`, JSON.stringify(status));

        if (status.done) {
          if (status.error) {
            throw new Error(`Video generation failed: ${JSON.stringify(status.error)}`);
          }

          // Extract video URL from Veo response
          const videoUri = status.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
                          status.response?.predictions?.[0]?.videoUri ||
                          status.response?.videoUri ||
                          status.response?.uri;

          if (videoUri) {
            console.log('Video generated successfully:', videoUri);
            return { videoUrl: videoUri, operationName };
          } else {
            console.error('Video completed but no URL found in response:', JSON.stringify(status.response));
            throw new Error('Video generation completed but no URL was returned');
          }
        }

        attempts++;
      }

      // Timeout - throw error instead of using mock
      throw new Error(`Video generation timed out after ${maxAttempts * 5} seconds`);

    } catch (error) {
      console.error('Video generation failed:', error);
      // Re-throw the error to properly handle it upstream
      throw error;
    }
  }
}