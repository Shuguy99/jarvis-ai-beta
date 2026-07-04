import { json } from "@/lib/json-response";

export async function GET() {
  return json({ message: "Hello, world!" });
}