#!/usr/bin/env bun

import { Go } from '../src/go'
import { ELoggerMode } from '../src/logger'

Go({
	log: {
		dir: './debug/log',
		mode: ELoggerMode.REWRITE,
	},
	prompt: {
		dir: './debug/ddl',
		template: {
			file: './debug/promt-ddl.txt',
			replace: '{{code}}',
		}
	},
	answer: {
		dir: './debug/answer',
		hashDir: './debug/hash'
	},
	ai: {
		kind: 'mentator',
		//url: 'http://localhost:11434',
		//model: 'qwen2.5-coder:14b-instruct',
		url: 'http://127.0.0.1:8099',
		model: 'Qwen2.5-Coder-7B-Instruct-Q5_K_M.0.gguf',
		timeout: 600000
	},
})
