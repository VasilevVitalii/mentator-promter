export function isEmptyObj(value: unknown): boolean {
	if (Array.isArray(value)) {
		return value.length === 0
	}

	if (value !== null && value !== undefined && typeof value === 'object') {
		if (Object.getPrototypeOf(value) !== Object.prototype) return false
		return Object.keys(value).length === 0
	}

	return true
}
