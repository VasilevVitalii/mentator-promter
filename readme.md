<div id="badges">
  <a href="https://www.linkedin.com/in/vasilev-vitalii/">
    <img src="https://img.shields.io/badge/LinkedIn-blue?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn Badge"/>
  </a>
  <a href="https://www.youtube.com/@user-gj9vk5ln5c/featured">
    <img src="https://img.shields.io/badge/YouTube-red?style=for-the-badge&logo=youtube&logoColor=white" alt="Youtube Badge"/>
  </a>
</div>

[Русский](readme.rus.md)

# mentator-promter

A utility for batch processing prompts through AI models (Ollama, OpenAI, Azure OpenAI) with template support.

## Description

**mentator-promter** is a command-line tool that allows you to:
- Send multiple prompts to one or more AI models
- Use prompt templates with payload files
- Automatically save AI responses to files
- Work with Ollama, OpenAI, and Azure OpenAI

## Features

- **Two operation modes**:
  - Direct prompts: send prompts to AI as-is
  - Template mode: replace placeholders in prompts with content from payload files
- **Multiple AI models**: configure multiple models and send each prompt to all of them
- **Dynamic context sizing**: automatically calculate optimal context size based on prompt length
- **Hash-based caching**: skip processing files that haven't changed (based on SHA-256 hash)
- **Flexible logging**: choose between rewriting or appending to log files
- **Type-safe configuration**: uses JSONC format with schema validation

## Installation

```bash
npm install
npm run build:linux  # for Linux
# or
npm run build:win    # for Windows
```

The compiled binary will be available in the `dist` directory.

## Usage

### 1. Generate configuration template

```bash
./mentator-promter --conf-gen /path/to/directory
```

This creates a `mentator-promter.config.TEMPLATE.jsonc` file with default settings.

### 2. Edit configuration

Edit the generated configuration file to specify:
- AI model settings (URL, API key, model name, context size, timeout)
- Directories for prompts, payloads, answers, and logs
- Logging mode

Example configuration:

```jsonc
{
  "log": {
    "dir": "/path/to/logs",
    "mode": "REWRITE"  // or "APPEND"
  },
  "ai": [
    {
      "url": "http://localhost:11434",
      "model": "deepseek-coder:6.7b",
      "num_ctx": 32768,
      "is_num_ctx_dynamic": true,
      "temperature": 0.8,  // optional: creativity level (0-2)
      "top_k": 40,         // optional: token selection limit
      "top_p": 0.95,       // optional: cumulative probability threshold
      "format": "json",    // optional: output format (see below)
      "timeout": 600000
    }
  ],
  "prompt": {
    "dir": "/path/to/prompts",
    "payload": {  // optional
      "dir": "/path/to/payload",
      "replace": "{{code}}"
    },
    "verify_hash": true  // skip files if content hasn't changed
  },
  "answer": {
    "dir": "/path/to/answers"
  }
}
```

### 3. Run the utility

```bash
./mentator-promter --conf-use /path/to/your/config.jsonc
```

## Operation Modes

### Direct Prompt Mode

If `payload` is not specified in the configuration:
1. Reads prompt files from `prompt.dir`
2. Sends each prompt to all configured AI models
3. Saves responses to `answer.dir/{prompt_file}/{prompt_name}.answer-{prompt_idx}-{ai_idx}.txt`

### Template Mode

If `payload` is specified in the configuration:
1. Reads payload files from `prompt.payload.dir`
2. Reads prompt templates from `prompt.dir`
3. Replaces placeholder (e.g., `{{code}}`) in prompts with payload content
4. Sends each combination (payload × prompt) to all AI models
5. Saves responses to `answer.dir/{payload_file}/{payload_name}.answer-{prompt_file_idx}-{prompt_idx}-{ai_idx}.txt`

## Prompt Format

Prompts use a special format to define system and user messages. See [vv-ai-promt-store](https://github.com/VasilevVitalii/vv-ai-promt-store) for details.

Example prompt file:

```
$$begin
$$system
You are a helpful coding assistant.

$$user
Explain this code:
{{code}}
$$end
```

## AI Provider Support

- **Ollama**: `http://localhost:11434` (no API key required)
- **OpenAI**: `https://api.openai.com/v1` (API key required)
- **Azure OpenAI**: custom endpoint (API key required)

## Configuration Options

### AI Settings

- `url`: API base URL
- `api_key`: API key (optional for Ollama, required for OpenAI/Azure)
- `model`: Model name
- `num_ctx`: Maximum context size
- `is_num_ctx_dynamic`: Automatically calculate context size based on prompt length
- `temperature`: (optional) Controls randomness/creativity of responses (0-2). Higher values (e.g., 1.5) make output more creative, lower values (e.g., 0.3) more focused and deterministic
- `top_k`: (optional) Limits token selection to top K most likely options (0-1000). Higher values (e.g., 100) give more diversity, lower values (e.g., 10) are more conservative
- `top_p`: (optional) Cumulative probability threshold (0-1). Works with top_k. Higher values (e.g., 0.95) lead to more diverse text, lower values (e.g., 0.5) generate more focused text
- `format`: (optional) Output format for AI responses. See [Ollama Structured Outputs](https://ollama.com/blog/structured-outputs) for details. Three options:
  - `null` or omit: No formatting (default)
  - `"json"`: Basic JSON formatting - AI will return valid JSON
  - JSON Schema object: Structured output with validation
    - **Object example** (person data):
      ```jsonc
      {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "age": { "type": "number" },
          "email": { "type": "string" },
          "is_active": { "type": "boolean" }
        },
        "required": ["name", "age"]
      }
      ```
    - **Array example** (list of tasks):
      ```jsonc
      {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "task": { "type": "string" },
            "priority": { "type": "string", "enum": ["low", "medium", "high"] },
            "completed": { "type": "boolean" }
          },
          "required": ["task", "priority"]
        }
      }
      ```
  - **Tip**: Set `temperature: 0` for deterministic JSON output
- `timeout`: Request timeout in milliseconds

### Prompts

- `prompt.dir`: Full path to directory with prompt files
- `prompt.payload.dir`: Full path to directory with payload files (optional, for template mode)
- `prompt.payload.replace`: Placeholder string to replace with payload content (default: `{{code}}`)
- `prompt.verify_hash`: Skip processing files if content hash hasn't changed (default: `true`)
  - When enabled, the utility calculates SHA-256 hash of each file and saves it
  - On subsequent runs, files with unchanged hashes are skipped
  - Hash is saved only after successful processing of all prompts in the file
  - This significantly speeds up re-runs when only some files have changed

### Logging

- `log.dir`: Full path to log directory
- `log.mode`:
  - `REWRITE`: Write log to `mentator-promter.log` (overwrites on each run)
  - `APPEND`: Write log to `mentator-promter.YYYYMMDD-HHMMSS.log` (creates new file each run)

## Requirements

- Node.js 18+ or Bun
- Access to at least one AI provider (Ollama, OpenAI, or Azure OpenAI)

## License

MIT

## Author

Vitalii Vasilev