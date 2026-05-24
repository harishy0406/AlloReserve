"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

interface Inventory {
  id: string;
  warehouseId: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  warehouseName: string;
  warehouseLocation: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  inventories: Inventory[];
}

export default function CatalogPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [reservingId, setReservingId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<{ message: string; type: "error" | "warning" } | null>(null);

  // User selection states keyed by product ID
  const [selections, setSelections] = useState<Record<string, { warehouseId: string; quantity: number }>>({});

  // Generate or load idempotency key from memory
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  useEffect(() => {
    setIdempotencyKey(uuidv4());
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      setProducts(data);

      // Initialize default selections for each product
      const initialSelections: Record<string, { warehouseId: string; quantity: number }> = {};
      data.forEach((p: Product) => {
        // Default to the first warehouse that has stock, or just the first warehouse
        const activeInv = p.inventories.find(inv => inv.totalStock - inv.reservedStock > 0) || p.inventories[0];
        initialSelections[p.id] = {
          warehouseId: activeInv?.warehouseId || "",
          quantity: 1,
        };
      });
      setSelections(initialSelections);
    } catch (err: any) {
      console.error(err);
      setErrorBanner({ message: "Could not sync catalog with real-time stock levels.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Handle warehouse changes
  const handleWarehouseChange = (productId: string, warehouseId: string) => {
    setSelections((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        warehouseId,
        quantity: 1, // reset quantity to 1 when changing warehouse
      },
    }));
  };

  // Handle quantity changes
  const handleQuantityChange = (productId: string, quantity: number) => {
    setSelections((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        quantity,
      },
    }));
  };

  // Trigger reservation
  const handleReserve = async (productId: string) => {
    const selection = selections[productId];
    if (!selection || !selection.warehouseId) {
      setErrorBanner({ message: "Please select a valid warehouse hub.", type: "warning" });
      return;
    }

    try {
      setReservingId(productId);
      setErrorBanner(null);

      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": idempotencyKey, // Send our idempotency key!
        },
        body: JSON.stringify({
          productId,
          warehouseId: selection.warehouseId,
          quantity: selection.quantity,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        // Check for concurrency out of stock error (409 Conflict)
        if (res.status === 409) {
          throw new Error(`OVERSOLD PREVENTION: ${errData.details || "The selected warehouse has run out of available units under high demand."}`);
        }
        throw new Error(errData.error || "Failed to secure stock hold");
      }

      const reservation = await res.json();
      
      // Successfully reserved! Redirect to checkout page.
      router.push(`/checkout/${reservation.id}`);
    } catch (err: any) {
      console.error(err);
      setErrorBanner({ message: err.message || "A race condition was detected. Your checkout slot could not be secured.", type: "error" });
      
      // Refresh products to show the updated stock count!
      loadProducts();
      
      // Regenerate the idempotency key for the next try
      setIdempotencyKey(uuidv4());
    } finally {
      setReservingId(null);
    }
  };

  if (loading && products.length === 0) {
    return (
      <div className="loading-container">
        <div className="spinner-large"></div>
        <p className="loading-text">Loading catalog & executing lazy ex-reservations cleanup...</p>
        <style>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 50vh;
            gap: 16px;
          }
          .spinner-large {
            width: 48px;
            height: 48px;
            border: 3px solid rgba(99, 102, 241, 0.1);
            border-top-color: var(--color-accent);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          .loading-text {
            color: var(--color-text-secondary);
            font-size: 0.9rem;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="catalog-wrapper">
      <div className="catalog-header animate-fade-in">
        <h1 className="catalog-title">⚡ Real-Time Inventory Control</h1>
        <p className="catalog-subtitle">
          Test lock strategies under simulated high-demand checkout environments. Click checkout to place temporary holds.
        </p>
      </div>

      {errorBanner && (
        <div className={`status-banner status-banner--${errorBanner.type} global-banner animate-slide-in`}>
          <span>{errorBanner.type === "error" ? "⚠️" : "ℹ️"}</span>
          <div>{errorBanner.message}</div>
          <button onClick={() => setErrorBanner(null)} className="btn-close-banner">✕</button>
        </div>
      )}

      <div className="product-grid">
        {products.map((product) => {
          const selection = selections[product.id] || { warehouseId: "", quantity: 1 };
          const selectedInv = product.inventories.find(inv => inv.warehouseId === selection.warehouseId);
          
          const availableStock = selectedInv 
            ? Math.max(0, selectedInv.totalStock - selectedInv.reservedStock) 
            : 0;

          // Determine stock badge class and text
          let badgeText = "OUT OF STOCK";
          let badgeClass = "stock-badge--out";
          
          if (selectedInv) {
            if (availableStock >= 5) {
              badgeText = `${availableStock} IN STOCK`;
              badgeClass = "stock-badge--available";
            } else if (availableStock > 1) {
              badgeText = `ONLY ${availableStock} LEFT`;
              badgeClass = "stock-badge--low";
            } else if (availableStock === 1) {
              badgeText = "LAST UNIT LEFT";
              badgeClass = "stock-badge--critical";
            }
          }

          return (
            <div key={product.id} className="glass-card product-card">
              <div className="product-image-container">
                <img src={product.imageUrl} alt={product.name} className="product-image" />
                <div className="product-badge-overlay">
                  <span className={`stock-badge ${badgeClass}`}>{badgeText}</span>
                </div>
              </div>

              <div className="product-content">
                <h3 className="product-name">{product.name}</h3>
                <p className="product-description">{product.description}</p>

                <div className="product-pricing">
                  <span className="price-tag">₹{Number(product.price).toLocaleString("en-IN")}</span>
                </div>

                <div className="product-selectors">
                  <div className="selector-group">
                    <label className="selector-label">Warehouse Source</label>
                    <select
                      value={selection.warehouseId}
                      onChange={(e) => handleWarehouseChange(product.id, e.target.value)}
                      className="selector-select"
                    >
                      {product.inventories.map((inv) => {
                        const invAvailable = Math.max(0, inv.totalStock - inv.reservedStock);
                        return (
                          <option key={inv.warehouseId} value={inv.warehouseId}>
                            {inv.warehouseName} ({invAvailable} avail)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="selector-group">
                    <label className="selector-label">Secured Quantity</label>
                    <select
                      value={selection.quantity}
                      onChange={(e) => handleQuantityChange(product.id, Number(e.target.value))}
                      disabled={availableStock <= 0}
                      className="selector-select select-qty"
                    >
                      {Array.from({ length: Math.min(5, availableStock) }, (_, i) => i + 1).map((qty) => (
                        <option key={qty} value={qty}>
                          {qty}
                        </option>
                      ))}
                      {availableStock <= 0 && <option value="0">0</option>}
                    </select>
                  </div>
                </div>

                <div className="product-actions">
                  <button
                    onClick={() => handleReserve(product.id)}
                    disabled={availableStock <= 0 || reservingId !== null}
                    className="btn btn-primary w-full"
                  >
                    {reservingId === product.id ? (
                      <>
                        <span className="spinner"></span>
                        <span>Securing Slot...</span>
                      </>
                    ) : (
                      <>
                        <span>⚡ Reserve Checkout Slot</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .catalog-wrapper {
          position: relative;
          z-index: 10;
        }
        .catalog-header {
          text-align: center;
          margin-bottom: 40px;
        }
        .catalog-title {
          font-family: var(--font-display);
          font-size: 2.25rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          background: linear-gradient(135deg, var(--color-text-primary) 30%, var(--color-accent) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .catalog-subtitle {
          font-size: 0.95rem;
          color: var(--color-text-secondary);
          margin-top: 8px;
          max-width: 600px;
          margin-left: auto;
          margin-right: auto;
          line-height: 1.5;
        }
        .global-banner {
          margin-bottom: 24px;
          position: relative;
          padding-right: 48px;
        }
        .btn-close-banner {
          position: absolute;
          right: 16px;
          background: transparent;
          border: none;
          color: currentColor;
          font-size: 1rem;
          cursor: pointer;
          opacity: 0.6;
          transition: opacity var(--transition-fast);
        }
        .btn-close-banner:hover {
          opacity: 1;
        }
        .product-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 32px;
        }
        @media (min-width: 640px) {
          .product-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (min-width: 1024px) {
          .product-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        .product-card {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: rgba(18, 18, 26, 0.4);
          border-color: rgba(255, 255, 255, 0.05);
        }
        .product-image-container {
          position: relative;
          aspect-ratio: 16/10;
          background: rgba(0, 0, 0, 0.2);
          overflow: hidden;
        }
        .product-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform var(--transition-slow);
        }
        .product-card:hover .product-image {
          transform: scale(1.05);
        }
        .product-badge-overlay {
          position: absolute;
          top: 16px;
          left: 16px;
        }
        .product-content {
          padding: 24px;
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .product-name {
          font-family: var(--font-display);
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        .product-description {
          font-size: 0.85rem;
          color: var(--color-text-secondary);
          margin-top: 8px;
          line-height: 1.4;
          flex: 1;
        }
        .product-pricing {
          margin-top: 16px;
          display: flex;
          align-items: center;
        }
        .price-tag {
          font-family: var(--font-display);
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--color-text-primary);
        }
        .product-selectors {
          margin-top: 20px;
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 12px;
        }
        .selector-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .selector-label {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .selector-select {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 8px 12px;
          color: var(--color-text-primary);
          font-size: 0.8rem;
          outline: none;
          cursor: pointer;
          font-family: inherit;
        }
        .product-actions {
          margin-top: 20px;
        }
        .w-full {
          width: 100%;
        }
      `}</style>
    </div>
  );
}
