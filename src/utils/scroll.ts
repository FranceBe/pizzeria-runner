const MARGIN = 8;

// Scrolls a list (and its scrolling parent) just enough to show an element inside it. Only these containers move,
// never the page: during service the page itself is fixed, and scrolling it would leave everything stuck.
export function revealInList(list: HTMLElement, element: HTMLElement): void {
  for (const scroller of [list, list.parentElement]) {
    if (!scroller) continue;
    const box = scroller.getBoundingClientRect();
    const target = element.getBoundingClientRect();
    if (scroller.scrollWidth > scroller.clientWidth) {
      if (target.left < box.left) scroller.scrollLeft -= box.left - target.left + MARGIN;
      else if (target.right > box.right) scroller.scrollLeft += target.right - box.right + MARGIN;
    }
    if (scroller.scrollHeight > scroller.clientHeight) {
      if (target.top < box.top) scroller.scrollTop -= box.top - target.top + MARGIN;
      else if (target.bottom > box.bottom) scroller.scrollTop += target.bottom - box.bottom + MARGIN;
    }
  }
}
