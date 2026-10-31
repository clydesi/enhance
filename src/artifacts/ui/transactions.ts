// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { editMenus, menusCurrent, noteStamp, transactionRow, transactionsPage } from "../answers";
import { loadPrefs, savePrefs } from "../prefs";
import { type Cell, type ColumnPrefs, type FilterState, type PendingRow, TRANSACTION_SORTS, type TransactionRow, type TransactionsArgs, type TransactionsPage, type TransactionsSort } from "../types";
import { applyPrefs } from "./columns";
import { busy, button, card, GUTTER, icon, listBar, mark, menu, menuCheckbox, menuHeading, removableBadge, searchInput, subheading, TABLE_BAND, TABLE_CELL, TABLE_HEADER, text, TONE } from "./components";
import { detailsOf, keeps, type RowHandlers, useMenus } from "./details";
import { element, failureText, showNotice, word } from "./dom";
import { Reads } from "./reads";
import { merge, monthRuns, sortedBy } from "./rows";

const SEARCH_MS = 300;
const PAGE_SIZE = 20;
const PULSE_MS = 4000;

const COLUMNS = TRANSACTION_SORTS;
type ColumnKey = TransactionsSort;

const HIDDEN_BY: Partial<Record<ColumnKey, string>> = { tags: "in-[.no-tags]:hidden", notes: "in-[.no-notes]:hidden" };

const HEADER = `group ${TABLE_HEADER}`;

const CELL = [
  TABLE_CELL,
  "group-has-[[aria-expanded=true]]/row:border-b-transparent dark:group-has-[[aria-expanded=true]]/row:border-b-transparent",
  "max-sm:min-w-0 max-sm:border-0 max-sm:p-0 max-sm:first:pl-0 max-sm:last:pr-0",
].join(" ");

const CELL_KEY: Record<ColumnKey, string> = {
  date: "tabular-nums max-sm:col-start-2 max-sm:row-start-2 max-sm:text-right max-sm:text-mist-500 dark:max-sm:text-mist-400",
  account: "max-sm:hidden",
  payee: "max-sm:col-start-1 max-sm:row-start-1",
  category: "max-sm:col-start-1 max-sm:row-start-2 max-sm:text-mist-500 dark:max-sm:text-mist-400",
  tags: "max-sm:hidden",
  notes: "max-sm:hidden",
  amount: "text-right tabular-nums max-sm:col-start-2 max-sm:row-start-1",
};

const TRUNCATE: Partial<Record<ColumnKey, string>> = { account: "max-w-36", payee: "max-w-40", category: "max-w-40", tags: "max-w-24", notes: "max-w-32" };

const ROW = [
  "group/row not-data-pending:cursor-pointer not-data-pending:hover:bg-mist-950/2.5 dark:not-data-pending:hover:bg-white/2.5",
  "has-[[aria-expanded=true]]:bg-mist-950/2.5 dark:has-[[aria-expanded=true]]:bg-white/2.5",
  "has-[button:focus-visible]:outline-2 has-[button:focus-visible]:-outline-offset-2 has-[button:focus-visible]:outline-teal-700 dark:has-[button:focus-visible]:outline-teal",
  "data-pending:text-mist-500 dark:data-pending:text-mist-400",
  "data-saved:animate-saved motion-reduce:data-saved:animate-none motion-reduce:data-saved:bg-saved",
  "in-data-collapsed:hidden",
  "max-sm:not-in-data-collapsed:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3 max-sm:gap-y-0.5 max-sm:border-b max-sm:border-mist-950/5 max-sm:px-(--gutter) max-sm:py-2.5",
  "dark:max-sm:border-white/5 max-sm:has-[[aria-expanded=true]]:border-b-transparent dark:max-sm:has-[[aria-expanded=true]]:border-b-transparent",
].join(" ");

type ListRows = Pick<TransactionsPage, "rows" | "pending" | "grouped" | "pendingLast">;

let table: HTMLTableElement | undefined;
let rowHandlers: RowHandlers;
let onShow: ListRows = { rows: [], pending: [], grouped: false, pendingLast: false };
let openId: string | null = null;
let prefs: ColumnPrefs = loadPrefs();
let pulse: { id: string; at: number } | null = null;
const collapsed = new Set<string>(prefs.pendingCollapsed ? ["pending"] : []);

const detailsId = (id: string): string => `details-${id}`;

function detailRow(row: TransactionRow): HTMLTableRowElement {
  const unread = row.edit === null || (!menusCurrent() && !keeps(row));
  const alone = (words: string): HTMLParagraphElement => text(words, { class: "py-6 text-center" });
  const holder = element("div", { class: "sticky left-(--gutter) w-[calc(100cqw-2*var(--gutter))]" }, unread ? alone(word("loading")) : detailsOf(row, rowHandlers));
  const tr = element(
    "tr",
    { "data-detail": "", id: detailsId(row.id), class: "bg-mist-950/2.5 in-data-collapsed:hidden max-sm:not-in-data-collapsed:block dark:bg-white/2.5" },
    element("td", { colspan: String(COLUMNS.length), class: "border-b border-mist-950/5 px-(--gutter) py-3 whitespace-normal max-sm:block dark:border-white/5" }, holder),
  );
  if (unread)
    Promise.all([row.edit === null ? transactionRow(row.id) : null, editMenus()]).then(
      ([full, menus]) => {
        if (full !== null) Object.assign(row, { version: full.version, cells: full.cells, detail: full.detail, edit: full.edit });
        useMenus(menus);
        if (tr.isConnected) holder.replaceChildren(detailsOf(row, rowHandlers));
      },
      (err: unknown) => holder.replaceChildren(alone(failureText(err))),
    );
  return tr;
}

function cellOf(key: ColumnKey, cell: Cell | undefined, row: TransactionRow | PendingRow, open: boolean): HTMLTableCellElement {
  const id = "id" in row ? row.id : row.key;
  const words = cell?.text ?? "";
  const tone = cell?.tone === undefined ? "" : ` ${TONE[cell.tone]}`;
  const max = TRUNCATE[key];
  const truncated = max === undefined ? "" : ` truncate ${max} max-sm:max-w-none`;
  const td = element("td", { "data-key": key, class: `${CELL} ${CELL_KEY[key]} ${HIDDEN_BY[key] ?? ""}${tone}${truncated}` });
  if (max !== undefined && words !== "") td.title = words;
  if (key === "payee" && "id" in row) td.append(element("button", { type: "button", "aria-expanded": String(open), "aria-controls": detailsId(id), class: "block w-full truncate text-left select-text focus:outline-hidden" }, words));
  else if (key === "category") td.append(mark(cell?.mark, { class: "max-sm:empty:hidden" }, "phoneFlush"), words);
  else td.textContent = words;
  return td;
}

function rowOf(row: TransactionRow | PendingRow): HTMLTableRowElement[] {
  const id = "id" in row ? row.id : row.key;
  const open = openId === id;
  const tr = element("tr", { "data-row": "", "data-id": id, class: ROW }, ...COLUMNS.map((key) => cellOf(key, row.cells[key], row, open)));
  if (!("id" in row)) tr.dataset.pending = "";
  if (pulse?.id === id) {
    tr.dataset.saved = "";
    tr.style.animationDelay = `${pulse.at - Date.now()}ms`;
  }
  return open && "id" in row ? [tr, detailRow(row)] : [tr];
}

function body(key: string, label: string | null, rows: (TransactionRow | PendingRow)[]): HTMLTableSectionElement {
  const tbody = element("tbody", { class: "max-sm:block" }, ...rows.flatMap(rowOf));
  if (label === null) return tbody;
  const open = !collapsed.has(key);
  const toggle = element(
    "button",
    { type: "button", "data-toggle": "group", "aria-expanded": String(open), class: "group/band sticky left-(--gutter) flex w-[calc(100cqw-2*var(--gutter))] items-center gap-x-2 text-left" },
    icon(["M6 3.5 10.5 8 6 12.5"], { class: "size-4 shrink-0 text-mist-500 group-aria-expanded/band:rotate-90 motion-safe:transition-transform dark:text-mist-400" }),
    label,
  );
  tbody.prepend(element("tr", { "data-band": "", class: "max-sm:block" }, element("td", { colspan: String(COLUMNS.length), class: `${TABLE_BAND} max-sm:block` }, toggle)));
  tbody.dataset.group = key;
  tbody.toggleAttribute("data-collapsed", !open);
  return tbody;
}

function postedBodies(rows: ListRows): HTMLTableSectionElement[] {
  if (!rows.grouped) return rows.rows.length === 0 ? [] : [body("posted", null, rows.rows)];
  return monthRuns(rows.rows).map((run) => body(run[0]!.month, run[0]!.month, run));
}

function headerRow(): HTMLTableRowElement {
  return element(
    "tr",
    {},
    ...COLUMNS.map((key) => {
      const place = key === "amount" ? "flex-row-reverse" : key === "category" ? "ps-4" : "";
      const label = `flex w-full items-center gap-1 ${place} font-medium`;
      const words = element("span", {}, word(`column${key[0]!.toUpperCase()}${key.slice(1)}`));
      const th = element("th", { "data-key": key, "aria-sort": "none", class: `${HEADER} ${key === "amount" ? "text-right" : ""} ${HIDDEN_BY[key] ?? ""}` });
      const arrow = icon(["M8 13V3M3.5 7.5 8 3l4.5 4.5"], { class: "size-[1.15em] shrink-0 group-aria-[sort=descending]:rotate-180 group-aria-[sort=none]:hidden" });
      th.append(element("button", { type: "button", class: `${label} hover:text-mist-950 dark:hover:text-white` }, words, arrow));
      return th;
    }),
  );
}

function startPulse(id: string): void {
  pulse = { id, at: Date.now() };
  setTimeout(() => {
    if (pulse?.id !== id) return;
    pulse = null;
    table?.querySelector("[data-row][data-saved]")?.removeAttribute("data-saved");
  }, PULSE_MS);
}

function listCard(on: RowHandlers): HTMLElement {
  table = element("table", { "data-table": "", class: "min-w-full text-left text-sm/6 text-mist-950 max-sm:block dark:text-white" }, element("thead", { class: `max-sm:hidden ${TONE.muted}` }, headerRow()));
  const scroller = card({ "data-scroller": "", class: `@container overflow-x-auto scroll-px-(--gutter) whitespace-nowrap aria-busy:[&_tbody]:opacity-50 ${GUTTER}` }, table);
  rowHandlers = {
    ...on,
    saved(row) {
      startPulse(row.id);
      on.saved(row);
      scroller.dispatchEvent(new Event("saved", { bubbles: true }));
    },
  };

  scroller.addEventListener("click", (event) => {
    const target = event.target as Element;
    const band = target.closest<HTMLElement>('[data-toggle="group"]');
    if (band !== null) {
      const tbody = band.closest("tbody")!;
      const open = collapsed.delete(tbody.dataset.group!);
      if (!open) collapsed.add(tbody.dataset.group!);
      tbody.toggleAttribute("data-collapsed", !open);
      if (tbody.dataset.group === "pending") {
        prefs = { ...prefs, pendingCollapsed: !open };
        savePrefs(prefs);
      }
      band.setAttribute("aria-expanded", String(open));
      return;
    }
    const row = target.closest<HTMLElement>("[data-row]");
    const selection = getSelection();
    if (row === null || row.dataset.pending !== undefined || (event.detail === 1 && selection !== null && !selection.isCollapsed && selection.containsNode(row, true))) return;
    toggle(row);
  });

  scroller.addEventListener("focusin", (event) => {
    const focused = event.target as HTMLElement;
    if (!focused.matches(":focus-visible")) return;
    const room = parseFloat(getComputedStyle(scroller).scrollPaddingLeft);
    const [box, at] = [scroller.getBoundingClientRect(), focused.getBoundingClientRect()];
    if (at.left < box.left + room) scroller.scrollLeft -= box.left + room - at.left;
    else if (at.right > box.right - room) scroller.scrollLeft += at.right - (box.right - room);
  });
  return scroller;
}

function drawRows(rows: ListRows): void {
  onShow = rows;
  const focused = document.activeElement;
  const inList = focused instanceof HTMLElement && table!.contains(focused) ? focused : null;
  const rowId = inList?.closest<HTMLElement>("[data-row]")?.dataset.id;
  const band = inList?.matches('[data-toggle="group"]') ? inList.closest<HTMLElement>("tbody")?.dataset.group : undefined;
  const pending = rows.pending.length === 0 ? [] : [body("pending", word("pendingHead", { count: rows.pending.length }), rows.pending)];
  const posted = postedBodies(rows);
  for (const old of table!.querySelectorAll("tbody")) old.remove();
  table!.append(...(rows.pendingLast ? [...posted, ...pending] : [...pending, ...posted]));
  if (inList !== null && document.activeElement !== inList) {
    const again = inList.isConnected
      ? inList
      : rowId !== undefined
        ? table!.querySelector<HTMLElement>(`[data-row][data-id="${CSS.escape(rowId)}"] [aria-expanded]`)
        : band !== undefined
          ? table!.querySelector<HTMLElement>(`tbody[data-group="${CSS.escape(band)}"] [data-toggle="group"]`)
          : null;
    again?.focus({ preventScroll: true });
  }
  applyPrefs(table!, prefs);
}

function closeOpened(): void {
  openId = null;
  if (table === undefined) return;
  table.querySelector("[data-detail]")?.remove();
  table.querySelector('[data-row] [aria-expanded="true"]')?.setAttribute("aria-expanded", "false");
}

function toggle(row: HTMLElement): void {
  const id = openId === row.dataset.id ? null : row.dataset.id!;
  closeOpened();
  openId = id;
  const opened = onShow.rows.find((data) => data.id === openId);
  if (opened !== undefined) {
    row.querySelector("[aria-expanded]")!.setAttribute("aria-expanded", "true");
    row.after(detailRow(opened));
  }
}

function showPrefs(): void {
  if (table !== undefined) applyPrefs(table, prefs);
  if (panel !== undefined) for (const box of panel.querySelectorAll<HTMLInputElement>("[data-column]")) box.checked = prefs.columns[box.dataset.column as "tags" | "notes"];
}

let panel: HTMLElement | undefined;
let state: FilterState;
let shown: TransactionsPage;
let shownFilter: TransactionsArgs = {};
let offsets = [0];
type ReadFor = { filter: TransactionsArgs; offsets: number[]; fresh: boolean };
const readFor = new WeakMap<TransactionsPage, ReadFor>();
const reads = new Reads<TransactionsPage>();
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let chipLabel: Element;

const part = <T extends HTMLElement = HTMLElement>(selector: string): T => panel!.querySelector<T>(selector)!;
const read = (filter: TransactionsArgs, offset: number): Promise<TransactionsPage> => transactionsPage({ ...filter, ...(offset === 0 ? {} : { offset }) }, PAGE_SIZE);
const keep = (): void => void panel!.dispatchEvent(new Event("state", { bubbles: true }));

export function readTransactions(filter: TransactionsArgs, fresh = false, anew = false): Promise<TransactionsPage | null> {
  const at = fresh ? [0] : offsets;
  return reads.run(() => Promise.all(at.map((offset) => read(filter, offset))).then((pages) => noted(merge(pages), { filter, offsets: at, fresh })), fresh || anew);
}

function noted(page: TransactionsPage, read: ReadFor): TransactionsPage {
  readFor.set(page, read);
  return page;
}

const scrolledPast = (scroller: HTMLElement): number => Math.max(0, -scroller.getBoundingClientRect().top);

function scrollPast(scroller: HTMLElement, past: number, fresh: boolean): void {
  const by = fresh ? Math.min(0, part("[data-bar]").getBoundingClientRect().top) : past - scrolledPast(scroller);
  if (by !== 0) window.scrollBy(0, by);
}

function choose(next: ColumnPrefs): void {
  prefs = next;
  showPrefs();
  savePrefs(prefs);
}

let listFailed = false;

function failed(err: unknown): void {
  listFailed = true;
  part("[data-scroller]").removeAttribute("aria-busy");
  part("[data-chip]").hidden = shown.chip === null;
  const search = part<HTMLInputElement>("[data-search]");
  if (document.activeElement !== search) search.value = shownFilter.search ?? "";
  busy(part<HTMLButtonElement>("[data-more]"), false);
  showNotice(failureText(err));
}

function settled(page: TransactionsPage | null): void {
  if (page === null) return;
  listFailed = false;
  showNotice(null);
  drawTransactions(panel!, page, state);
}

function refetch(filter: TransactionsArgs): Promise<void> {
  state.filter = filter;
  keep();
  part("[data-scroller]").setAttribute("aria-busy", "true");
  busy(part<HTMLButtonElement>("[data-more]"), true);
  return readTransactions(filter, true).then(settled, (err: unknown) => {
    state.filter = shownFilter;
    keep();
    failed(err);
  });
}

export function showFiltered(filter: TransactionsArgs, from: HTMLElement | null = null): boolean {
  if (panel === undefined) return false;
  const { sort, direction } = state.filter;
  const next: TransactionsArgs = { ...(sort === undefined ? {} : { sort }), ...(direction === undefined ? {} : { direction }), ...filter };
  clearTimeout(searchTimer);
  part<HTMLInputElement>("[data-search]").value = next.search ?? "";
  if (JSON.stringify(next) !== JSON.stringify(state.filter)) closeOpened();
  void refetch(next).then(() => {
    if (from !== null && document.activeElement === from && !part("[data-chip]").hidden) part<HTMLElement>("[data-chip] button").focus();
  });
  return true;
}

function more(): void {
  const button = part<HTMLButtonElement>("[data-more]");
  const [base, filter, offset] = [shown, shownFilter, shown.next];
  if (offset === null || button.disabled) return;
  busy(button, true);
  const at = [...offsets, offset];
  reads.run(() => read(filter, offset).then((page) => noted(merge([base, page]), { filter, offsets: at, fresh: false })), true).then(settled, failed);
}

function columnsMenu(): HTMLElement {
  const sliders = icon(["M2.5 5h5m3 0h3m-11 6h2m3 0h6", "M10.5 5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z", "M7.5 11a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"]);
  const opener = button("outline", sliders, { "aria-expanded": "false", "aria-controls": "columns-menu", "aria-label": word("columns"), title: word("columns") });
  const list = menu({ id: "columns-menu", "data-menu": "", hidden: "", class: "absolute top-full right-0 z-10 mt-1 min-w-44" });
  list.append(menuHeading(word("showColumns")), menuCheckbox(word("columnTags"), { "data-column": "tags" }), menuCheckbox(word("columnNotes"), { "data-column": "notes" }));
  return element("div", { "data-columns": "", class: "relative max-sm:hidden" }, opener, list);
}

function wire(): void {
  const search = searchInput({ maxlength: "200", "data-search": "", "aria-label": word("search"), placeholder: word("searchPlaceholder") }, word("clearSearch"));
  const chip = removableBadge("", word("removeFilter"));
  chipLabel = chip.firstElementChild!;
  const legend = (kind: string, key: string): HTMLElement => element("span", { class: "inline-flex items-center" }, mark(kind, { "data-legend-mark": kind }), element("span", {}, word(key)));
  panel!.append(
    element(
      "div",
      { "data-transactions": "", hidden: "" },
      listBar(subheading(2, ""), [search.parentElement!, columnsMenu()], { "data-bar": "" }),
      element(
        "p",
        { "data-legend": "", class: `mb-3 flex flex-wrap gap-x-4 gap-y-1 text-base/6 sm:text-sm/6 ${TONE.muted}` },
        legend("business", "legendBusiness"),
        legend("split", "legendSplit"),
        legend("split_business", "legendSplitBusiness"),
      ),
      element("p", { "data-chip": "", hidden: "", class: "mb-3 flex" }, chip),
      listCard(listHandlers),
      text(word("noTransactions"), { "data-empty": "", hidden: "", class: "px-2 pt-3" }),
      element("div", { class: "flex justify-center" }, button("outline", word("showMore"), { "data-more": "", hidden: "", class: "mt-3" })),
    ),
  );
  const columns = part("[data-columns]");
  const menuButton = part<HTMLButtonElement>("[data-columns] > button");
  const showMenu = (open: boolean): void => {
    part("[data-menu]").hidden = !open;
    menuButton.setAttribute("aria-expanded", String(open));
  };

  panel!.addEventListener("click", (event) => {
    const target = event.target as Element;
    const sort = target.closest<HTMLElement>("th button");
    if (sort !== null) return void refetch(sortedBy(state.filter, sort.parentElement!.dataset.key as TransactionsSort));
    if (target.closest("[data-columns] > button") !== null) return showMenu(menuButton.getAttribute("aria-expanded") !== "true");
    if (target.closest("[data-chip] button") !== null) {
      const { account: _a, category: _c, exact: _e, owner: _o, month: _m, spending: _s, ...rest } = state.filter;
      document.getElementById("tab-transactions")?.focus();
      part("[data-chip]").hidden = true;
      return void refetch(rest);
    }
    if (target.closest("[data-more]") !== null) return more();
  });

  columns.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    showMenu(false);
    menuButton.focus();
  });
  columns.addEventListener("focusout", (event) => {
    if (!columns.contains(event.relatedTarget as Node | null)) showMenu(false);
  });
  document.addEventListener("click", (event) => {
    if (!columns.contains(event.target as Node)) showMenu(false);
  });

  panel!.addEventListener("input", (event) => {
    const box = event.target as HTMLInputElement;
    if (box.matches("[data-column]")) return choose({ ...prefs, columns: { ...prefs.columns, [box.dataset.column!]: box.checked } });
    if (!box.matches("[data-search]")) return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const text = box.value.trim();
      const { search, ...rest } = state.filter;
      if (text !== (search ?? "")) void refetch(text === "" ? rest : { ...rest, search: text });
      else if (listFailed) {
        listFailed = false;
        showNotice(null);
      }
    }, SEARCH_MS);
  });
}

const listHandlers: RowHandlers = {
  saved(row) {
    closeOpened();
    const rows = onShow.rows.map((old) => (old.id === row.id ? { ...row, month: old.month } : old));
    drawRows({ ...onShow, rows });
    focusRow(row.id, true);
  },
  reload: () => readTransactions(state.filter, false, true).then(settled),
  close() {
    const id = openId;
    closeOpened();
    if (id !== null) focusRow(id);
  },
};

const focusRow = (id: string, still = false): void => table?.querySelector<HTMLElement>(`[data-row][data-id="${CSS.escape(id)}"] [aria-expanded]`)?.focus({ preventScroll: still });

export function drawTransactions(root: HTMLElement, page: TransactionsPage, pageState: FilterState): void {
  const first = panel === undefined;
  panel = root;
  state = pageState;
  shown = page;
  noteStamp("transactions", page.stamp);
  const source = readFor.get(page);
  readFor.delete(page);
  if (source !== undefined) {
    shownFilter = source.filter;
    offsets = source.offsets;
  }
  const known = new Map(onShow.rows.filter((row) => row.edit !== null).map((row) => [row.id, row]));
  for (const row of page.rows) {
    const old = known.get(row.id);
    if (old !== undefined && old.version === row.version) Object.assign(row, { detail: old.detail, edit: old.edit });
  }
  if (first) wire();
  part("[data-transactions]").hidden = false;
  part("h2").textContent = page.heading;
  const chip = part("[data-chip]");
  chip.hidden = page.chip === null;
  chipLabel.textContent = page.chip ?? "";
  const search = part<HTMLInputElement>("[data-search]");
  if (document.activeElement !== search) search.value = shownFilter.search ?? "";

  const { sort = "date", direction = "desc" } = shownFilter;
  for (const th of table!.tHead!.querySelectorAll<HTMLElement>("th[aria-sort]")) th.setAttribute("aria-sort", th.dataset.key === sort ? (direction === "asc" ? "ascending" : "descending") : "none");
  const scroller = part("[data-scroller]");
  scroller.removeAttribute("aria-busy");
  const fresh = source?.fresh === true;
  const top = fresh ? 0 : scrolledPast(scroller);
  drawRows(page);
  scrollPast(scroller, top, fresh);
  showPrefs();

  part("[data-empty]").hidden = page.rows.length + page.pending.length > 0;
  const moreButton = part<HTMLButtonElement>("[data-more]");
  moreButton.hidden = page.next === null;
  busy(moreButton, false);
}
