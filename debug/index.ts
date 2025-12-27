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
			model: 'qwen2.5-coder:32b',
			num_ctx: 32768,
			timeout: 300000,
			is_num_ctx_dynamic: true,
			format: {
				type: 'array',
				items: {
					type: 'array',
					properties: {
						object_kind: {type: 'string'},
						object_name: {type: 'string'},
						database_name: {type: 'string'},
						schema_name: {type: 'string'},
						line_start: {type: 'number'},
						line_stop: {type: 'number'},
					},
					required : ['object_kind', 'object_name', 'schema_name']
				}
			},
			temperature: 0
		},
		{
			url: 'http://localhost:11434',
			model: 'qwen2.5-coder:14b-instruct',
			num_ctx: 32768,
			timeout: 300000,
			is_num_ctx_dynamic: true,
			format: {
				type: 'array',
				items: {
					type: 'array',
					properties: {
						object_kind: {type: 'string'},
						object_name: {type: 'string'},
						database_name: {type: 'string'},
						schema_name: {type: 'string'},
						line_start: {type: 'number'},
						line_stop: {type: 'number'},
					},
					required : ['object_kind', 'object_name', 'schema_name']
				}
			},
			temperature: 0
		},
	],
})
