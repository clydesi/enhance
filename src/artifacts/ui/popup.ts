// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

const MENU_MAX = 240;
const MIN_BELOW = 160;
const MENU_WIDTH = 240;

interface Popup {
  open(): void;
  close(): void;
  readonly isOpen: boolean;
}

export function popup(anchor: HTMLElement, menu: HTMLElement, closed: () => void): Popup {
  anchor.setAttribute("aria-expanded", "false");
  menu.classList.add("fixed", "z-10");
  menu.setAttribute("data-drawn", "");

  const onScroll = (event: Event): void => {
    if (!(event.target instanceof Node) || !event.target.contains(anchor)) return;
    const box = anchor.getBoundingClientRect();
    if (event.target === document && box.bottom > 0 && box.top < window.innerHeight) place();
    else close();
  };
  const labels = (): Element[] => [...((anchor as HTMLInputElement | HTMLButtonElement).labels ?? [])];
  const onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Node) || ![anchor, menu, ...labels()].some((inside) => inside.contains(target))) close();
  };
  const gone = new MutationObserver(() => {
    if (!anchor.isConnected) close();
  });

  function place(): void {
    const box = anchor.getBoundingClientRect();
    const width = Math.min(Math.max(box.width, MENU_WIDTH), window.innerWidth - 16);
    const left = Math.max(8, Math.min(box.left, window.innerWidth - 8 - width));
    const below = window.innerHeight - box.bottom - 12;
    const above = box.top - 12;
    const up = below < MIN_BELOW && above > below;
    const edge = up ? `bottom:${window.innerHeight - box.top + 4}px` : `top:${box.bottom + 4}px`;
    menu.style.cssText = `left:${left}px;width:${width}px;max-height:${Math.max(0, Math.min(MENU_MAX, up ? above : below))}px;${edge}`;
  }
  function close(): void {
    menu.remove();
    anchor.setAttribute("aria-expanded", "false");
    anchor.removeAttribute("aria-activedescendant");
    anchor.removeAttribute("aria-controls");
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", place);
    document.removeEventListener("click", onClick, true);
    gone.disconnect();
    closed();
  }
  function open(): void {
    place();
    if (!menu.isConnected) {
      document.body.append(menu);
      anchor.setAttribute("aria-controls", menu.id);
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", place);
      document.addEventListener("click", onClick, true);
      gone.observe(document.body, { childList: true, subtree: true });
    }
    anchor.setAttribute("aria-expanded", "true");
  }
  return {
    open,
    close,
    get isOpen() {
      return menu.isConnected;
    },
  };
}

export function scrollToLine(menu: HTMLElement, line: HTMLElement): void {
  if (line.offsetTop < menu.scrollTop) menu.scrollTop = line.offsetTop;
  else if (line.offsetTop + line.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = line.offsetTop + line.offsetHeight - menu.clientHeight;
}
