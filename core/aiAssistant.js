const DEFAULT_SETTINGS = {
  endpoint: "http://localhost:11434/v1/chat/completions",
  model: "qwen3:4b"
};

export function initAIAssistant(options = {}) {
  if (document.getElementById("mfAiLauncher")) return;

  const getSceneContext = options.getSceneContext || (() => ({ objects: [] }));
  injectStyles();
  injectUI();

  const launcher = document.getElementById("mfAiLauncher");
  const panel = document.getElementById("mfAiPanel");
  const close = document.getElementById("mfAiClose");
  const send = document.getElementById("mfAiSend");
  const input = document.getElementById("mfAiInput");
  const messages = document.getElementById("mfAiMessages");

  launcher.addEventListener("click", () => {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    input.focus();
  });
  close.addEventListener("click", () => {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
  });
  send.addEventListener("click", submit);
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  });
  document.querySelectorAll("[data-ai-prompt]").forEach(button => {
    button.addEventListener("click", () => {
      input.value = button.dataset.aiPrompt || "";
      input.focus();
    });
  });

  addMessage(messages, "assistant", `Local AI ready: ${DEFAULT_SETTINGS.model}`);

  async function submit() {
    const prompt = input.value.trim();
    if (!prompt) return;
    input.value = "";
    addMessage(messages, "user", prompt);
    const pending = addMessage(messages, "assistant", "Thinking…", true);
    send.disabled = true;
    try {
      const response = await callOllama(prompt, safeSceneContext(getSceneContext()));
      pending.remove();
      addMessage(messages, "assistant", response);
    } catch (error) {
      pending.remove();
      addMessage(messages, "system", `Local AI request failed: ${error.message}`);
    } finally {
      send.disabled = false;
      input.focus();
    }
  }
}

async function callOllama(userPrompt, sceneContext) {
  const response = await fetch(DEFAULT_SETTINGS.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: DEFAULT_SETTINGS.model,
      temperature: 0.35,
      messages: [
        { role: "system", content: "You are ModelForge AI, a local assistant inside a Three.js 3D editor. Be concise, practical, and honest. Use scene context when useful. Never claim you changed the scene unless the app explicitly executed an action." },
        { role: "user", content: `Scene context:\n${JSON.stringify(sceneContext, null, 2)}\n\nUser request:\n${userPrompt}` }
      ]
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Ollama returned HTTP ${response.status}`);
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("Ollama returned an empty response.");
  return text.trim();
}

function safeSceneContext(context) {
  return {
    transformSpace: context?.transformSpace || "world",
    selected: context?.selected || null,
    objectCount: Number.isFinite(context?.objectCount) ? context.objectCount : 0,
    objects: Array.isArray(context?.objects) ? context.objects.slice(0, 60).map(object => ({
      name: object?.name,
      type: object?.type,
      position: object?.position,
      rotation: object?.rotation,
      scale: object?.scale
    })) : []
  };
}

function addMessage(container, role, text, pending = false) {
  const item = document.createElement("div");
  item.className = `mf-ai-msg mf-ai-${role}`;
  if (pending) item.dataset.pending = "true";
  item.textContent = text;
  container.appendChild(item);
  container.scrollTop = container.scrollHeight;
  return item;
}

function injectUI() {
  document.body.insertAdjacentHTML("beforeend", `
    <button id="mfAiLauncher" class="mf-ai-launcher" aria-label="Open ModelForge AI" aria-expanded="false">✦ AI</button>
    <aside id="mfAiPanel" class="mf-ai-panel" hidden aria-label="ModelForge local AI assistant">
      <div class="mf-ai-head">
        <div><span class="mf-ai-kicker">MODELFORGE</span><strong>Local AI</strong><small class="mf-ai-model">Ollama · qwen3:4b</small></div>
        <button id="mfAiClose" class="mf-ai-icon" aria-label="Close AI">×</button>
      </div>
      <div class="mf-ai-local-note">Runs on this PC through Ollama. No API key required.</div>
      <div class="mf-ai-chips">
        <button data-ai-prompt="Explain my current scene and suggest the next modeling step.">Scene review</button>
        <button data-ai-prompt="Suggest a clean transform setup for the selected object.">Transform help</button>
        <button data-ai-prompt="Help me design the next ModelForge feature.">Build feature</button>
      </div>
      <div id="mfAiMessages" class="mf-ai-messages" aria-live="polite"></div>
      <div class="mf-ai-compose">
        <textarea id="mfAiInput" rows="2" placeholder="Ask local ModelForge AI…"></textarea>
        <button id="mfAiSend" class="mf-ai-send">Send</button>
      </div>
    </aside>
  `);
}

function injectStyles() {
  if (document.getElementById("mfAiStyles")) return;
  const style = document.createElement("style");
  style.id = "mfAiStyles";
  style.textContent = `
    .mf-ai-launcher{position:fixed;right:18px;bottom:44px;z-index:120;border:1px solid #424650;background:#16191f;color:#e8ebf0;border-radius:999px;padding:9px 13px;font:700 11px/1 system-ui;box-shadow:0 10px 30px #0006;cursor:pointer}
    .mf-ai-launcher:hover{background:#22262f}.mf-ai-panel{position:fixed;right:18px;bottom:84px;width:min(390px,calc(100vw - 24px));height:min(620px,calc(100vh - 110px));z-index:125;display:flex;flex-direction:column;overflow:hidden;border:1px solid #363a43;border-radius:12px;background:#111319;color:#e7e9ee;box-shadow:0 28px 90px #000b;font-family:system-ui,sans-serif}
    .mf-ai-head{display:flex;justify-content:space-between;align-items:center;padding:13px 14px;border-bottom:1px solid #2a2e36;background:#16181e}.mf-ai-kicker{display:block;font-size:8px;letter-spacing:.16em;color:#7d8390}.mf-ai-head strong{font-size:14px}.mf-ai-model{display:block;color:#7f8794;font-size:9px;margin-top:2px}.mf-ai-icon{width:30px;height:30px;border:1px solid #323640;background:#1b1e24;color:#c9cdd5;border-radius:6px;cursor:pointer}.mf-ai-local-note{padding:8px 10px;border-bottom:1px solid #252931;background:#13161b;color:#7f8794;font-size:9px}.mf-ai-chips{display:flex;gap:5px;overflow:auto;padding:8px;border-bottom:1px solid #242830}.mf-ai-chips button{flex:0 0 auto;border:1px solid #30343d;background:#181b21;color:#aeb4bf;border-radius:999px;padding:6px 8px;font-size:9px;cursor:pointer}.mf-ai-messages{flex:1;min-height:0;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:7px}.mf-ai-msg{max-width:88%;padding:8px 10px;border-radius:8px;font:12px/1.45 system-ui;white-space:pre-wrap;word-break:break-word}.mf-ai-assistant{align-self:flex-start;background:#1c2027;color:#dfe3e9}.mf-ai-user{align-self:flex-end;background:#e9ebef;color:#15171c}.mf-ai-system{align-self:center;background:#252a32;color:#9097a4;font-size:10px}.mf-ai-compose{display:grid;grid-template-columns:1fr auto;gap:6px;padding:9px;border-top:1px solid #2a2e36;background:#16181d}.mf-ai-compose textarea{resize:none;border:1px solid #323640;border-radius:6px;background:#0e1014;color:#edf0f4;padding:8px;font:12px/1.4 system-ui;outline:none}.mf-ai-send{align-self:stretch;border:1px solid #e7e9ed;background:#e7e9ed;color:#101217;border-radius:6px;padding:0 12px;font:700 10px system-ui;cursor:pointer}.mf-ai-send:disabled{opacity:.4}@media(max-width:760px){.mf-ai-launcher{right:12px;bottom:108px}.mf-ai-panel{left:8px;right:8px;bottom:112px;width:auto;height:min(70vh,620px)}}
  `;
  document.head.appendChild(style);
}
