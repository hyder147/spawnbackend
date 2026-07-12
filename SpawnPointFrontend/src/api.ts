// ─── Central API Client ───────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_BASE || 'http://localhost:5077/api';

const getToken = (): string | null => localStorage.getItem('spawnpoint_token');

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = getToken();

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    try {
        const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });

        if (res.status === 401) {
            // Only a "session expired" situation if we had a token to begin with.
            // Public auth endpoints (login/register/etc.) return 401 for bad
            // credentials and must NOT trigger a forced logout/redirect.
            if (token) {
                localStorage.removeItem('spawnpoint_token');
                localStorage.removeItem('spawnpoint_user');
                window.location.href = '/login';
                throw new Error('Session expired. Please login again.');
            }

            const error = await res.json().catch(() => ({ message: 'Unauthorized.' }));
            throw new Error(error.message || 'Unauthorized.');
        }

        if (res.status === 403) {
            throw new Error('You do not have permission for this action.');
        }

        if (res.status === 429) {
            throw new Error('Too many requests. Please wait!');
        }

        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
            throw new Error(error.message || `Server error: ${res.status}`);
        }

        if (res.status === 204) return null as T;

        return res.json();
    } catch (err) {
        if (err instanceof TypeError) {
            console.error('Network error:', err);
            throw new Error(`Check your URL, can't connect to the Backend: ${BASE_URL}`);
        }
        throw err;
    }
}

export const api = {
    get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
    post: <T>(endpoint: string, body?: unknown) =>
        request<T>(endpoint, {
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined
        }),
    put: <T>(endpoint: string, body?: unknown) =>
        request<T>(endpoint, {
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined
        }),
    patch: <T>(endpoint: string, body?: unknown) =>
        request<T>(endpoint, {
            method: 'PATCH',
            body: body ? JSON.stringify(body) : undefined
        }),
    delete: <T>(endpoint: string, body?: unknown) =>
        request<T>(endpoint, {
            method: 'DELETE',
            body: body ? JSON.stringify(body) : undefined
        }),
};