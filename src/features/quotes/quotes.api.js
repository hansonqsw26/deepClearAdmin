import { apiFetch } from '../../api/http';

async function postJson(path, body) {
    const res = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || `Request failed (${res.status})`);
    return data;
}

/** Create a quote on behalf of a client. `quoteData.client_id` is required. */
export async function createQuote(quoteData) {
    if (!quoteData || !quoteData.client_id) throw new Error('Please choose the client this quote is for.');
    return postJson('/admin/createQuote', quoteData);
}

/** Paged list of all quotes (admin view). */
export async function fetchClientQuotes({ page = 1, limit = 10, clientName } = {}) {
    return postJson('/admin/getQuoteDetails', { page, limit, clientName });
}

/** Clients for dropdowns: [{ client_id, client_name }] */
export async function fetchClients() {
    const data = await postJson('/admin/getUsers', {});
    return data.data || [];
}
