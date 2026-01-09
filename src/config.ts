import { vvConfigJsonc, Type, type Static } from 'vv-config-jsonc'
import { join } from 'path'
import { fsWriteFileSync } from './util/fsWriteFile'
import { readFileSync } from 'fs'
import { ELoggerMode } from './logger'
import { PromtLoad, type TPromt } from 'vv-ai-promt-store'
import type { TResult } from './tresult'
import { fsReadFileSync } from './util/fsReadFile'

export const SConfigAi = Type.Object({
	kind: Type.Union([Type.Literal('openapi'), Type.Literal('mentator'), Type.Literal('ollama')], {description: 'USE openapi or ollama or llamacpp (mentator-llm-service) API'}),
	url: Type.String({
		default: 'http://localhost:11434',
		description: 'API URL',
	}),
	api_key: Type.Optional(
		Type.String({
			description: 'API key (optional for Ollama, required for OpenAI/Azure OpenAI)',
		}),
	),
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
	ai: SConfigAi,
	prompt: Type.Object({
		dir: Type.String({ description: 'full path to directory with prompt files', default: 'path/to/prompts' }),
		template: Type.Object({
			file: Type.String({ description: 'full path to file with promt template file', default: 'path/to/prompt.template.txt' }),
			replace: Type.String({ description: 'placeholder in prompt to replace with payload content', default: '{{code}}' }),
		}),
	}),
	answer: Type.Object({
		dir: Type.String({ description: 'full path to directory for storing answer files', default: 'path/to/answers' }),
		hashDir: Type.Optional(Type.String({ description: 'full path to directory for storing hash files', default: 'path/to/hash' })),
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

export function TemplateRead(fullFileName: string): TResult<TPromt> {
	try {
		const rawRes = fsReadFileSync(fullFileName)
		if (!rawRes.ok) {
			return {ok: false, error: `on load template "${fullFileName}": ${rawRes.error}`}
		}
		const promtList = PromtLoad(rawRes.result)
		const promt = promtList.find(f => f)
		if (!promt) {
			return {ok: false, error: `not found template in file "${fullFileName}"`}
		}
		return {ok: true, result: promt}
	} catch (err) {
		return {ok: false, error: `on parse template "${fullFileName}": ${err}`}
	}
}