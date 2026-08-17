# ModelForge Local AI

ModelForge can run its built-in AI assistant locally with Ollama. No cloud API key is required.

## 1. Install Ollama

Install Ollama for Windows from https://ollama.com/download/windows

## 2. Download the model

Run in PowerShell or CMD:

```bash
ollama pull qwen3:4b
```

Then confirm it works:

```bash
ollama run qwen3:4b
```

## 3. Allow the web app to call Ollama

When ModelForge is served from a browser origin such as GitHub Pages or localhost, Ollama must allow that origin. In PowerShell, before launching Ollama, set `OLLAMA_ORIGINS` to the origin you use for ModelForge.

For local development this can be:

```powershell
$env:OLLAMA_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
```

For GitHub Pages, add the exact origin you use, for example:

```powershell
$env:OLLAMA_ORIGINS="https://iammdtanvirrahman2007.github.io"
```

Restart Ollama after changing the environment variable.

## 4. Launch ModelForge

Open ModelForge normally. Press **✦ AI**. The assistant uses:

- Endpoint: `http://localhost:11434/v1/chat/completions`
- Model: `qwen3:4b`
- API key: not required

If Ollama is not running or the model is missing, the AI panel will show the local connection error.
