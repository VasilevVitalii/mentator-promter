import { createHash } from 'crypto'

export function gethash(text: string): string {
	return createHash('sha256').update(text).digest('hex')
}
