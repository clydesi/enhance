// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { ConfirmNeeded, SavedUnread, saveTransaction } from "../answers";
import type { EditMenus, PendingRow, TransactionRow } from "../types";
import { endAsk, showAsked, startAsk } from "./asked";
import { combobox } from "./combobox";
import { boxInput, busy, button, field, fieldBox, input, menu, removableBadge, text, textarea } from "./components";
import { element, failureText, word } from "./dom";
import { askButton, badgesOf, factsOf, splitsOf } from "./facts";
import { listbox } from "./listbox";
import { PageError } from "./reads";
import { type FormValues, saveOf } from "./save";
import { categoryRows, payeeNamed, payeeRows } from "./typeahead";

const MAX_NAME = 200;
const MAX_TAG = 30;
const MAX_TAGS = 20;

export interface RowHandlers {
  saved(row: TransactionRow): void;
  reload(): Promise<void>;
  close(): void;
}

let lists: EditMenus = { categories: [], scopes: [], payees: [] };
let kept: { id: string; version: number; body: HTMLElement; changed: () => boolean } | null = null;
let next: { id: string; text: string } | null = null;

export function useMenus(menus: EditMenus): void {
  lists = menus;
}

export const keeps = (row: TransactionRow): boolean => kept !== null && kept.id === row.id && kept.version === row.version && kept.body.isConnected;

export const unsaved = (): boolean => kept !== null && kept.body.isConnected && kept.changed();

const ROOT_WORDS = { personal: "rootPersonal", business: "rootBusiness", transfers: "rootTransfers" } as const;

const askText = (row: TransactionRow | PendingRow): string => ("id" in row ? row.id : `#${row.key}`);

function ask(line: string, asking: HTMLElement, status: HTMLElement): void {
  if (!startAsk(asking)) return;
  say(status, "");
  (navigator.clipboard?.writeText(line) ?? Promise.reject(new Error("no clipboard"))).then(
    () => showAsked(asking, word("askCopied")),
    () => {
      endAsk(asking);
      say(status, word("askCopyFailed", { line }));
    },
  );
}

function say(status: HTMLElement, line: string, tone: "error" | "warning" = "error"): void {
  status.textContent = line;
  status.toggleAttribute("data-warning", tone === "warning");
}

const formField = (label: string, control: HTMLElement, labelFor?: string): HTMLElement => field(label, control, { "data-field": "" }, labelFor);

function nameInput(id: string, value: string, attrs: Record<string, string> = {}): HTMLInputElement {
  const made = input({ id, autocomplete: "off", maxlength: String(MAX_NAME), ...attrs });
  made.value = value;
  return made;
}

function onLeave(control: HTMLElement, commit: () => void): void {
  control.addEventListener("blur", () =>
    setTimeout(() => {
      if (document.activeElement !== control) commit();
    }),
  );
}

function only<T>(items: readonly T[], name: (item: T) => string, text: string): T | null {
  const found = items.filter((item) => name(item).toLowerCase() === text.toLowerCase());
  return found.length === 1 ? found[0]! : null;
}

const isConflict = (err: unknown, id: string): boolean => err instanceof PageError && err.code === "conflict" && typeof err.details === "object" && err.details !== null && id in err.details;

function splitCategory(): HTMLElement {
  const line = text("", { "data-readonly": "", class: "sm:py-1.5 sm:text-center" });
  line.append(element("span", { "aria-hidden": "true" }, "-- "), word("splitCategory"), element("span", { "aria-hidden": "true" }, " --"));
  return line;
}

const splitField = (): HTMLElement => field(word("columnCategory"), splitCategory(), { "data-field": "", class: "max-sm:flex max-sm:items-baseline max-sm:gap-3" });

function form(row: TransactionRow, status: HTMLElement): { fields: HTMLElement; values: () => FormValues | null; changed: () => boolean } {
  const edit = row.edit!;
  const nodeOf = (id: string | null) => lists.categories.find((node) => node.id === id) ?? null;
  const fields = element("div", { "data-form": "", class: "grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2" });

  const payee = nameInput("detail-payee", edit.payee);
  const payeeMenu = menu({ id: "detail-payee-menu" });
  combobox(
    payee,
    payeeMenu,
    (query) => payeeRows(lists.payees, query, payee.value).map(({ name, isNew }) => ({ text: isNew ? word("newPayee", { name }) : name, value: name })),
    ({ value }) => {
      payee.value = value;
    },
    () => payeeNamed(lists.payees, payee.value),
  );
  const commitPayee = (): void => {
    const match = only(lists.payees, (name) => name, payee.value.trim());
    if (match !== null) payee.value = match;
  };
  onLeave(payee, commitPayee);
  fields.append(formField(word("columnPayee"), payee));

  const start = nodeOf(edit.category_id);
  let picked = { id: edit.category_id, name: start?.name ?? (edit.category_id === null ? "" : (row.cells.category?.text ?? "")), root: start?.root ?? null };
  const scope = listbox({ id: "detail-for" }, { placeholder: word("forPlaceholder") });
  scope.options = lists.scopes.map((s) => ({ value: s.id, label: s.name }));
  const forField = field(word("fieldFor"), scope.button, { "data-field": "", class: "sm:col-start-2" });
  const showFor = (): void => {
    forField.hidden = !(picked.root === "business" && edit.scope_id === null && lists.scopes.length > 1);
  };
  let commitCategory = (): void => {};
  let categoryText = (): string => picked.name;
  if (edit.split) {
    fields.append(splitField());
  } else {
    const category = nameInput("detail-category", picked.name, { placeholder: word("categoryPlaceholder") });
    combobox(
      category,
      menu({ id: "detail-category-menu" }),
      (query) => categoryRows(lists.categories, query).map((line) => (line.kind === "root" ? { band: word(ROOT_WORDS[line.name]) } : { text: line.name, value: line.id, depth: line.depth })),
      ({ value, text: name }) => {
        picked = { id: value, name, root: nodeOf(value)?.root ?? null };
        category.value = name;
        showFor();
      },
      () => picked.id,
    );
    commitCategory = () => {
      const typed = category.value.trim();
      const match = typed === "" || typed.toLowerCase() === picked.name.toLowerCase() ? null : only(lists.categories, (node) => node.name, typed);
      if (typed === "") picked = { id: null, name: "", root: null };
      else if (match !== null) picked = { id: match.id, name: match.name, root: match.root };
      category.value = picked.name;
      showFor();
    };
    onLeave(category, commitCategory);
    categoryText = () => category.value;
    fields.append(formField(word("columnCategory"), category));
  }
  showFor();
  fields.append(forField);

  const tags = [...edit.tags];
  const tagInput = boxInput({ id: "detail-tags", autocomplete: "off", maxlength: String(MAX_TAG), placeholder: word("tagPlaceholder") });
  const box = fieldBox({ "data-tagbox": "" });
  const drawTags = (): void => box.replaceChildren(...tags.map((tag) => removableBadge(tag, word("removeTag", { tag }), { "data-tag": "" }, { "data-remove": tag })), tagInput);
  const addTag = (): boolean => {
    const tag = tagInput.value.trim();
    if (tag === "") return true;
    const refused = tags.some((t) => t.toLowerCase() === tag.toLowerCase()) ? word("tagDuplicate") : tags.length >= MAX_TAGS ? word("tagLimit", { max: MAX_TAGS }) : null;
    say(status, refused ?? "");
    if (refused !== null) return false;
    tags.push(tag);
    tagInput.value = "";
    drawTags();
    return true;
  };
  tagInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTag();
      tagInput.focus();
    } else if (event.key === "Backspace" && tagInput.value === "" && tags.length > 0) {
      tags.pop();
      drawTags();
      tagInput.focus();
    }
  });
  box.addEventListener("click", (event) => {
    const remove = (event.target as Element).closest<HTMLElement>("[data-remove]");
    if (remove !== null) {
      tags.splice(tags.indexOf(remove.dataset.remove!), 1);
      drawTags();
    }
    tagInput.focus();
  });
  drawTags();
  fields.append(formField(word("columnTags"), box, tagInput.id));

  const note = textarea({ id: "detail-note", rows: "1", maxlength: String(MAX_NAME), placeholder: word("notePlaceholder"), class: "overflow-y-hidden" });
  note.value = edit.notes;
  const grow = (): void => {
    if (note.scrollHeight === 0) return;
    note.style.height = "auto";
    note.style.height = `${note.scrollHeight + note.offsetHeight - note.clientHeight}px`;
  };
  note.addEventListener("input", grow);
  let width = 0;
  new ResizeObserver(([entry]) => {
    if (entry === undefined || entry.contentRect.width === width) return;
    width = entry.contentRect.width;
    requestAnimationFrame(grow);
  }).observe(note);
  note.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) event.preventDefault();
  });
  fields.append(formField(word("fieldNote"), note));

  const values = (): FormValues | null => {
    commitPayee();
    commitCategory();
    if (!addTag()) return null;
    return held();
  };
  const held = (): FormValues => ({ payee: payee.value, category_id: picked.id, scope: forField.hidden || scope.value === "" ? null : scope.value, tags, notes: note.value });
  const changed = (): boolean => {
    const sent = saveOf(row.id, row.version, edit, held());
    return "refused" in sent || Object.keys(sent).some((key) => key !== "id" && key !== "version") || tagInput.value.trim() !== "" || categoryText().trim() !== picked.name;
  };
  return { fields, values, changed };
}

export function detailsOf(row: TransactionRow, on: RowHandlers): HTMLElement {
  const posted = row;
  if (kept?.id === posted.id && kept.version === posted.version && kept.body.isConnected) return kept.body;
  const body = element("div", { "data-detail-body": "", class: "mx-auto flex max-w-3xl min-w-0 flex-col gap-4.5 text-base/6 sm:gap-4 sm:text-sm/6" });
  const status = element("p", {
    role: "status",
    "data-status": "",
    class: "-mb-1.5 text-right text-base/6 text-red-600 empty:hidden data-warning:text-amber-700 sm:-mb-2 sm:text-sm/6 dark:text-red-500 dark:data-warning:text-amber-400",
  });
  const bar = element("div", { "data-actions": "", class: "my-1.5 flex flex-wrap items-center justify-end gap-2 sm:my-2" });
  const { line, button: asking } = askButton(word("askAbout"));
  asking.addEventListener("click", () => ask(askText(row), asking, status));
  bar.append(line);
  const rest = (): Node[] => [status, bar, ...splitsOf(row.detail), ...factsOf(row.detail)];
  const { fields, values, changed } = form(posted, status);
  const cancel = button("outline", word("cancel"), { "data-cancel": "" });
  const save = button("solid", word("save"), { "data-save": "" });
  let confirm: { token: string; sent: string } | undefined;
  cancel.addEventListener("click", () => on.close());
  save.addEventListener("click", () => {
    const held = values();
    if (held === null) return;
    const sent = saveOf(posted.id, posted.version, posted.edit!, held);
    if ("refused" in sent) {
      say(status, word(sent.refused));
      return;
    }
    const token = confirm !== undefined && confirm.sent === JSON.stringify(sent) ? confirm.token : undefined;
    busy(save, true);
    say(status, "");
    saveTransaction(sent, lists.scopes, token).then(
      (fresh) => {
        kept = null;
        on.saved(fresh);
      },
      (err: unknown) => {
        if (err instanceof ConfirmNeeded) {
          confirm = { token: err.token, sent: JSON.stringify(sent) };
          busy(save, false);
          const side = (names: string[]): string => (names.length === 0 ? word("rootPersonal") : names.join(", "));
          say(status, word("scopeConfirm", { from: side(err.from), to: side(err.to) }), "warning");
          save.focus();
          return;
        }
        confirm = undefined;
        if (err instanceof SavedUnread) {
          kept = null;
          on.close();
          return;
        }
        if (!isConflict(err, posted.id)) {
          busy(save, false);
          say(status, failureText(err));
          save.focus();
          return;
        }
        kept = null;
        next = { id: posted.id, text: word("conflict") };
        on.reload().catch((failed: unknown) => {
          next = null;
          busy(save, false);
          say(status, failureText(failed));
        });
      },
    );
  });
  bar.append(cancel, save);
  body.append(...badgesOf(row.detail), fields, ...rest());
  if (next?.id === posted.id) {
    say(status, next.text);
    setTimeout(() => save.isConnected && save.focus({ preventScroll: true }));
  }
  next = null;
  kept = { id: posted.id, version: posted.version, body, changed };
  return body;
}
