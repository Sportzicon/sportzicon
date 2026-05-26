import OpenAI from "openai";
import { env } from "./env";

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!_client) {
    if (!env.OPENAI_API_KEY) {
      // Caller decides how to handle missing key; do not crash at boot.
      throw new Error("OPENAI_API_KEY is not configured");
    }
    _client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return _client;
}

export const isOpenAIConfigured = () => Boolean(env.OPENAI_API_KEY);
