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
4. Include Baltic settings: beaches, coastal marshes, cliff colonies, harbor scenes

For each prompt, provide:
- The prompt text (10-20 words, vivid and specific)
- Cuteness score (1-10): How adorable the resulting video would be
- Alignment score (1-10): How well it fits Baltic coastal bird theme
- Visual appeal score (1-10): How visually interesting it would be
- Uniqueness score (1-10): How novel and creative the concept is
- Brief reasoning for scores
- Relevant tags
- Species featured

Return as JSON array of objects.`;

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
                  text: `${systemPrompt}\n\nGenerate 10 unique bird video prompts following the requirements above. Return as a JSON array.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 4000,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const ideas = JSON.parse(data.candidates[0].content.parts[0].text);

    return {
      ideas: ideas.map((idea: any) => ({
        prompt: idea.prompt,
        cutenessScore: idea.cutenessScore || idea.cuteness_score,
        alignmentScore: idea.alignmentScore || idea.alignment_score,
        visualAppealScore: idea.visualAppealScore || idea.visual_appeal_score,
        uniquenessScore: idea.uniquenessScore || idea.uniqueness_score,
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