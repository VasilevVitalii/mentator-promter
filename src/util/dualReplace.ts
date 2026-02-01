type TRepl = {
    find?: string | undefined,
    replace?: string | undefined,
}

export function dualReplace(input?: string, replace1?: TRepl, replace2?: TRepl): string | undefined {
    if (!input) return input
	const map = new Map<string, string>()
	if (replace1?.find && replace1?.replace) map.set(replace1.find, replace1.replace)
	if (replace2?.find && replace2?.replace) map.set(replace2.find, replace2.replace)
	const keys = [...map.keys()]
	if (keys.length === 0) return input
	const re = new RegExp(keys.map(escapeRegExp).join('|'), 'g')
	return input.replace(re, m => map.get(m) ?? m)
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
