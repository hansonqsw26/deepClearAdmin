/**
 * Documents: upload them and open them.
 *
 * Uploads go straight from the browser to DeepClear's private S3 bucket through
 * S3 Transfer Acceleration (much faster from China than sending the file to the
 * server in Ohio). If the API or S3 can't be reached that way, the file is sent
 * to the API as before (multipart), so uploads never get stuck.
 *
 * Opening: documents are private, so a stored link (file_link) is swapped for a
 * short-lived signed link from the API. Against an older API without that
 * endpoint the stored link is opened as before.
 */
import { apiFetch } from './http';
import { APP_ROLE } from '../config/env';

async function readJson(res) {
    try {
        return await res.json();
    } catch (e) {
        return {};
    }
}

function postJson(path, body) {
    return apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

/** PUT the file to S3. Resolves true when S3 accepted it. */
function putToS3(url, headers, file, onProgress) {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url);
        Object.entries(headers || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        if (onProgress) {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
            };
        }
        xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
        xhr.onerror = () => resolve(false);
        xhr.ontimeout = () => resolve(false);
        xhr.timeout = 15 * 60 * 1000;
        xhr.send(file);
    });
}

async function sendMultipart(path, fields, file) {
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => {
        if (v !== undefined && v !== null) form.append(k, String(v));
    });
    form.append('file', file);
    const res = await apiFetch(path, { method: 'POST', body: form });
    return { ok: res.ok, status: res.status, data: await readJson(res) };
}

/**
 * Upload one file to an upload route, e.g. uploadDocument('/uploadFile', { ticket_id, file_type }, file).
 * Resolves with { ok, status, data } like a fetch call that already read the JSON.
 */
export async function uploadDocument(route, fields, file, { onProgress } = {}) {
    const path = `/${APP_ROLE}${route}`;
    let start = null;
    try {
        const res = await postJson(`/${APP_ROLE}/uploadUrl`, { file_name: file.name, size: file.size });
        const data = await readJson(res);
        // A clear "no" (wrong type, too large) is shown to the user as is.
        if (res.status === 400) return { ok: false, status: 400, data };
        if (res.ok && data.mode === 's3') start = data;
    } catch (e) {
        start = null;
    }

    if (start && (await putToS3(start.upload_url, start.headers, file, onProgress))) {
        const res = await postJson(path, {
            ...fields,
            uploaded_key: start.uploaded_key,
            upload_token: start.upload_token,
            file_name: file.name,
        });
        return { ok: res.ok, status: res.status, data: await readJson(res) };
    }
    return sendMultipart(path, fields, file);
}

/** A short-lived link that opens a stored document, or the stored link on an older API. */
export async function documentUrl(link) {
    const res = await postJson('/files/link', { link });
    const data = await readJson(res);
    if (res.ok && data.url) return data.url;
    // Older API without this endpoint: its catch-all 404 says "Not found."
    if (res.status === 404 && data.error === 'Not found.') return link;
    throw new Error(data.error || `Could not open the file (${res.status})`);
}

/** Open a stored document in a new tab. */
export async function openDocument(link) {
    // Open the tab now (inside the click) so pop-up blockers allow it, then point it at the file.
    const win = window.open('', '_blank');
    try {
        const url = await documentUrl(link);
        if (win) {
            win.opener = null;
            win.location.href = url;
        } else {
            window.location.href = url;
        }
    } catch (e) {
        if (win) win.close();
        window.alert(e.message);
    }
}

/** Click handler for <a href={file_link}>: opens it through openDocument. */
export function documentClick(link) {
    return (event) => {
        event.preventDefault();
        openDocument(link);
    };
}
