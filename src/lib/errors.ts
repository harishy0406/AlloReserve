/**
 * Custom error classes for domain-specific error handling
 */

export class InsufficientStockError extends Error {
  constructor(
    public readonly available: number,
    public readonly requested: number
  ) {
    super(
      `Insufficient stock: requested ${requested} but only ${available} available`
    );
    this.name = "InsufficientStockError";
  }
}

export class ReservationExpiredError extends Error {
  constructor(public readonly reservationId: string) {
    super(`Reservation ${reservationId} has expired`);
    this.name = "ReservationExpiredError";
  }
}

export class ReservationNotFoundError extends Error {
  constructor(public readonly reservationId: string) {
    super(`Reservation ${reservationId} not found`);
    this.name = "ReservationNotFoundError";
  }
}

export class InvalidReservationStateError extends Error {
  constructor(
    public readonly reservationId: string,
    public readonly currentStatus: string,
    public readonly expectedStatus: string
  ) {
    super(
      `Reservation ${reservationId} is in "${currentStatus}" state, expected "${expectedStatus}"`
    );
    this.name = "InvalidReservationStateError";
  }
}
