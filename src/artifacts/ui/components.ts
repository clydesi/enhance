// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import type { BadgeMeaning } from "../types";
import { markSvg } from "./marks";
import { element, svg } from "./dom";

export const styled = (kit: string, attrs: Record<string, string>): Record<string, string> => ({ ...attrs, class: attrs.class === undefined ? kit : `${kit} ${attrs.class}` });

const touchTarget = (): HTMLSpanElement => element("span", { class: "absolute top-1/2 left-1/2 size-[max(100%,2.75rem)] -translate-x-1/2 -translate-y-1/2 pointer-fine:hidden", "aria-hidden": "true" });

const RAISED_FILL = "bg-mist-950/10 dark:bg-white/10";

const RAISED = `${RAISED_FILL} enabled:hover:bg-mist-950/15 enabled:active:bg-mist-950/15 dark:enabled:hover:bg-white/15 dark:enabled:active:bg-white/15`;

const BUTTON = [
  "relative isolate inline-flex items-baseline justify-center gap-x-2 rounded-lg border text-base/6 font-semibold",
  "px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)] sm:text-sm/6",
  "disabled:opacity-50",
  "[&>svg]:-mx-0.5 [&>svg]:my-0.5 [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:self-center [&>svg]:text-(--btn-icon) sm:[&>svg]:my-1 sm:[&>svg]:size-4 forced-colors:[--btn-icon:ButtonText] forced-colors:enabled:hover:[--btn-icon:ButtonText]",
].join(" ");

const BUTTON_KINDS = {
  solid: [
    "border-transparent bg-teal-500/80 text-ink [--btn-icon:var(--color-teal-700)] dark:bg-teal",
    "before:absolute before:inset-0 before:-z-10 before:rounded-[calc(var(--radius-lg)-1px)] before:bg-teal before:shadow-sm dark:before:hidden dark:border-white/5",
    "after:absolute after:inset-0 after:-z-10 after:rounded-[calc(var(--radius-lg)-1px)] after:shadow-[inset_0_1px_--theme(--color-white/15%)]",
    "enabled:hover:after:bg-white/25 enabled:active:after:bg-white/25 dark:after:-inset-px dark:after:rounded-lg",
    "disabled:before:shadow-none disabled:after:shadow-none",
  ],
  outline: [
    `border-mist-950/10 text-mist-950 dark:border-white/15 dark:text-white ${RAISED}`,
    "[--btn-icon:var(--color-mist-500)] enabled:hover:[--btn-icon:var(--color-mist-700)] enabled:active:[--btn-icon:var(--color-mist-700)] dark:enabled:hover:[--btn-icon:var(--color-mist-400)] dark:enabled:active:[--btn-icon:var(--color-mist-400)]",
  ],
  plain: [
    "border-transparent text-mist-950 enabled:hover:bg-mist-950/5 enabled:active:bg-mist-950/5",
    "dark:text-white dark:enabled:hover:bg-white/10 dark:enabled:active:bg-white/10",
    "[--btn-icon:var(--color-mist-500)] enabled:hover:[--btn-icon:var(--color-mist-700)] enabled:active:[--btn-icon:var(--color-mist-700)] dark:[--btn-icon:var(--color-mist-500)] dark:enabled:hover:[--btn-icon:var(--color-mist-400)] dark:enabled:active:[--btn-icon:var(--color-mist-400)]",
  ],
};

export function linkButton(attrs: Record<string, string> = {}): HTMLButtonElement {
  const look = [
    "relative inline-flex items-center gap-x-1.5 text-base/6 font-medium text-mist-950 sm:text-sm/6 dark:text-white disabled:opacity-50",
    "enabled:hover:text-teal-700 enabled:active:text-teal-700 dark:enabled:hover:text-teal dark:enabled:active:text-teal",
    "[&>svg]:size-5 [&>svg]:shrink-0 sm:[&>svg]:size-4",
  ].join(" ");
  return element("button", styled(look, { type: "button", ...attrs }), touchTarget());
}

export function busy(control: HTMLButtonElement, on: boolean): void {
  control.disabled = on;
  if (on) control.setAttribute("aria-busy", "true");
  else control.removeAttribute("aria-busy");
}

export function button(kind: keyof typeof BUTTON_KINDS, label: string | Node, attrs: Record<string, string> = {}): HTMLButtonElement {
  return element("button", styled(`${BUTTON} ${BUTTON_KINDS[kind].join(" ")}`, { type: "button", ...attrs }), touchTarget(), label);
}

const CONTROL_SPAN = [
  "relative block w-full",
  "before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm dark:before:hidden",
  "has-disabled:opacity-50 has-disabled:before:bg-mist-950/5 has-disabled:before:shadow-none",
].join(" ");

const CONTROL_FRAME = "relative w-full rounded-lg border border-mist-950/10 py-[calc(--spacing(2.5)-1px)] sm:py-[calc(--spacing(1.5)-1px)] dark:border-white/10";

const FIELD_FILL = "bg-transparent dark:bg-white/5";

const CONTROL_TEXT = "text-base/6 text-mist-950 placeholder:text-mist-500 sm:text-sm/6 dark:text-white";

const CONTROL = [
  `block appearance-none ${CONTROL_FRAME} ${CONTROL_TEXT}`,
  "enabled:hover:border-mist-950/20 dark:enabled:hover:border-white/20",
  "focus-visible:-outline-offset-2",
  "aria-invalid:border-red-500 aria-invalid:enabled:hover:border-red-500 dark:aria-invalid:border-red-600 dark:aria-invalid:enabled:hover:border-red-600",
  "disabled:border-mist-950/20 dark:disabled:border-white/15 dark:disabled:bg-white/2.5",
].join(" ");

const CONTROL_PX = "px-[calc(--spacing(3.5)-1px)] sm:px-[calc(--spacing(3)-1px)]";

const controlSpans = new WeakSet<Element>();

function inSpan(control: HTMLElement, kit: string, ...more: Node[]): void {
  controlSpans.add(element("span", { class: kit }, control, ...more));
}

export function input(attrs: Record<string, string> = {}): HTMLInputElement {
  const made = element("input", styled(`${CONTROL} ${FIELD_FILL} ${CONTROL_PX} dark:scheme-dark`, attrs));
  inSpan(made, CONTROL_SPAN);
  return made;
}

export function searchInput(attrs: Record<string, string> = {}, clearLabel = ""): HTMLInputElement {
  const made = element(
    "input",
    styled(`peer ${CONTROL} ${FIELD_FILL} ${CONTROL_PX} pr-10 pl-10 sm:pr-8 sm:pl-8 dark:scheme-dark [&::-webkit-search-cancel-button]:appearance-none`, { type: "search", ...attrs }),
  );
  const glass = icon(["M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z", "m13.5 13.5-3.25-3.25"], {
    class: "pointer-events-none absolute top-3 left-3 z-10 size-5 text-mist-500 sm:top-2.5 sm:left-2.5 sm:size-4 dark:text-mist-400",
  });
  const clear = element(
    "button",
    {
      type: "button",
      "data-clear": "",
      "aria-label": clearLabel,
      title: clearLabel,
      class:
        "absolute top-1/2 right-1.5 z-10 inline-flex -translate-y-1/2 rounded-md p-1.5 text-mist-500 peer-placeholder-shown:hidden hover:text-mist-950 sm:right-1 dark:text-mist-400 dark:hover:text-white",
    },
    touchTarget(),
    icon(["m4.5 4.5 7 7m0-7-7 7"], { class: "size-5 sm:size-4" }),
  );
  clear.addEventListener("mousedown", (event) => event.preventDefault());
  clear.addEventListener("click", () => {
    made.value = "";
    made.dispatchEvent(new Event("input", { bubbles: true }));
    made.focus();
  });
  inSpan(made, `isolate ${CONTROL_SPAN}`, glass, clear);
  return made;
}

export function listboxButton(attrs: Record<string, string> = {}): HTMLButtonElement {
  const made = element(
    "button",
    styled(`${CONTROL} ${FIELD_FILL} min-h-11 pr-[calc(--spacing(7)-1px)] pl-[calc(--spacing(3.5)-1px)] text-left sm:min-h-9 sm:pl-[calc(--spacing(3)-1px)]`, { type: "button", ...attrs }),
    element("span", { class: "block truncate" }),
    element("span", { class: "block truncate text-mist-500", hidden: "" }),
  );
  const chevron = icon(["M5.75 10.75L8 13L10.25 10.75", "M10.25 5.25L8 3L5.75 5.25"], {
    class: "size-5 stroke-mist-500 group-has-disabled:stroke-mist-600 sm:size-4 dark:stroke-mist-400 forced-colors:stroke-[CanvasText]",
  });
  inSpan(made, `group ${CONTROL_SPAN}`, element("span", { class: "pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2" }, chevron));
  return made;
}

export function textarea(attrs: Record<string, string> = {}): HTMLTextAreaElement {
  const made = element("textarea", styled(`${CONTROL} ${FIELD_FILL} ${CONTROL_PX} h-full resize-none`, attrs));
  inSpan(made, CONTROL_SPAN);
  return made;
}

export function fieldBox(attrs: Record<string, string> = {}): HTMLDivElement {
  const made = element(
    "div",
    styled(
      [
        `flex flex-wrap items-center gap-x-1.5 gap-y-1 pointer-coarse:gap-3 ${CONTROL_FRAME} ${FIELD_FILL} ${CONTROL_PX} cursor-text`,
        "hover:border-mist-950/20 dark:hover:border-white/20",
        "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-teal-700 dark:has-[input:focus-visible]:outline-teal",
      ].join(" "),
      attrs,
    ),
  );
  inSpan(made, CONTROL_SPAN);
  return made;
}

export function boxInput(attrs: Record<string, string> = {}): HTMLInputElement {
  return element("input", styled(`min-w-16 flex-1 appearance-none border-0 bg-transparent p-0 ${CONTROL_TEXT} focus-visible:outline-hidden dark:scheme-dark`, attrs));
}

export function icon(paths: string[], attrs: Record<string, string> = {}): SVGSVGElement {
  const line = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" };
  return svg("svg", { ...line, ...attrs }, ...paths.map((d) => svg("path", { d })));
}

const BADGE = "inline-flex items-center gap-x-1.5 rounded-md px-1.5 py-0.5 text-sm/5 font-medium sm:text-xs/5 forced-colors:outline";

const BADGE_COLORS: Readonly<Record<BadgeMeaning, string>> = {
  warning: "bg-amber-400/20 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400",
  information: "bg-sky-500/15 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  success: "bg-green-500/15 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  error: "bg-red-500/15 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  neutral: "bg-mist-600/10 text-mist-700 dark:bg-white/5 dark:text-mist-400",
};

export function badge(text: string | Node, attrs: Record<string, string> = {}, meaning: BadgeMeaning = "neutral"): HTMLElement {
  return element("span", styled(`${BADGE} ${BADGE_COLORS[meaning]}`, attrs), text);
}

export const countBadge = (count: string): HTMLElement => badge(count, { "data-pill": "", class: "shrink-0 tabular-nums" });

export function removableBadge(text: string, removeLabel: string, attrs: Record<string, string> = {}, removeAttrs: Record<string, string> = {}): HTMLElement {
  return element(
    "span",
    styled(`${BADGE} ${RAISED_FILL} max-w-full pr-0.5 text-mist-950 dark:text-white`, attrs),
    element("span", { class: "min-w-0 truncate" }, text),
    removeButton(removeLabel, removeAttrs),
  );
}

function removeButton(label: string, attrs: Record<string, string> = {}): HTMLButtonElement {
  return element(
    "button",
    styled("relative inline-flex shrink-0 rounded-sm p-0.5 text-mist-500 hover:text-mist-700 dark:text-mist-400 dark:hover:text-white", { type: "button", "aria-label": label, ...attrs }),
    touchTarget(),
    icon(["m4.5 4.5 7 7m0-7-7 7"], { class: "size-4" }),
  );
}

const MARK_PLACE = {
  center: "justify-center",
  flush: "ms-[calc(1.5px-5em/24)] justify-start",
  phoneFlush: "justify-center max-sm:ms-[calc(1.5px-5em/24)] max-sm:justify-start",
} as const;

export function mark(name: string | undefined, attrs: Record<string, string> = {}, place: keyof typeof MARK_PLACE = "center"): HTMLSpanElement {
  const slot = element("span", styled(`me-1 inline-flex h-[1em] w-3 shrink-0 items-center ${MARK_PLACE[place]} align-[-0.125em]`, attrs));
  const drawing = name === undefined ? undefined : markSvg(name);
  if (drawing !== undefined) slot.innerHTML = drawing;
  return slot;
}

const LABEL = "text-base/6 font-medium text-mist-950 select-none sm:text-sm/6 dark:text-white";

export function field(label: string, control: HTMLElement, attrs: Record<string, string> = {}, labelFor: string = control.id): HTMLElement {
  const name = element("label", { class: LABEL }, label);
  if (labelFor !== "") name.setAttribute("for", labelFor);
  const span = control.parentElement;
  return element("div", styled("grid min-w-0 grid-cols-1 content-start gap-3", attrs), name, span !== null && controlSpans.has(span) ? span : control);
}

export function menu(attrs: Record<string, string> = {}): HTMLElement {
  return element(
    "div",
    styled("isolate w-max overflow-y-auto overscroll-contain rounded-xl select-none outline outline-transparent focus:outline-hidden bg-white/75 backdrop-blur-xl dark:bg-mist-800/75 shadow-lg ring-1 ring-mist-950/10 dark:ring-white/10 dark:ring-inset", attrs),
  );
}

const MENU_LINE = "py-2.5 pl-3.5 text-base/6 text-mist-950 hover:bg-mist-950/10 sm:py-1.5 sm:pl-3 sm:text-sm/6 dark:text-white dark:hover:bg-white/10 forced-colors:text-[CanvasText]";

export function menuItem(text: string, attrs: Record<string, string> = {}): HTMLElement {
  return element(
    "div",
    styled(
      [
        `grid w-full grid-cols-[1fr_--spacing(5)] items-baseline gap-x-2 pr-2 sm:grid-cols-[1fr_--spacing(4)] ${MENU_LINE}`,
        "outline-hidden aria-selected:bg-teal-700/15 dark:aria-selected:bg-teal/15",
        "forced-color-adjust-none forced-colors:aria-selected:bg-[Highlight] forced-colors:aria-selected:text-[HighlightText]",
        "aria-disabled:opacity-50",
      ].join(" "),
      attrs,
    ),
    element("span", { class: "min-w-0 truncate" }, text),
  );
}

export function menuCheckbox(text: string, attrs: Record<string, string> = {}): HTMLLabelElement {
  return element(
    "label",
    { class: `flex items-center gap-3 pr-3.5 sm:pr-3 ${MENU_LINE}` },
    element("input", styled("size-4 shrink-0 accent-teal-700 dark:accent-teal", { type: "checkbox", ...attrs })),
    element("span", {}, text),
  );
}

export function menuHeading(text: string, attrs: Record<string, string> = {}): HTMLElement {
  return element("div", styled("bg-mist-950/5 px-3.5 py-2.5 text-base/6 font-medium text-mist-950 sm:px-3 sm:py-1.5 sm:text-sm/6 dark:bg-white/5 dark:text-white", attrs), text);
}

export function tab(text: string, attrs: Record<string, string>): HTMLButtonElement {
  return element(
    "button",
    styled(
      [
        "relative flex shrink-0 items-center gap-3 rounded-lg p-2 text-left text-base/6 font-medium text-mist-950 sm:text-sm/5",
        "enabled:not-aria-selected:hover:bg-mist-950/10 dark:text-white dark:enabled:not-aria-selected:hover:bg-white/10",
        "aria-selected:after:absolute aria-selected:after:inset-x-2 aria-selected:after:-bottom-2.5 aria-selected:after:h-0.5 aria-selected:after:rounded-full aria-selected:after:bg-teal-700 dark:aria-selected:after:bg-teal/70",
      ].join(" "),
      { type: "button", role: "tab", ...attrs },
    ),
    touchTarget(),
    text,
  );
}

export const HEADER_RULE = "border-b border-b-mist-950/10 dark:border-b-white/10";

export const TABLE_HEADER = `${HEADER_RULE} px-4 py-2 font-medium first:pl-(--gutter) last:pr-(--gutter)`;

export const FIELD_TABLE_HEADER = `px-4 pb-3 first:pl-(--gutter) last:pr-(--gutter) ${LABEL}`;
export const FIELD_TABLE_CELL = "px-4 first:pl-(--gutter) last:pr-(--gutter)";

export const GUTTER = "[--gutter:--spacing(3)] sm:[--gutter:--spacing(4)]";

export const TABLE_CELL = "relative border-b border-mist-950/5 px-4 py-2.5 first:pl-(--gutter) last:pr-(--gutter) dark:border-white/5";

export const TABLE_BAND = "border-b border-mist-950/5 bg-mist-950/5 px-(--gutter) py-2 font-medium text-mist-950 dark:border-white/5 dark:bg-white/5 dark:text-white";

export const TONE: Readonly<Record<"positive" | "muted", string>> = { positive: "text-green-800 dark:text-green-600", muted: "text-mist-500 dark:text-mist-400" };

export function text(content: string, attrs: Record<string, string> = {}): HTMLParagraphElement {
  return element("p", styled("text-base/6 text-mist-500 sm:text-sm/6 dark:text-mist-400", attrs), content);
}

export const SUBHEADING = "text-base/7 font-semibold text-mist-950 sm:text-sm/6 dark:text-white";

export function subheading(level: 2 | 3, content: string, attrs: Record<string, string> = {}): HTMLHeadingElement {
  return element(`h${level}`, styled(SUBHEADING, attrs), content);
}

export function listBar(heading: HTMLElement, tools: Node[], attrs: Record<string, string> = {}): HTMLDivElement {
  return element(
    "div",
    styled("flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-3", attrs),
    heading,
    element("div", { class: "grid min-w-0 basis-full grid-cols-1 gap-2 sm:w-sm sm:basis-auto sm:auto-cols-auto sm:grid-flow-col sm:grid-cols-[minmax(0,1fr)]" }, ...tools),
  );
}

export function card(attrs: Record<string, string> = {}, ...children: Node[]): HTMLDivElement {
  return element("div", styled("min-w-0 rounded-lg bg-white shadow-xs ring-1 ring-mist-950/5 dark:bg-mist-900 dark:ring-white/10", attrs), ...children);
}

export const FIGURE = "font-display text-3xl/8 font-normal text-mist-950 tabular-nums wrap-anywhere sm:text-2xl/8 dark:text-white";

export function stat(title: string, value: string, attrs: Record<string, string> = {}): HTMLDivElement {
  return card(
    styled("p-4 sm:px-6", attrs),
    element("div", { class: "text-lg/6 font-medium sm:text-sm/6" }, title),
    element("div", { "data-stat": "", class: `mt-3 ${FIGURE}` }, value),
  );
}
