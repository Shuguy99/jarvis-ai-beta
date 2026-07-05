import { json } from "@/lib/json-response";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt || !prompt.trim()) {
      return json({ error: "Prompt is required." }, 400);
    }

    return json(
      {
        error: "Генерация изображений недоступна с Ollama. Эта функция требует DALL-E/Stable Diffusion API.",
        imageGenUnavailable: true,
      },
      501
    );
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Internal error." },
      500
    );
  }
}