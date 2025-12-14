import { vvConfigJsonc, Type, type Static } from 'vv-config-jsonc'
import { join } from 'path'
import { fsWriteFileSync } from './util/fsWriteFile'
import { readFileSync } from 'fs'
import { ELoggerMode } from './logger'

export const SConfigAi = Type.Object({
	url: Type.String({
		default: 'http://localhost:11434',
		description: 'API base URL (Ollama: http://localhost:11434, OpenAI: https://api.openai.com/v1, Azure OpenAI: custom endpoint)',
	}),
	api_key: Type.Optional(
		Type.String({
			description: 'API key (optional for Ollama, required for OpenAI/Azure OpenAI)',
		}),
	),
	num_ctx: Type.Number({
		default: 32768,
		description: 'maximum context size supported by GPU and LLM',
	}),
	is_num_ctx_dynamic: Type.Boolean({
		default: true,
		description: 'automatically calculate context size based on prompt length',
	}),
	temperature: Type.Optional(Type.Number({
		default: 0.8,
		description: 'the temperature of the model. Increasing the temperature will make the model answer more creatively',
		minimum: 0,
		maximum: 2
	})),
	top_k: Type.Optional(Type.Number({
		default: 40,
		description: 'limits the selection of tokens to the top K most likely options. Higher values (e.g., 100) give more diversity, lower values (e.g., 10) are more conservative',
		minimum: 0,
		maximum: 1000
	})),
	top_p: Type.Optional(Type.Number({
		default: 0.95,
		description: 'works together with top-k. A higher value (e.g., 0.95) will lead to more diverse text, while a lower value (e.g., 0.5) will generate more focused and conservative text',
		minimum: 0,
		maximum: 1
	})),
	timeout: Type.Number({
		default: 600000,
		description: 'request timeout in milliseconds',
	}),
	model: Type.String({ default: 'deepseek-coder:6.7b', description: 'model name' }),
})
export type TConfigAi = Static<typeof SConfigAi>

export const SConfig = Type.Object({
	log: Type.Object({
		dir: Type.String({ description: 'full path to log directory', default: 'path/to/log' }),
		mode: Type.Enum(ELoggerMode, {
			description: 'REWRITE - write log to "mentator-promter.log"; APPEND - write log to "mentator-promter.YYYYMMDD-HHMMSS.log"',
			default: 'REWRITE',
		}),
	}),
	ai: Type.Array(SConfigAi),
	prompt: Type.Object({
		dir: Type.String({ description: 'full path to directory with prompt files', default: 'path/to/prompts' }),
		payload: Type.Optional(
			Type.Object({
				dir: Type.String({ description: 'full path to directory with payload files', default: 'path/to/payload' }),
				replace: Type.String({ description: 'placeholder in prompt to replace with payload content', default: '{{code}}' }),
			}),
		),
		verify_hash: Type.Boolean({
			default: true,
			description: 'skip processing prompt/payload files if content hash has not changed'
		})
	}),
	answer: Type.Object({
		dir: Type.String({ description: 'full path to directory for storing answer files', default: 'path/to/answers' }),
	}),
})
export type TConfig = Static<typeof SConfig>

export function ConfigGerenate(fullPath: string): { error?: string; success?: string } {
	const fullFileName = join(fullPath, `mentator-promter.config.TEMPLATE.jsonc`)
	try {
		const conf = new vvConfigJsonc(SConfig).getDefault()
		const resWrite = fsWriteFileSync(fullFileName, conf.text)
		if (!resWrite.ok) {
			return { error: `on create default config: ${resWrite.error}` }
		}
		return { success: `config create "${fullFileName}"` }
	} catch (err) {
		return { error: `on create default config: ${err}` }
	}
}

export function ConfigRead(fullFileName: string): { error?: string; conf?: TConfig } {
	try {
		const text = readFileSync(fullFileName, 'utf-8')
		const conf = new vvConfigJsonc(SConfig).getConfig(text)
		if (conf.errors.length > 0) {
			return { error: `error(s) in config "${fullFileName}": ${conf.errors.join('; ')}` }
		}
		fsWriteFileSync(fullFileName, conf.text)
		return { conf: conf.config }
	} catch (err) {
		return { error: `error read config "${fullFileName}": ${err}` }
	}
}
