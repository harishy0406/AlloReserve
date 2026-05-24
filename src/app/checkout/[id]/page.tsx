"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
}

interface Warehouse {
  id: string;
  name: string;
  location: string;
}

interface ReservationDetails {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  createdAt: string;
  product: Product | null;
  warehouse: Warehouse | null;
}

type PaymentMethod = "upi" | "card" | "netbanking";

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [reservation, setReservation] = useState<ReservationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [status, setStatus] = useState<"PENDING" | "CONFIRMED" | "RELEASED" | "EXPIRED">("PENDING");
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes default (600s)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("upi");
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "authorizing" | "success" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  const initialDurationRef = useRef<number>(600);

  // Fetch reservation details
  useEffect(() => {
    if (!id) return;

    const fetchReservation = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/reservations/${id}`);
        if (!res.ok) {
          throw new Error(res.status === 404 ? "Reservation not found" : "Failed to load checkout details");
        }
        const data: ReservationDetails = await res.json();
        setReservation(data);
        setStatus(data.status);

        if (data.status === "PENDING") {
          const expiryTime = new Date(data.expiresAt).getTime();
          const now = Date.now();
          const secondsLeft = Math.max(0, Math.floor((expiryTime - now) / 1000));
          
          if (secondsLeft === 0) {
            setStatus("EXPIRED");
            setTimeLeft(0);
          } else {
            setTimeLeft(secondsLeft);
            const totalDuration = Math.max(0, Math.floor((expiryTime - new Date(data.createdAt).getTime()) / 1000));
            initialDurationRef.current = totalDuration > 0 ? totalDuration : 600;
          }
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchReservation();
  }, [id]);

  // Countdown timer logic
  useEffect(() => {
    if (status !== "PENDING" || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setStatus("EXPIRED");
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status, timeLeft]);

  // Handle payment confirmation (Success Simulation)
  const handleConfirmPayment = async () => {
    if (actionLoading || status !== "PENDING") return;
    
    try {
      setActionLoading(true);
      setPaymentStatus("authorizing");
      
      // Simulate authorization time
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const res = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Payment verification failed");
      }

      setPaymentStatus("success");
      setStatus("CONFIRMED");
    } catch (err: any) {
      setPaymentStatus("failed");
      setError(err.message || "Failed to confirm payment");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle release early (Decline / Cancel Simulation)
  const handleDeclinePayment = async () => {
    if (actionLoading || status !== "PENDING") return;

    try {
      setActionLoading(true);
      const res = await fetch(`/api/reservations/${id}/release`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to decline transaction");
      }

      setStatus("RELEASED");
      setPaymentStatus("failed");
    } catch (err: any) {
      setError(err.message || "Failed to cancel transaction");
    } finally {
      setActionLoading(false);
    }
  };

  // Artificially trigger timeout immediately
  const handleForceTimeout = async () => {
    if (actionLoading || status !== "PENDING") return;
    
    try {
      setActionLoading(true);
      // Simulate expiring instantly in backend by releasing it early (or we can let natural expiry happen)
      // For simulator perfection, we release it on backend to return stock, and visually show EXPIRED status.
      const res = await fetch(`/api/reservations/${id}/release`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to expire reservation");
      }

      setTimeLeft(0);
      setStatus("EXPIRED");
    } catch (err: any) {
      setError(err.message || "Failed to expire reservation");
    } finally {
      setActionLoading(false);
    }
  };

  // Format time (mm:ss)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner-large"></div>
        <p className="loading-text">Securing your checkout slot...</p>
        <style>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 60vh;
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
            font-size: 0.95rem;
          }
        `}</style>
      </div>
    );
  }

  if (error && !reservation) {
    return (
      <div className="error-container glass-card">
        <span className="error-icon">✕</span>
        <h2 className="error-title">Transaction Expired or Not Found</h2>
        <p className="error-desc">{error}</p>
        <button onClick={() => router.push("/")} className="btn btn-primary">
          Return to Catalog
        </button>
        <style>{`
          .error-container {
            max-width: 500px;
            margin: 40px auto;
            padding: 32px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
          }
          .error-icon {
            font-size: 2rem;
            color: var(--color-danger);
            background: var(--color-danger-glow);
            width: 60px;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            border: 1px solid rgba(239, 68, 68, 0.2);
          }
          .error-title {
            font-family: var(--font-display);
            font-size: 1.5rem;
            font-weight: 700;
          }
          .error-desc {
            color: var(--color-text-secondary);
            line-height: 1.5;
          }
        `}</style>
      </div>
    );
  }

  // Calculate circular progress for countdown ring
  const strokeDasharray = 2 * Math.PI * 45; // r=45 -> 282.7
  const progressRatio = timeLeft / (initialDurationRef.current || 600);
  const strokeDashoffset = strokeDasharray * (1 - progressRatio);

  // Set timer color class based on time remaining
  let timerColorClass = "timer--green";
  if (timeLeft < 180) timerColorClass = "timer--yellow"; // < 3 mins
  if (timeLeft < 60) timerColorClass = "timer--red";   // < 1 min

  return (
    <div className="checkout-grid">
      {/* Visual banners for different states */}
      {status === "EXPIRED" && (
        <div className="status-banner status-banner--error global-banner">
          <span>⚠️</span>
          <div>
            <strong>Reservation Expired:</strong> The 10-minute hold has timed out. The physical unit was released back to inventory.
          </div>
        </div>
      )}
      {status === "RELEASED" && (
        <div className="status-banner status-banner--warning global-banner">
          <span>✕</span>
          <div>
            <strong>Reservation Cancelled:</strong> You have declined/released this checkout slot. Stock has been instantly restored.
          </div>
        </div>
      )}
      {status === "CONFIRMED" && (
        <div className="status-banner status-banner--success global-banner">
          <span>✓</span>
          <div>
            <strong>Order Secured!</strong> Payment authorised and physical inventory permanently decremented.
          </div>
        </div>
      )}

      {error && status === "PENDING" && (
        <div className="status-banner status-banner--error global-banner">
          <span>✕</span>
          <div>{error}</div>
        </div>
      )}

      <div className="checkout-main">
        {/* Ticket Summary Section */}
        <div className="glass-card ticket-card">
          <div className="ticket-header">
            <span className="ticket-dot left"></span>
            <span className="ticket-dot right"></span>
            <div className="ticket-label">INVENTORY SECURED SLOT</div>
            <h2 className="ticket-title">{reservation?.product?.name}</h2>
            <p className="ticket-desc">{reservation?.product?.description}</p>
          </div>
          
          <div className="ticket-divider">
            <span className="divider-line"></span>
          </div>

          <div className="ticket-body">
            <div className="ticket-detail">
              <span className="detail-label">Warehouse Source</span>
              <span className="detail-value">{reservation?.warehouse?.name} ({reservation?.warehouse?.location})</span>
            </div>
            <div className="ticket-detail">
              <span className="detail-label">Quantity Secured</span>
              <span className="detail-value">{reservation?.quantity} Unit(s)</span>
            </div>
            <div className="ticket-detail">
              <span className="detail-label">Price per Unit</span>
              <span className="detail-value">₹{reservation?.product?.price.toLocaleString("en-IN")}</span>
            </div>
            
            <div className="ticket-total">
              <span className="total-label">Total Amount</span>
              <span className="total-value">₹{((reservation?.product?.price || 0) * (reservation?.quantity || 1)).toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Payment Simulator */}
        <div className="glass-card terminal-card">
          <h3 className="terminal-title">🖥️ Interactive Payment Terminal</h3>
          <p className="terminal-desc">Simulate live bank APIs to test race-condition handling.</p>

          {status === "PENDING" && paymentStatus === "idle" && (
            <div className="terminal-active">
              <div className="payment-selector">
                <button
                  onClick={() => setPaymentMethod("upi")}
                  className={`selector-btn ${paymentMethod === "upi" ? "active" : ""}`}
                >
                  ⚡ UPI (Instant)
                </button>
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`selector-btn ${paymentMethod === "card" ? "active" : ""}`}
                >
                  💳 Credit Card
                </button>
                <button
                  onClick={() => setPaymentMethod("netbanking")}
                  className={`selector-btn ${paymentMethod === "netbanking" ? "active" : ""}`}
                >
                  🏛️ Bank Redirect
                </button>
              </div>

              <div className="payment-body">
                {paymentMethod === "upi" && (
                  <div className="upi-body">
                    <p className="body-label">UPI ID / PhonePe / GPay</p>
                    <input
                      type="text"
                      placeholder="merchant@ybl"
                      disabled={true}
                      value="customer@okaxis"
                      className="terminal-input"
                    />
                    <span className="input-hint">Mock input for UPI sandbox mode.</span>
                  </div>
                )}

                {paymentMethod === "card" && (
                  <div className="card-body">
                    <div className="card-input-row">
                      <div>
                        <p className="body-label">Card Number</p>
                        <input
                          type="text"
                          disabled={true}
                          value="•••• •••• •••• 4242"
                          className="terminal-input"
                        />
                      </div>
                    </div>
                    <div className="card-input-grid">
                      <div>
                        <p className="body-label">Expiry</p>
                        <input type="text" disabled={true} value="12/29" className="terminal-input" />
                      </div>
                      <div>
                        <p className="body-label">CVV</p>
                        <input type="text" disabled={true} value="***" className="terminal-input" />
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === "netbanking" && (
                  <div className="bank-body">
                    <p className="body-label">Select Core Bank</p>
                    <select disabled={true} className="terminal-input">
                      <option>State Bank of India</option>
                      <option>HDFC Bank</option>
                      <option>ICICI Bank</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="terminal-actions">
                <button
                  onClick={handleConfirmPayment}
                  disabled={actionLoading}
                  className="btn btn-success flex-1"
                >
                  {actionLoading ? <span className="spinner"></span> : "✓ Authorize Payment (Succeed)"}
                </button>
                <button
                  onClick={handleDeclinePayment}
                  disabled={actionLoading}
                  className="btn btn-danger"
                >
                  Decline (Release Stock)
                </button>
              </div>

              <div className="terminal-footer-links">
                <button onClick={handleForceTimeout} className="btn-force-timeout">
                  ⏱ Trigger Manual Expiry (Timeout Simulator)
                </button>
              </div>
            </div>
          )}

          {paymentStatus === "authorizing" && (
            <div className="terminal-loading">
              <div className="spinner-large"></div>
              <h4 className="loading-stage">Verifying Concurrency Availability...</h4>
              <p className="loading-desc">Executing SELECT FOR UPDATE locks to prevent double-selling...</p>
            </div>
          )}

          {status === "CONFIRMED" && (
            <div className="terminal-success animate-fade-in">
              <div className="success-badge">✓</div>
              <h4 className="success-headline">Payment Captured Successfully</h4>
              <p className="success-text">Prisma Transaction completed. Stock permanently decremented.</p>
              <button onClick={() => router.push("/")} className="btn btn-ghost mt-4">
                Back to Catalog
              </button>
            </div>
          )}

          {(status === "EXPIRED" || status === "RELEASED" || paymentStatus === "failed") && status !== "CONFIRMED" && (
            <div className="terminal-failure animate-fade-in">
              <div className="failure-badge">✕</div>
              <h4 className="failure-headline">Transaction Terminated</h4>
              <p className="failure-text">
                {status === "EXPIRED"
                  ? "The database transaction was rolled back automatically due to expiration."
                  : "The reserved items were released successfully and returned to warehouses."}
              </p>
              <button onClick={() => router.push("/")} className="btn btn-primary mt-4">
                Return to Store
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Countdown Timer Sidebar */}
      <div className="checkout-sidebar">
        <div className="glass-card timer-card-sidebar">
          <h3 className="timer-title-sidebar">Stock Hold Status</h3>
          <p className="timer-desc-sidebar">This item is held exclusively for you.</p>

          <div className="timer-display-container">
            {status === "PENDING" ? (
              <div className="timer-svg-container">
                <svg className="countdown-ring" width="120" height="120">
                  <circle
                    className="ring-bg"
                    cx="60"
                    cy="60"
                    r="45"
                    stroke="rgba(255,255,255,0.03)"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    className={`ring-progress ${timerColorClass}`}
                    cx="60"
                    cy="60"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="timer-digits">
                  <span className="time-number">{formatTime(timeLeft)}</span>
                  <span className="time-label">REMAINING</span>
                </div>
              </div>
            ) : (
              <div className="timer-finished-display">
                <span className={`finished-icon finished-icon--${status.toLowerCase()}`}>
                  {status === "CONFIRMED" ? "✓" : "✕"}
                </span>
                <span className="finished-label">STATUS</span>
                <span className="finished-value">{status}</span>
              </div>
            )}
          </div>

          <div className="timer-audit-info">
            <div className="audit-row">
              <span className="audit-label">Reservation ID</span>
              <span className="audit-code">{id.substring(0, 8)}...</span>
            </div>
            <div className="audit-row">
              <span className="audit-label">Mechanism</span>
              <span className="audit-badge">SELECT FOR UPDATE</span>
            </div>
            <div className="audit-row">
              <span className="audit-label">Isolation Level</span>
              <span className="audit-badge">READ COMMITTED</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .checkout-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
          position: relative;
          z-index: 10;
          animation: fade-in 0.5s ease-out;
        }
        @media (min-width: 1024px) {
          .checkout-grid {
            grid-template-columns: 1.8fr 1fr;
          }
        }
        .global-banner {
          grid-column: 1 / -1;
          margin-bottom: 8px;
        }
        .checkout-main {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .ticket-card {
          position: relative;
          background: rgba(18, 18, 26, 0.4);
          border-color: rgba(255, 255, 255, 0.05);
          overflow: hidden;
        }
        .ticket-header {
          padding: 32px 32px 20px;
        }
        .ticket-dot {
          position: absolute;
          width: 20px;
          height: 20px;
          background: var(--color-bg-primary);
          border-radius: 50%;
          bottom: 110px;
          z-index: 2;
        }
        .ticket-dot.left {
          left: -10px;
          box-shadow: inset -6px 0 6px rgba(0,0,0,0.4);
          border-right: 1px solid rgba(255, 255, 255, 0.06);
        }
        .ticket-dot.right {
          right: -10px;
          box-shadow: inset 6px 0 6px rgba(0,0,0,0.4);
          border-left: 1px solid rgba(255, 255, 255, 0.06);
        }
        .ticket-label {
          font-family: var(--font-display);
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--color-accent);
          margin-bottom: 8px;
        }
        .ticket-title {
          font-family: var(--font-display);
          font-size: 1.75rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--color-text-primary);
        }
        .ticket-desc {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin-top: 4px;
          line-height: 1.4;
        }
        .ticket-divider {
          padding: 0 32px;
          height: 1px;
          position: relative;
        }
        .divider-line {
          display: block;
          border-top: 2px dashed rgba(255, 255, 255, 0.08);
          width: 100%;
        }
        .ticket-body {
          padding: 24px 32px 32px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .ticket-detail {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
        }
        .detail-label {
          color: var(--color-text-secondary);
        }
        .detail-value {
          color: var(--color-text-primary);
          font-weight: 500;
        }
        .ticket-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 12px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        .total-label {
          font-weight: 600;
          color: var(--color-text-primary);
        }
        .total-value {
          font-family: var(--font-display);
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--color-success);
        }
        .terminal-card {
          padding: 32px;
          background: rgba(10, 10, 15, 0.6);
        }
        .terminal-title {
          font-family: var(--font-display);
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        .terminal-desc {
          font-size: 0.85rem;
          color: var(--color-text-secondary);
          margin-top: 4px;
        }
        .payment-selector {
          display: flex;
          gap: 8px;
          margin-top: 24px;
          background: rgba(255, 255, 255, 0.02);
          padding: 4px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.04);
        }
        .selector-btn {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          padding: 10px;
          font-size: 0.8rem;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .selector-btn.active {
          background: var(--color-bg-glass);
          color: var(--color-text-primary);
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .payment-body {
          margin-top: 20px;
          min-height: 100px;
        }
        .body-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }
        .terminal-input {
          width: 100%;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 12px;
          color: var(--color-text-primary);
          font-size: 0.9rem;
          outline: none;
          font-family: inherit;
        }
        .input-hint {
          display: block;
          font-size: 0.75rem;
          color: var(--color-text-muted);
          margin-top: 4px;
        }
        .card-input-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 12px;
        }
        .terminal-actions {
          display: flex;
          gap: 12px;
          margin-top: 28px;
        }
        .terminal-footer-links {
          margin-top: 20px;
          text-align: center;
          border-top: 1px solid rgba(255,255,255,0.04);
          padding-top: 16px;
        }
        .btn-force-timeout {
          background: transparent;
          border: none;
          color: var(--color-warning);
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: opacity var(--transition-fast);
        }
        .btn-force-timeout:hover {
          opacity: 0.8;
          text-decoration: underline;
        }
        .terminal-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 0;
          gap: 16px;
        }
        .spinner-large {
          width: 36px;
          height: 36px;
          border: 2px solid rgba(99, 102, 241, 0.1);
          border-top-color: var(--color-accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .loading-stage {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }
        .loading-desc {
          font-size: 0.8rem;
          color: var(--color-text-secondary);
        }
        .terminal-success, .terminal-failure {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 24px 0;
        }
        .success-badge {
          width: 56px;
          height: 56px;
          background: var(--color-success-glow);
          color: var(--color-success);
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          margin-bottom: 16px;
          filter: drop-shadow(0 0 10px rgba(16, 185, 129, 0.15));
        }
        .failure-badge {
          width: 56px;
          height: 56px;
          background: var(--color-danger-glow);
          color: var(--color-danger);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          margin-bottom: 16px;
          filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.15));
        }
        .success-headline {
          font-family: var(--font-display);
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        .failure-headline {
          font-family: var(--font-display);
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        .success-text, .failure-text {
          font-size: 0.85rem;
          color: var(--color-text-secondary);
          margin-top: 6px;
          max-width: 320px;
          line-height: 1.4;
        }
        .timer-card-sidebar {
          padding: 32px;
          background: rgba(18, 18, 26, 0.3);
          border-color: rgba(255,255,255,0.04);
          text-align: center;
        }
        .timer-title-sidebar {
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 700;
        }
        .timer-desc-sidebar {
          font-size: 0.8rem;
          color: var(--color-text-secondary);
          margin-top: 4px;
        }
        .timer-display-container {
          margin: 32px 0;
          display: flex;
          justify-content: center;
        }
        .timer-svg-container {
          position: relative;
          width: 120px;
          height: 120px;
        }
        .ring-progress.timer--green {
          color: var(--color-success);
        }
        .ring-progress.timer--yellow {
          color: var(--color-warning);
        }
        .ring-progress.timer--red {
          color: var(--color-danger);
          animation: pulse-danger-ring 1s ease-in-out infinite;
        }
        .timer-digits {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .time-number {
          font-family: var(--font-display);
          font-size: 1.35rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--color-text-primary);
        }
        .time-label {
          font-size: 0.55rem;
          font-weight: 700;
          color: var(--color-text-muted);
          letter-spacing: 0.05em;
          margin-top: 2px;
        }
        .timer-finished-display {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .finished-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .finished-icon--confirmed {
          background: var(--color-success-glow);
          color: var(--color-success);
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .finished-icon--released {
          background: var(--color-warning-glow);
          color: var(--color-warning);
          border: 1px solid rgba(245, 158, 11, 0.2);
        }
        .finished-icon--expired {
          background: var(--color-danger-glow);
          color: var(--color-danger);
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .finished-label {
          font-size: 0.6rem;
          font-weight: 700;
          color: var(--color-text-muted);
          letter-spacing: 0.05em;
        }
        .finished-value {
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 800;
          letter-spacing: -0.01em;
          margin-top: 2px;
        }
        .timer-finished-display .finished-value {
          color: var(--color-text-primary);
        }
        .timer-finished-display .finished-value {
          text-shadow: 0 0 10px rgba(255,255,255,0.05);
        }
        .timer-audit-info {
          border-top: 1px solid rgba(255,255,255,0.04);
          padding-top: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .audit-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
        }
        .audit-label {
          color: var(--color-text-secondary);
        }
        .audit-code {
          font-family: monospace;
          color: var(--color-text-muted);
        }
        .audit-badge {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          padding: 2px 8px;
          border-radius: 4px;
          color: var(--color-text-secondary);
          font-size: 0.65rem;
          font-weight: 600;
        }
        .flex-1 {
          flex: 1;
        }
        .mt-4 {
          margin-top: 16px;
        }
        @keyframes pulse-danger-ring {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
