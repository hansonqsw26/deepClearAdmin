/**
 * Customs ticket API calls. The same file is used by both portals; APP_ROLE
 * picks /admin/* or /client/* (the API enforces what each role may do).
 */
import { apiFetch } from '../../api/http';
import { uploadDocument } from '../../api/files';
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
    refreshEtas: (mainId) => call('/refreshCbEtas', { main_id: mainId }),
    setEntry: (mainId, transactionNumber, containerIds) => call('/setCbEntry', { main_id: mainId, transaction_number: transactionNumber, container_ids: containerIds }),
    comment: (mainId, message, internal = false) => call('/addCbComment', { main_id: mainId, message, internal }),
    setStage: (mainId, stage, message) => call('/setCbStage', { main_id: mainId, stage, message }),
    dashboard: () => call('/dashboard'),
    clients: () => call('/getUsers'),

    /** Upload one document to a customs ticket (cb_id). */
    async upload(cbId, fileType, file, containerNumber = '') {
        const { ok, status, data } = await uploadDocument('/uploadFile', {
            ticket_id: cbId, ticket_kind: 'cb', file_type: fileType, container_number: containerNumber,
        }, file);
        if (!ok) throw new Error(data.error || `Upload failed (${status})`);
        return data;
    },

    deleteFile: (fileId) => call('/deleteFile', { file_id: fileId }),
};

/** Importer profiles and their POA (one or more per client). */
export const importersApi = {
    list: (clientId) => call('/listImporters', IS_ADMIN ? { client_id: clientId } : {}),
    save: (body) => call('/saveImporter', body),
    remove: (importerId) => call('/removeImporter', { importer_id: importerId }),
    async uploadPoa(importerId, file, extra = {}) {
        const fields = { importer_id: importerId };
        for (const [k, v] of Object.entries(extra)) if (v) fields[k] = v;
        const { ok, status, data } = await uploadDocument('/uploadImporterPoa', fields, file);
        if (!ok) throw new Error(data.error || `Upload failed (${status})`);
        return data;
    },
};
