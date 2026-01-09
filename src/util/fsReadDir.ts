import { promises as fs, readdirSync } from 'fs'
import * as path from 'path'
import type { TResult } from '../tresult'

export async function fsReadDir(dir: string): Promise<TResult<string[]>> {
	try {
        const result = await fsReadDirInternal(dir)
        return {ok: true, result}
    } catch (err) {
        return {ok: false, error: `on read dir ${dir}: "${err}"`}
    }
}

export function fsReadDirSync(dir: string): TResult<string[]> {
	try {
        const result = fsReadDirInternalSync(dir)
        return {ok: true, result}
    } catch (err) {
        return {ok: false, error: `on read dir ${dir}: "${err}"`}
    }
}

async function fsReadDirInternal(dir: string, baseDir: string = dir): Promise<string[]> {
	const entries = await fs.readdir(dir, { withFileTypes: true })
	const files: string[] = []

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name)
		const relativePath = path.relative(baseDir, fullPath)

		if (entry.isDirectory()) {
			const subFiles = await fsReadDirInternal(fullPath, baseDir)
			files.push(...subFiles)
		} else if (entry.isFile()) {
			files.push(relativePath)
		}
	}

	return files
}

function fsReadDirInternalSync(dir: string, baseDir: string = dir): string[] {
	const entries = readdirSync(dir, { withFileTypes: true })
	const files: string[] = []

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name)
		const relativePath = path.relative(baseDir, fullPath)

		if (entry.isDirectory()) {
			const subFiles = fsReadDirInternalSync(fullPath, baseDir)
			files.push(...subFiles)
		} else if (entry.isFile()) {
			files.push(relativePath)
		}
	}

	return files
}