import type { TConfigAi } from './config'
import type { TResult } from './tresult'

export async function Ai(config: TConfigAi, promt: { system?: string; user: string }): Promise<TResult<string>> {
	try {
		const messages: TAiMessage[] = []
		if (promt.system) {
			messages.push({ role: 'system', content: promt.system })
		}
		messages.push({ role: 'user', content: promt.user })

		const promptTokens = estimateTokens((promt.system || '') + promt.user)
		const answerReserve = 1024
		const ctxRaw = promptTokens + answerReserve
		const ctxRounded = roundUpToPowerOfTwo(ctxRaw)
		const num_ctx = config.is_num_ctx_dynamic
			? (ctxRounded < config.num_ctx ? ctxRounded : config.num_ctx)
			: config.num_ctx

		const requestBody: TAiRequest = {
			model: config.model,
			messages,
			format: undefined,
			options: {
				temperature: config.temperature || config.temperature === 0 ? config.temperature : undefined,
				num_ctx: num_ctx,
				top_k: config.top_k || config.top_k === 0 ? config.top_k : undefined,
				top_p: config.top_p || config.top_p === 0 ? config.top_p : undefined,
			},
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
				body: JSON.stringify(requestBody),
				signal: controller.signal,
			})

			clearTimeout(timeoutId)

			if (!response.ok) {
				const errorText = await response.text()
				return {
					ok: false,
					error: `AI API error (status=${response.status}, num_ctx=${num_ctx}): ${errorText}`,
				}
			}

			const data = (await response.json()) as TAiResponse

			if (!data.choices || data.choices.length === 0) {
				return { ok: false, error: `AI API returned no choices (num_ctx=${num_ctx})` }
			}

			const content = data.choices[0]?.message?.content

			return { ok: true, result: content || '' }
		} catch (error) {
			clearTimeout(timeoutId)
			if ((error as Error).name === 'AbortError') {
				return { ok: false, error: `AI request timeout after ${config.timeout}ms` }
			}
			throw error
		}
	} catch (error) {
		return { ok: false, error: `AI request failed: ${error}` }
	}
}

/**
 * Extract JSON from AI response by finding first { or [ and last matching closing bracket
 */
function extractJson(content: string): { error?: string; data?: any } {
	try {
		// Find first occurrence of { or [
		const openBrace = content.indexOf('{')
		const openBracket = content.indexOf('[')

		// Choose the one that appears first
		let start = -1
		let closingChar = ''

		if (openBrace !== -1 && openBracket !== -1) {
			start = Math.min(openBrace, openBracket)
			closingChar = start === openBrace ? '}' : ']'
		} else if (openBrace !== -1) {
			start = openBrace
			closingChar = '}'
		} else if (openBracket !== -1) {
			start = openBracket
			closingChar = ']'
		} else {
			return { error: 'No JSON object or array found in AI response' }
		}

		// Find last occurrence of corresponding closing bracket
		const end = content.lastIndexOf(closingChar)

		if (end === -1 || end <= start) {
			return { error: 'No matching closing bracket found in AI response' }
		}

		// Extract and parse JSON
		const jsonStr = content.substring(start, end + 1)
		const data = JSON.parse(jsonStr)
		return { data }
	} catch (error) {
		return { error: `Failed to parse JSON from AI response: "${error}"` }
	}
}

function estimateTokens(text: string): number {
	return Math.ceil(text.length / 3.5)
}

function roundUpToPowerOfTwo(n: number): number {
	if (n < 1) return 1
	return 2 ** Math.ceil(Math.log2(n))
}

// ============================================
// AI Request/Response Types
// ============================================

type TAiMessage = {
	role: 'system' | 'user' | 'assistant'
	content: string
}

type TAiRequest = {
	model: string
	messages: TAiMessage[]
	format: 'json' | undefined
	options?: {
		temperature?: number
		num_ctx?: number
		max_tokens?: number
		top_k?: number
		top_p?: number
	}
}

type TAiResponse = {
	choices: Array<{
		message: {
			role: string
			content: string
		}
		finish_reason: string
	}>
}
