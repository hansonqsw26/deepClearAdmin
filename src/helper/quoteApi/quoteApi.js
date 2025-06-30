export const createQuote = async (quoteData) => {
    const storedData = localStorage.getItem("adminUser");
    if (!storedData) throw new Error("User data not found in localStorage. Please log in.");

    const { localId } = JSON.parse(storedData);
    if (!localId) throw new Error("Admin ID (localId) not found. Please log in.");

    try {
        const response = await fetch("https://deepclear.ca/api/client/createQuote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...quoteData, client_id: localId }),
        });

        const result = await response.json();
        if (response.ok) return result;
        else throw new Error(result.error || "Failed to create quote");
    } catch (error) {
        console.error("Error submitting quote:", error);
        throw error;
    }
};

export async function fetchClientQuotes({ localId, page = 1, limit = 10 }) {
    const res = await fetch(`https://deepclear.ca/api/admin/getQuoteDetails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({clientId: localId, page, limit }),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch quotes.");
    }
    return res.json();
}