/**
 * Customs ticket API calls. The same file is used by both portals; APP_ROLE
 * picks /admin/* or /client/* (the API enforces what each role may do).
 */
import { apiFetch } from '../../api/http';
import { APP_ROLE } from '../../config/env';

export const IS_ADMIN = APP_ROLE === 'admin';

/** POST JSON to /<role><path>. Resolves with the JSON body or throws an Error with .fields. */
export async function call(path, body = {}) {
    const res = await apiFetch(`/${APP_ROLE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    let data = null;
    try {
        data = await res.json();
    } catch (e) {
        data = null;
    }
    if (!res.ok) {
        const err = new Error((data && (data.error || data.message)) || `Request failed (${res.status})`);
        err.status = res.status;
        err.fields = (data && data.fields) || {};
        throw err;
    }
    return data;
}

export const customsApi = {
    list: (filters) => call('/fetchCbTicket', filters),
    get: (mainId) => call('/getCbTicket', { main_id: mainId }),
    options: () => call('/getCbOptions'),
    create: (body) => call('/createCbTicket', body),
    update: (mainId, body) => call('/updateCbTicket', { main_id: mainId, ...body }),
    addContainer: (mainId, body) => call('/addCbContainer', { main_id: mainId, ...body }),
    updateContainer: (containerId, body) => call('/updateCbContainer', { container_id: containerId, ...body }),
    removeContainer: (containerId) => call('/removeCbContainer', { container_id: containerId }),
    comment: (mainId, message, internal = false) => call('/addCbComment', { main_id: mainId, message, internal }),
    setStage: (mainId, stage, message) => call('/setCbStage', { main_id: mainId, stage, message }),
    dashboard: () => call('/dashboard'),
    clients: () => call('/getUsers'),

    /** Upload one document to a customs ticket (cb_id). */
    async upload(cbId, fileType, file, containerNumber = '') {
        const form = new FormData();
        form.append('ticket_id', String(cbId));
        form.append('ticket_kind', 'cb');
        form.append('file_type', fileType);
        form.append('container_number', containerNumber);
        form.append('file', file);
        const res = await apiFetch(`/${APP_ROLE}/uploadFile`, { method: 'POST', body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
        return data;
    },

    deleteFile: (fileId) => call('/deleteFile', { file_id: fileId }),
};
