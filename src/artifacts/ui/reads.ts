// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

export class PageError extends Error {
  override name = "PageError";
  constructor(
    message: string,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export class Reads<T> {
  private generation = 0;
  private running: Promise<T | null> | null = null;

  run(read: () => Promise<T>, fresh = false): Promise<T | null> {
    if (this.running !== null && !fresh) return this.running;
    const generation = ++this.generation;
    const current = (): boolean => generation === this.generation;
    const running: Promise<T | null> = read().then(
      (value) => (current() ? value : null),
      (err: unknown) => {
        if (current()) throw err;
        return null;
      },
    );
    this.running = running;
    const done = (): void => {
      if (this.running === running) this.running = null;
    };
    running.then(done, done);
    return running;
  }
}
