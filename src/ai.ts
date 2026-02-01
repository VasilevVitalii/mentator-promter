import type { TConfigAi } from './config'
import type { TResult } from './tresult'
import {CheckJsonSchema, type TPrompt, ToPromptOptionsOllama, ToPromptOptionsOpenAi} from 'vv-ai-prompt-format'

function getEffectiveConfig(config: TConfigAi, prompt: TPrompt): { url: string; model: string } {
	return {
		url: prompt.llm?.url || config.url,
		model: prompt.llm?.model || config.model,
	}
}

export async function Ai(config: TConfigAi, prompt: TPrompt): Promise<TResult<string>> {
	switch (config.kind) {
		case 'mentator':
			return AiMentator(config, prompt)
		case 'openapi':
			return AiOpenApi(config, prompt)
		case 'ollama':
			return AiOllama(config, prompt)
		default:
			return { ok: false, error: `unknown kind AI API ${config.kind}` }
	}
}

type TOpenApiResponse = {
	choices: Array<{
		message: {
			content: string
		}
	}>
}

async function AiOpenApi(config: TConfigAi, prompt: TPrompt): Promise<TResult<string>> {
	try {
		const { url, model } = getEffectiveConfig(config, prompt)

		if (prompt.jsonresponse) {
			const validationError = CheckJsonSchema(prompt.jsonresponse)
			if (validationError) {
				throw new Error(`on check jsonresponse: ${validationError}`)
			}
		}

		const requestPayload = {
			model,
			stream: false,
			messages: [
				{ role: 'system', content: prompt.system },
				{ role: 'user', content: prompt.user },
			].filter(f => f.content),
			...ToPromptOptionsOpenAi(prompt.options || {}, prompt.jsonresponse),
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
			const response = await fetch(`${url}/v1/chat/completions`, {
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
					error: `OpenAI API error (status=${response.status}): ${errorText}`,
				}
			}

			const data = (await response.json()) as TOpenApiResponse

			if (!data.choices || data.choices.length === 0 || data.choices[0]?.message?.content === undefined) {
				return { ok: false, error: 'OpenAI API returned no content' }
			}

			return { ok: true, result: data.choices[0].message.content }
		} catch (error) {
			clearTimeout(timeoutId)
			if ((error as Error).name === 'AbortError') {
				return { ok: false, error: `OpenAI request timeout after ${config.timeout}ms` }
			}
			throw error
		}
	} catch (error) {
		return { ok: false, error: `OpenApi request failed: ${error}` }
	}
}

type TOllamaResponse = {
	message: {
		content: string
	}
}

async function AiOllama(config: TConfigAi, prompt: TPrompt): Promise<TResult<string>> {
	try {
		const { url, model } = getEffectiveConfig(config, prompt)
		const options = ToPromptOptionsOllama(prompt.options || {})

		const requestPayload: Record<string, any> = {
			model,
			stream: false,
			messages: [
				{ role: 'system', content: prompt.system },
				{ role: 'user', content: prompt.user },
			].filter(f => f.content),
		}

		if (Object.keys(options).length > 0) {
			requestPayload.options = options
		}

		if (prompt.jsonresponse) {
			const validationError = CheckJsonSchema(prompt.jsonresponse)
			if (validationError) {
				throw new Error(`on check jsonresponse: ${validationError}`)
			}
			requestPayload.format = JSON.parse(prompt.jsonresponse)
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
			const response = await fetch(`${url}/api/chat`, {
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

			if (!data.message || data.message.content === undefined) {
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
	result: {
		data: any
	}
}

async function AiMentator(config: TConfigAi, prompt: TPrompt): Promise<TResult<string>> {
	try {
		const { url, model } = getEffectiveConfig(config, prompt)

		const requestPayload: Record<string, any> = {
			model,
			message: {
				user: prompt.user,
				system: prompt.system
			},
			durationMsec: config.timeout,
			options: prompt.options
		}

		if (prompt.jsonresponse) {
			const validationError = CheckJsonSchema(prompt.jsonresponse)
			if (validationError) {
				throw new Error(`on check jsonresponse: ${validationError}`)
			}
			requestPayload.format = {
				useGrammar: true,
				jsonSchema: JSON.parse(prompt.jsonresponse)
			}
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
			const response = await fetch(`${url}/prompt`, {
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
					error: `Mentator API error (status=${response.status}): ${errorText}`,
				}
			}

			const data = (await response.json()) as TMentatorResponse

			if (!data.result || data.result.data === undefined) {
				return { ok: false, error: 'Mentator API returned no data' }
			}

			const resultString = typeof data.result.data === 'string' ? data.result.data : JSON.stringify(data.result.data)

			return { ok: true, result: resultString }
		} catch (error) {
			clearTimeout(timeoutId)
			if ((error as Error).name === 'AbortError') {
				return { ok: false, error: `Mentator request timeout after ${config.timeout}ms` }
			}
			throw error
		}
	} catch (error) {
		return { ok: false, error: `Mentator request failed: ${error}` }
	}
}
