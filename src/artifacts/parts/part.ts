// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

export interface Part {
  load(): Promise<void>;
  link(): Record<string, unknown>;
  follow(pairs: Record<string, string>): void;
}
