const DEFAULT_OLLAMA = {
  endpoint: "http://localhost:11434/v1/chat/completions",
  model: "qwen3:4b"
};

export async function askOllama(prompt, sceneContext = {}) {
  const body = {
    model: DEFAULT_OLLAMA.model,
    temperature: 0.35,
    messages: [
      {
        role: "system",
        content: [
          "You are ModelForge AI, a local assistant inside a Three.js 3D editor.",
          "Be concise, practical, and honest.",
          "Use the supplied scene context when answering editor questions.",
          "Never claim you changed the scene unless the application explicitly executes an action."
        ].join(" ")
      },
      {
        role: "user",
        content: `Scene context:\n${JSON.stringify(sceneContext, null, 2)}\n\nUser request:\n${prompt}`
      }
    ]
  };

  const response = await fetch(DEFAULT_OLLAMA.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Ollama returned HTTP ${response.status}`);
  }

  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Ollama returned an empty response.");
  }

  return text.trim();
}

export function getOllamaConfig() {
  return { ...DEFAULT_OLLAMA };
}
