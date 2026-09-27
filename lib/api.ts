export const apiBaseUrl = '/backend-api'
const apiUrl = apiBaseUrl

let csrfPromise: Promise<void> | null = null
type ApiRequestInit = RequestInit & { skipCsrf?: boolean }

async function ensureCsrfCookie() {
	if (!csrfPromise) {
		csrfPromise = fetch(`${apiBaseUrl}/csrf-cookie`, {
			credentials: 'include',
		}).then((response) => {
			if (!response.ok) {
				throw new Error('Unable to initialize secure session.')
			}
		}).finally(() => {
			csrfPromise = null
		})
	}

	return csrfPromise
}

export async function apiFetch(path: string, init: ApiRequestInit = {}) {
	const { skipCsrf = false, ...requestInit } = init
	const method = requestInit.method?.toUpperCase() ?? 'GET'
	if (!skipCsrf && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
		await ensureCsrfCookie()
	}

	const headers = new Headers(requestInit.headers)
	if (requestInit.body && !headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json')
	}

	const xsrfToken = document.cookie
		.split('; ')
		.find((cookie) => cookie.startsWith('XSRF-TOKEN='))
		?.split('=')[1]

	if (xsrfToken) {
		headers.set('X-XSRF-TOKEN', decodeURIComponent(xsrfToken))
	}

	const controller = new AbortController()
	const timeout = window.setTimeout(() => controller.abort(), 10000)

	try {
		return await fetch(`${apiUrl}${path}`, {
		...requestInit,
		headers,
		credentials: 'include',
			signal: requestInit.signal ?? controller.signal,
		})
	} finally {
		window.clearTimeout(timeout)
	}
}
