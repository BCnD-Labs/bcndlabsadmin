/**
 * PowerPoint shrinks text that does not fit its box ("shrink text on overflow"). The slide renderer doesn't, so a long
 * title ran past its box and was cut off. This scales the text of any box whose text overflows until it fits, down to
 * 40% of its size, the way PowerPoint does.
 */
export function fitText(root: HTMLElement) {
  for (const box of root.querySelectorAll<HTMLElement>("div")) {
    if (!box.querySelector("p") || getComputedStyle(box).overflow !== "hidden" || box.scrollHeight <= box.clientHeight + 1) continue
    const sized = [box, ...box.querySelectorAll<HTMLElement>("*")].filter((e) => e.style.fontSize.endsWith("px")).map((e) => [e, parseFloat(e.style.fontSize)] as const)
    if (!sized.length) continue
    for (let scale = 0.95; scale >= 0.4; scale -= 0.05) {
      for (const [e, size] of sized) e.style.fontSize = `${(size * scale).toFixed(2)}px`
      if (box.scrollHeight <= box.clientHeight + 1) break
    }
  }
}
