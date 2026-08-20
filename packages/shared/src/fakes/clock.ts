import type { ClockPort } from '../ports/clock.port.js';

export class FixedClock implements ClockPort {
  constructor(private readonly instant: Date) {}

  now(): Date {
    return this.instant;
  }
}

export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}
