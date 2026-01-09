import { CheckJsonSchema, ToPromtOptionsLlamaCpp, ToPromtOptionsOllama, ToPromtOptionsOpenAi, type TPromt } from 'vv-ai-promt-store'
import type { TConfigAi } from './config'
import type { TResult } from './tresult'
import type { format } from 'jsonc-parser'

export async function Ai(config: TConfigAi, promt: TPromt, jsonresponse?: string): Promise<TResult<string>> {
	try {
		switch (config.kind) {
			case 'mentator':
				return AiMentator(config, promt, jsonresponse)
			case 'openapi':
				return AiOpenApi(config, promt, jsonresponse)
			case 'ollama':
				return AiOllama(config, promt, jsonresponse)
			default:
				throw new Error(`unknown kind AI API ${config.kind}`)
		}
	} catch (error) {
		return { ok: false, error: `${error}` }
	}
}

type TOpenApiResponse = {
	choices: Array<{
		message: {
			role: string
			content: string
		}
		finish_reason: string
	}>
}

async function AiOpenApi(config: TConfigAi, promt: TPromt, jsonresponse?: string): Promise<TResult<string>> {
	try {
		if (jsonresponse) {
			const validationError = CheckJsonSchema(jsonresponse)
			if (validationError) {
				throw new Error(`on check jsonresponse: ${validationError}`)
			}
		}

		const requestPayload = {
			model: config.model,
			stream: false,
			messages: [
				{ role: 'user', content: promt.user },
				{ role: 'system', content: promt.system },
			].filter(f => f.content),
			...ToPromtOptionsOpenAi(promt.options || {}, jsonresponse),
		}

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		}
		if (config.api_key) {
			headers['Authorization'] = `Bearer ${config.api_key}`
		}

		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), config.timeout)

		try {
			const response = await fetch(`${config.url}/v1/chat/completions`, {
				method: 'POST',
				headers,
				body: JSON.stringify(requestPayload),
				signal: controller.signal,
			})

			clearTimeout(timeoutId)

			if (!response.ok) {
				const errorText = await response.text()
				return {
					ok: false,
					error: `Ollama API error (status=${response.status}): ${errorText}`,
				}
			}

			const data = (await response.json()) as TOpenApiResponse

			if (!data.choices || data.choices.length === 0) {
				return { ok: false, error: 'Ollama API returned no choices' }
			}

			const content = data.choices[0]?.message?.content

			return { ok: true, result: content || '' }
		} catch (error) {
			clearTimeout(timeoutId)
			if ((error as Error).name === 'AbortError') {
				return { ok: false, error: `Ollama request timeout after ${config.timeout}ms` }
			}
			throw error
		}
	} catch (error) {
		return { ok: false, error: `OpenApi request failed: ${error}` }
	}
}

type TOllamaResponse = {
	model: string
	created_at: string
	message: {
		role: string
		content: string
	}
	done: boolean
	done_reason?: string
	total_duration?: number
	load_duration?: number
	prompt_eval_count?: number
	eval_count?: number
	eval_duration?: number
}

async function AiOllama(config: TConfigAi, promt: TPromt, jsonresponse?: string): Promise<TResult<string>> {
	try {
		const options = ToPromtOptionsOllama(promt.options || {})

		const requestPayload: Record<string, any> = {
			model: config.model,
			stream: false,
			messages: [
				{ role: 'user', content: promt.user },
				{ role: 'system', content: promt.system },
			].filter(f => f.content),
		}

		if (Object.keys(options).length > 0) {
			requestPayload.options = options
		}

		if (jsonresponse) {
			const validationError = CheckJsonSchema(jsonresponse)
			if (validationError) {
				throw new Error(`on check jsonresponse: ${validationError}`)
			}
			requestPayload.format = JSON.parse(jsonresponse)
		}

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		}
		if (config.api_key) {
			headers['Authorization'] = `Bearer ${config.api_key}`
		}

		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), config.timeout)

		try {
			const response = await fetch(`${config.url}/api/chat`, {
				method: 'POST',
				headers,
				body: JSON.stringify(requestPayload),
				signal: controller.signal,
			})

			clearTimeout(timeoutId)

			if (!response.ok) {
				const errorText = await response.text()
				return {
					ok: false,
					error: `Ollama API error (status=${response.status}): ${errorText}`,
				}
			}

			const data = (await response.json()) as TOllamaResponse

			if (!data.message || !data.message.content) {
				return { ok: false, error: 'Ollama API returned no message content' }
			}

			return { ok: true, result: data.message.content }
		} catch (error) {
			clearTimeout(timeoutId)
			if ((error as Error).name === 'AbortError') {
				return { ok: false, error: `Ollama request timeout after ${config.timeout}ms` }
			}
			throw error
		}
	} catch (error) {
		return { ok: false, error: `Ollama request failed: ${error}` }
	}
}

type TMentatorResponse = {
	duration: {
		promtMsec: number
		queueMsec: number
	}
	result: {
		loadModelStatus: 'load' | 'exists'
		data: any
	}
}

type TMentatorErrorResponse = {
	duration: {
		promtMsec: number
		queueMsec: number
	}
	error: string
}

async function AiMentator(config: TConfigAi, promt: TPromt, jsonresponse?: string): Promise<TResult<string>> {
	try {
		const requestPayload: Record<string, any> = {
			model: config.model,
			message: {
				user: promt.user,
				system: promt.system
			},
			durationMsec: config.timeout,
			options: promt.options
		}

		if (jsonresponse) {
			const validationError = CheckJsonSchema(jsonresponse)
			if (validationError) {
				throw new Error(`on check jsonresponse: ${validationError}`)
			}
			requestPayload.format = {
				useGrammar: true,
				jsonSchema: JSON.parse(jsonresponse)
			}
		}

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		}
		if (config.api_key) {
			headers['Authorization'] = `Bearer ${config.api_key}`
		}

		const response = await fetch(`${config.url}/promt`, {
			method: 'POST',
			headers,
			body: JSON.stringify(requestPayload),
		})

		if (!response.ok) {
			const errorData = (await response.json()) as TMentatorErrorResponse
			return {
				ok: false,
				error: `Mentator API error (status=${response.status}): ${errorData.error}`,
			}
		}

		const data = (await response.json()) as TMentatorResponse

		if (!data.result || data.result.data === undefined) {
			return { ok: false, error: 'Mentator API returned no data' }
		}

		const resultString = typeof data.result.data === 'string' ? data.result.data : JSON.stringify(data.result.data)

		return { ok: true, result: resultString }
	} catch (error) {
		return { ok: false, error: `Mentator request failed: ${error}` }
	}
}
