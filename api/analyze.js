// api/analyze.js – Vercel Serverless Function
// Prompt caching: a portfolioContext + system prompt cache-elődik (5 perc)
// Cache hit ~10x olcsóbb mint normál input token

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { portfolioContext, userPrompt, apiKey } = req.body;
  if (!portfolioContext || !userPrompt || !apiKey) {
    return res.status(400).json({ error: "Hiányzó portfolioContext, userPrompt vagy apiKey" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",  // cache feature flag
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        system: [
          {
            type: "text",
            // Ez a rész cache-elődik – minden kérésnél ugyanaz
            text: `Te egy tapasztalt portfólió-elemző vagy. Tömören, konkrétan, magyarul válaszolj. Hivatkozz konkrét tickerekre, kerüld az általánosságokat.

PORTFÓLIÓ ADATOK:
${portfolioContext}`,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            // Ez változik kérésenként – nem cache-elődik
            content: userPrompt,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Anthropic API hiba",
      });
    }

    // Cache usage visszaküldése logoláshoz
    return res.status(200).json({
      content: data.content,
      usage: data.usage,  // cache_creation_input_tokens, cache_read_input_tokens
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
