/**
 * On-screen size ÷ layout size of an element. A chart inside a CSS-transformed
 * box (the Money Flow pop-up is `transform: scale(…)`) gets pointer positions in
 * screen px while it draws in layout px; dividing by this maps one to the other.
 */
export function pointerScale(screenWidth: number, layoutWidth: number): number {
  return screenWidth > 0 && layoutWidth > 0 ? screenWidth / layoutWidth : 1;
}

/** pointerScale for a DOM element: getBoundingClientRect is on screen, clientWidth is layout. */
export const elementScale = (el: HTMLElement): number => pointerScale(el.getBoundingClientRect().width, el.clientWidth);
