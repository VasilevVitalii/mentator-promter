import { dirname } from 'path'
import { access, unlink } from 'fs/promises'
import { readFileSync, accessSync, unlinkSync } from 'fs'
import type { TResult } from '../tresult'

export async function fsDeleteFile(fullFileName: string): Promise<TResult<null>> {
    let fileExists = false
    try {
        await access(fullFileName)
        fileExists = true
    } catch {
        fileExists = false
    }
    if (!fileExists) {
        return {result: null, ok: true}
    }
    try {
        await unlink (fullFileName)
        return { result: null, ok: true }
    } catch (err) {
        return { error: `on delete file "${fullFileName}": ${err}`, ok: false }
    }
}

export function fsDeleteFileSync(fullFileName: string): TResult<null> {
    let fileExists = false
    try {
        accessSync(fullFileName)
        fileExists = true
    } catch {
        fileExists = false
    }
    if (!fileExists) {
        return {result: null, ok: true}
    }

    try {
        unlinkSync(fullFileName)
        return { result: null, ok: true }
    } catch (err) {
        return { error: `on delete "${fullFileName}": ${err}`, ok: false }
    }
}
