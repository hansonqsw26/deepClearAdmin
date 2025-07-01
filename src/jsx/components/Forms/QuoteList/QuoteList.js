import React, { useEffect, useState } from "react";
import "./QuotesList.css";

const QuotesList = () => {
  const [quotesData, setQuotesData] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalQuotes, setTotalQuotes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [clientNameFilter, setClientNameFilter] = useState("");

  // Editable states
  const [editingPrices, setEditingPrices] = useState({}); // quote_id => string
  const [editingAdminNotes, setEditingAdminNotes] = useState({}); // quote_id => string

  // Editing modes
  const [priceEditMode, setPriceEditMode] = useState(new Set()); // quote_id in edit mode
  const [adminNoteEditMode, setAdminNoteEditMode] = useState(new Set()); // quote_id in edit mode

  // Saving state
  const [savingQuoteIds, setSavingQuoteIds] = useState(new Set());

  const getStatusLabel = (status) => {
    if (status === 0) return "Pending";
    if (status === 1) return "Got Quote Price";
    return "Unknown";
  };

  const getContainerTypeLabel = (type) => {
    switch (type) {
      case 1: return "Pallet";
      case 2: return "Box";
      case 3: return "Crate";
      default: return "Unknown";
    }
  };

  const convertEditableNumbersToStrings = (data) =>
      data.map((quoteItem) => ({
        ...quoteItem,
        quote: {
          ...quoteItem.quote,
          departure_address: quoteItem.quote.departure_address || "",
          arrvial_address: quoteItem.quote.arrvial_address || "",
          client_note: quoteItem.quote.client_note || "",
          client_name: quoteItem.quote.client_name || "",
          admin_note: quoteItem.quote.admin_note || "",
          price: quoteItem.quote.price != null ? String(quoteItem.quote.price) : "",
        },
        cargoItems: quoteItem.cargoItems.map((c) => ({
          ...c,
          length: c.length != null ? String(c.length) : "",
          width: c.width != null ? String(c.width) : "",
          height: c.height != null ? String(c.height) : "",
          weight: c.weight != null ? String(c.weight) : "",
          note: c.note || "",
        })),
      }));

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const res = await fetch("https://deepclear.ca/api/admin/getQuoteDetails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page,
          limit,
          clientName: clientNameFilter.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (data.data) {
        const converted = convertEditableNumbersToStrings(data.data);
        setQuotesData(converted);

        // Initialize editing fields
        const initialAdminNotes = {};
        const initialPrices = {};
        converted.forEach(({ quote }) => {
          initialAdminNotes[quote.quote_id] = quote.admin_note || "";
          initialPrices[quote.quote_id] = quote.price || "";
        });
        setEditingAdminNotes(initialAdminNotes);
        setEditingPrices(initialPrices);

        // Reset edit modes
        setPriceEditMode(new Set());
        setAdminNoteEditMode(new Set());
      } else {
        setQuotesData([]);
      }

      setTotalQuotes(data.totalQuotes || 0);
    } catch (err) {
      console.error("Failed to fetch quotes:", err);
      setQuotesData([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQuotes();
  }, [page, limit]);

  // Save price
  const savePrice = async (quote_id) => {
    const priceStr = editingPrices[quote_id];
    const price = priceStr === "" ? null : Number(priceStr);

    if (price === null || isNaN(price)) {
      alert("Please enter a valid number for price.");
      return;
    }

    if (savingQuoteIds.has(quote_id)) return;

    setSavingQuoteIds((s) => new Set(s).add(quote_id));
    try {
      const res = await fetch("https://deepclear.ca/api/admin/updateClientQuote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_id, price }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(`Failed to save price: ${data.error || "Unknown error"}`);
      } else {
        alert("Price updated successfully.");
        setPriceEditMode((prev) => {
          const newSet = new Set(prev);
          newSet.delete(quote_id);
          return newSet;
        });
        fetchQuotes();
      }
    } catch (err) {
      console.error(err);
      alert("Error updating price.");
    } finally {
      setSavingQuoteIds((s) => {
        const newSet = new Set(s);
        newSet.delete(quote_id);
        return newSet;
      });
    }
  };

  const cancelEditPrice = (quote_id) => {
    const originalQuote = quotesData.find((q) => q.quote.quote_id === quote_id);
    if (originalQuote) {
      setEditingPrices((prev) => ({ ...prev, [quote_id]: originalQuote.quote.price || "" }));
    }
    setPriceEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(quote_id);
      return newSet;
    });
  };

  // Save admin note
  const saveAdminNote = async (quote_id) => {
    const admin_note = editingAdminNotes[quote_id] ?? "";

    if (savingQuoteIds.has(quote_id)) return;

    setSavingQuoteIds((s) => new Set(s).add(quote_id));
    try {
      const res = await fetch("https://deepclear.ca/api/admin/updateClientQuote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_id, admin_note }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(`Failed to save admin note: ${data.error || "Unknown error"}`);
      } else {
        alert("Admin note updated successfully.");
        setAdminNoteEditMode((prev) => {
          const newSet = new Set(prev);
          newSet.delete(quote_id);
          return newSet;
        });
        fetchQuotes();
      }
    } catch (err) {
      console.error(err);
      alert("Error updating admin note.");
    } finally {
      setSavingQuoteIds((s) => {
        const newSet = new Set(s);
        newSet.delete(quote_id);
        return newSet;
      });
    }
  };

  const cancelEditAdminNote = (quote_id) => {
    const originalQuote = quotesData.find((q) => q.quote.quote_id === quote_id);
    if (originalQuote) {
      setEditingAdminNotes((prev) => ({ ...prev, [quote_id]: originalQuote.quote.admin_note || "" }));
    }
    setAdminNoteEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(quote_id);
      return newSet;
    });
  };

  const totalPages = Math.max(1, Math.ceil(totalQuotes / limit));

  return (
      <div className="container mt-4">
        <h2 className="mb-3">Admin Quotes List</h2>

        <div className="d-flex mb-3">
          <input
              type="text"
              className="form-control me-2"
              placeholder="Filter by Client Name"
              value={clientNameFilter}
              onChange={(e) => setClientNameFilter(e.target.value)}
          />
          <button
              className="btn btn-primary"
              onClick={() => {
                setPage(1);
                fetchQuotes();
              }}
          >
            Search
          </button>
        </div>

        <div className="d-flex align-items-center mb-3">
          <label className="me-2">Items per page:</label>
          <select
              className="form-select w-auto"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
          >
            {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
            ))}
          </select>
        </div>

        {loading ? (
            <p>Loading...</p>
        ) : quotesData.length === 0 ? (
            <p>No quotes found.</p>
        ) : (
            quotesData.map(({ quote, cargoItems, totalWeight, totalVolume }) => {
              const isAdminNoteEditing = adminNoteEditMode.has(quote.quote_id);
              const isPriceEditing = priceEditMode.has(quote.quote_id);

              return (
                  <div key={quote.quote_id} className="card mb-4 shadow-sm">
                    <div className="card-header bg-primary text-white">
                      <strong>Quote ID:</strong> {quote.quote_id} |{" "}
                      <strong>Client:</strong> {quote.client_name} (ID: {quote.client_id}) |{" "}
                      <strong>Status:</strong> {getStatusLabel(quote.status)}
                    </div>

                    <div className="card-body">
                      <p>
                        <strong>Departure:</strong> {quote.departure_address || "N/A"}
                        <br />
                        <strong>Arrival:</strong> {quote.arrvial_address || "N/A"}
                        <br />
                        <strong>Client Note:</strong> {quote.client_note || "N/A"}
                      </p>

                      <p>
                        <strong>Admin Note:</strong>
                      </p>
                      {isAdminNoteEditing ? (
                          <>
                    <textarea
                        className="form-control mb-2"
                        value={editingAdminNotes[quote.quote_id] || ""}
                        onChange={(e) =>
                            setEditingAdminNotes((prev) => ({
                              ...prev,
                              [quote.quote_id]: e.target.value,
                            }))
                        }
                        rows={3}
                        placeholder="Edit admin note here"
                    />
                            <button
                                className="btn btn-success me-2"
                                onClick={() => saveAdminNote(quote.quote_id)}
                                disabled={savingQuoteIds.has(quote.quote_id)}
                            >
                              {savingQuoteIds.has(quote.quote_id) ? "Saving..." : "Save"}
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => cancelEditAdminNote(quote.quote_id)}
                                disabled={savingQuoteIds.has(quote.quote_id)}
                            >
                              Cancel
                            </button>
                          </>
                      ) : (
                          <>
                            <div className="mb-3" style={{ whiteSpace: "pre-wrap" }}>
                              {editingAdminNotes[quote.quote_id] || "N/A"}
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={() =>
                                    setAdminNoteEditMode((prev) => new Set(prev).add(quote.quote_id))
                                }
                            >
                              Edit Admin Note
                            </button>
                          </>
                      )}

                      <p className="mt-3">
                        <strong>Quote Price:</strong>{" "}
                        {isPriceEditing ? (
                            <>
                              <input
                                  type="number"
                                  className="form-control d-inline-block w-auto"
                                  value={editingPrices[quote.quote_id] ?? ""}
                                  onChange={(e) =>
                                      setEditingPrices((prev) => ({
                                        ...prev,
                                        [quote.quote_id]: e.target.value,
                                      }))
                                  }
                                  step="0.01"
                                  min="0"
                              />
                              <button
                                  className="btn btn-success ms-2"
                                  onClick={() => savePrice(quote.quote_id)}
                                  disabled={savingQuoteIds.has(quote.quote_id)}
                              >
                                {savingQuoteIds.has(quote.quote_id) ? "Saving..." : "Save"}
                              </button>
                              <button
                                  className="btn btn-secondary ms-2"
                                  onClick={() => cancelEditPrice(quote.quote_id)}
                                  disabled={savingQuoteIds.has(quote.quote_id)}
                              >
                                Cancel
                              </button>
                            </>
                        ) : (
                            <>
                              {editingPrices[quote.quote_id] ? `$${editingPrices[quote.quote_id]} CAD` : "-"}
                              <button
                                  className="btn btn-primary btn-sm ms-2"
                                  onClick={() => setPriceEditMode((prev) => new Set(prev).add(quote.quote_id))}
                              >
                                Edit Price
                              </button>
                            </>
                        )}
                      </p>

                      <h5 className="mt-4">
                        Cargo Items for <span className="text-primary">{quote.client_name}</span>
                      </h5>

                      {cargoItems.length === 0 ? (
                          <p>No cargo items.</p>
                      ) : (
                          <div className="table-responsive">
                            <table className="table table-hover quotes-table">
                              <thead className="table-light">
                              <tr>
                                <th>Cargo Type</th>
                                <th>Dimensions (L×W×H)</th>
                                <th>Weight</th>
                                <th>Cargo Note</th>
                              </tr>
                              </thead>
                              <tbody>
                              {cargoItems.map((c) => (
                                  <tr key={c.cargo_id}>
                                    <td>{getContainerTypeLabel(c.cargo_type)}</td>
                                    <td>
                                      {c.length ? `${c.length} cm` : "-"} × {c.width ? `${c.width} cm` : "-"} ×{" "}
                                      {c.height ? `${c.height} cm` : "-"}
                                    </td>
                                    <td>{c.weight ? `${c.weight} kg` : "-"}</td>
                                    <td>{c.note || "-"}</td>
                                  </tr>
                              ))}
                              </tbody>
                            </table>
                          </div>
                      )}

                      <p className="mt-3">
                        <strong>Total Number of Cargo Items:</strong> {cargoItems.length} <br />
                        <strong>Total Weight:</strong> {totalWeight ? `${totalWeight} kg` : "N/A"} <br />
                        <strong>Total Volume:</strong> {totalVolume ? `${totalVolume} cm³` : "N/A"}
                      </p>
                    </div>
                  </div>
              );
            })
        )}

        <div className="d-flex justify-content-between align-items-center mt-4">
          <button
              className="btn btn-outline-secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
          >
            Previous Page
          </button>
          <span>
          Page {page} of {totalPages}
        </span>
          <button
              className="btn btn-primary"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
          >
            Next Page
          </button>
        </div>
      </div>
  );
};

export default QuotesList;
