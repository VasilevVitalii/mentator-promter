import { dirname } from 'path'
import { mkdir, writeFile } from 'fs/promises'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import type { TResult } from '../tresult'

export async function fsWriteFile(fullFileName: string, text: string): Promise<TResult<null>> {
	try {
		const dir = dirname(fullFileName)
		await mkdir(dir, { recursive: true })
		await writeFile(fullFileName, text, { encoding: 'utf8' })
		return {ok: true, result: null}
	} catch (err) {
		return {ok: false, error: `on write "${fullFileName}": ${err}` }
	}
}

export function fsWriteFileSync(fullFileName: string, text: string): TResult<null> {
	try {
		const dir = dirname(fullFileName)
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true })
		}
		writeFileSync(fullFileName, text, { encoding: 'utf8' })
		return {ok: true, result: null}
	} catch (err) {
		return {ok: false, error: `on write "${fullFileName}": ${err}` }
	}
}
