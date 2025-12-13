import minimist from 'minimist'
import { ConfigGerenate, ConfigRead } from './config'
import { resolve } from 'path'
import { Go } from './go'
import { VERSION } from '../package-version.js'

// Support both Bun and Node.js
const argv = typeof Bun !== 'undefined' ? Bun.argv : process.argv
const args = minimist(argv.slice(2))

if (args['conf-use']) {
	const confUseParam = args['conf-use']
	if (typeof confUseParam !== 'string' || confUseParam.trim().length === 0) {
		console.error('ERROR: Please provide a path to the config file. Example: --conf-use /path/to/config.jsonc')
	} else {
		const res = ConfigRead(resolve(confUseParam))
		if (res.error) {
			console.error(res.error)
		} else {
			Go(res.conf!)
		}
	}
} else if (args['conf-gen']) {
	const confGenParam = args['conf-gen']
	if (typeof confGenParam !== 'string' || confGenParam.trim().length === 0) {
		console.error('ERROR: Please provide a directory path to generate the config template. Example: --conf-gen /path/to/dir')
	} else {
		const res = ConfigGerenate(resolve(confGenParam))
		if (res.error) {
			console.error(res.error)
		} else {
			console.log(res.success)
		}
	}
} else {
	onHelp()
}

async function onHelp() {
	console.log(
		[
			`mentator-promter, version ${VERSION}`,
			`A utility for send promts to ollama`,
			``,
			`Usage modes:`,
			``,
			`1. Generate a configuration template file:`,
			`   --conf-gen /path/to/directory`,
			`   Creates a sample config file (JSONC format) for further editing.`,
			``,
			`2. Use this config got generate answers:`,
			`   --conf-use /path/to/your/config.jsonc`,
			`   Reads the config file and generates answers as described in the config.`,
			``,
			`For more details, see https://github.com/VasilevVitalii/mentator-promter`,
		].join('\n'),
	)
}
