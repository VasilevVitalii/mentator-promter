#!/usr/bin/env bun

import { Go } from '../src/go'
import { ELoggerMode } from '../src/logger'

Go({
	log: {
		dir: './debug/log',
		mode: ELoggerMode.REWRITE,
	},
	prompt: {
		dir: './debug/promt',
		payload: {
			dir: './debug/ddl',
			replace: '{{code}}',
		},
		verify_hash: true
	},
	answer: {
		dir: './debug/answer',
	},
	ai: [
		{
			url: 'http://localhost:11434',
			model: 'deepseek-coder:6.7b',
			num_ctx: 32768,
			timeout: 300000,
			is_num_ctx_dynamic: true,
		},
		{
			url: 'http://localhost:11434',
			model: 'qwen2.5-coder:14b',
			num_ctx: 32768,
			timeout: 300000,
			is_num_ctx_dynamic: true,
		},
	],
})
