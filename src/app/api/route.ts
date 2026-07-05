import { json } from "@/lib/json-response";

export async function GET() {
  try {
    return json({ message: "Hello, world!" });
  } catch (error) {
    console.error("Root API error:", error);
    return json({ error: "Internal server error" }, 500);
  }
}