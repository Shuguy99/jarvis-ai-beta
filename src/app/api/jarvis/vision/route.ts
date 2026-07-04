import { json } from "@/lib/json-response";
import { ai } from "@/lib/ai-provider";
import { parseJsonBody, MAX_BODY_BYTES_VISION, BodyLimitError } from "@/lib/body-limit";

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody<{ image?: string; prompt?: string }>(req, MAX_BODY_BYTES_VISION);
    const { image, prompt } = body;

    if (!image || typeof image !== "string") {
      return json({ error: "Изображение не предоставлено." }, 400);
    }

    const question =
      prompt || "Опиши это изображение подробно на русском языке, как это сделал бы J.A.R.V.I.S.";

    const reply = (await ai.vision(image, question)).content;

    return json({ reply });
  } catch (error) {
    if (error instanceof BodyLimitError) {
      return json({ error: error.message }, 413);
    }
    console.error("JARVIS Vision error:", error);

    const msg = error instanceof Error ? error.message : "Ошибка анализа.";

    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      return json(
        { error: "Ollama не запущен. Убедитесь, что vision-модель загружена: ollama pull llava" },
        503
      );
    }

    return json({ error: msg }, 500);
  }
}