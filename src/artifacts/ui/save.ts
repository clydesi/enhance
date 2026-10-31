// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import type { RowEdit, TransactionSave } from "../types";

export interface FormValues {
  payee: string;
  category_id: string | null;
  scope: string | null;
  tags: string[];
  notes: string;
}

interface Refused {
  refused: "payeeEmpty";
}

const oneLine = (text: string): string => text.replace(/[\r\n]/g, "").trim();
const noteText = (text: string): string => text.replace(/\s+/g, " ").trim();

export function saveOf(id: string, version: number, edit: RowEdit, values: FormValues): TransactionSave | Refused {
  const save: TransactionSave = { id, version };
  const payee = oneLine(values.payee);
  if (payee !== oneLine(edit.payee)) {
    if (payee === "") return { refused: "payeeEmpty" };
    save.payee = payee;
  }
  if (!edit.split) {
    if (values.category_id !== edit.category_id) save.category_id = values.category_id;
    if (values.scope !== null) Object.assign(save, { category_id: values.category_id, scope: values.scope });
  }
  if (values.tags.join("\n") !== edit.tags.join("\n")) save.tags = values.tags;
  const notes = noteText(values.notes);
  if (notes !== noteText(edit.notes)) save.notes = notes === "" ? null : notes;
  return save;
}
