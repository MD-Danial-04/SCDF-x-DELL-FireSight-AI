const WRAPPER_PADDING = 8;
const PAGE_MARGIN_BOTTOM = 8;
const FIT_MARGIN = 4;
const MIN_SCALE = 0.35;
type ZoomSource = number | (() => number);

export interface FitDocxPreviewElements {
  viewport: HTMLElement;
  host: HTMLElement;
  scaler: HTMLElement;
}

function measurePage(page: HTMLElement): { width: number; height: number } {
  const rect = page.getBoundingClientRect();
  return {
    width: rect.width || page.offsetWidth,
    height: rect.height || page.offsetHeight,
  };
}

function measurePagesHeight(innerWrapper: HTMLElement): number {
  const pages = innerWrapper.querySelectorAll("section.docx-preview");
  let total = 0;
  pages.forEach((p, index) => {
    total += measurePage(p as HTMLElement).height;
    if (index < pages.length - 1) total += PAGE_MARGIN_BOTTOM;
  });
  return total;
}

/** Scale docx-preview to panel width; vertical scroll handled by the viewport. */
export function fitDocxPreviewToWidth({
  viewport,
  host,
  scaler,
}: FitDocxPreviewElements, zoomMultiplier = 1): boolean {
  const innerWrapper = host.querySelector(
    ":scope > .docx-preview-wrapper"
  ) as HTMLElement | null;
  if (!innerWrapper) return false;

  const page = innerWrapper.querySelector("section.docx-preview") as HTMLElement | null;
  if (!page) return false;

  host.style.transform = "";
  host.style.width = "";
  host.style.height = "";
  innerWrapper.style.transform = "";
  innerWrapper.style.width = "";
  scaler.style.width = "";
  scaler.style.height = "";

  const { width: pageWidth } = measurePage(page);
  if (pageWidth <= 0) return false;

  const viewportStyle = getComputedStyle(viewport);
  const padX =
    parseFloat(viewportStyle.paddingLeft) + parseFloat(viewportStyle.paddingRight);
  const availW = viewport.clientWidth - padX - FIT_MARGIN;

  const scale = Math.min(availW / pageWidth, 1);
  const clampedScale = Math.max(scale, MIN_SCALE);
  const finalScale = clampedScale * Math.max(zoomMultiplier, 1);

  // innerWrapper.offsetWidth can be clamped to the (narrower) parent when the
  // viewport is smaller than the page, so fall back to the true page width to
  // keep the scaler sized to the content (otherwise the scaled page overflows
  // the undersized scaler and appears pushed to one side instead of centered).
  const naturalWidth = Math.max(
    innerWrapper.offsetWidth,
    pageWidth + WRAPPER_PADDING * 2,
  );
  const naturalHeight = measurePagesHeight(innerWrapper) + WRAPPER_PADDING * 2;

  host.style.width = `${naturalWidth}px`;
  host.style.setProperty("--docx-fit-scale", String(finalScale));
  host.style.transform = `scale(${finalScale})`;
  host.style.transformOrigin = "top left";
  scaler.style.width = `${naturalWidth * finalScale}px`;
  scaler.style.height = `${naturalHeight * finalScale}px`;

  return true;
}

/** @deprecated Use fitDocxPreviewToWidth */
export const fitDocxPreviewToViewport = fitDocxPreviewToWidth;

export function scheduleDocxPreviewFit(
  elements: FitDocxPreviewElements,
  zoomMultiplier = 1,
  onFit?: () => void
): () => void {
  const run = () => {
    fitDocxPreviewToWidth(elements, zoomMultiplier);
    onFit?.();
  };

  const rafId = requestAnimationFrame(run);
  const timeoutId = window.setTimeout(run, 150);

  return () => {
    cancelAnimationFrame(rafId);
    window.clearTimeout(timeoutId);
  };
}

export function observeDocxPreviewFit(
  elements: FitDocxPreviewElements,
  zoomSource: ZoomSource = 1,
): () => void {
  const getZoomMultiplier = () =>
    typeof zoomSource === "function" ? zoomSource() : zoomSource;
  const run = () => fitDocxPreviewToWidth(elements, getZoomMultiplier());

  const viewportObserver = new ResizeObserver(run);
  viewportObserver.observe(elements.viewport);

  const innerWrapper = elements.host.querySelector(":scope > .docx-preview-wrapper");
  const contentObserver = innerWrapper ? new ResizeObserver(run) : null;
  if (innerWrapper && contentObserver) {
    contentObserver.observe(innerWrapper);
  }

  const images = elements.host.querySelectorAll("img");
  const onImageLoad = () => run();
  images.forEach((img) => {
    if (!img.complete) {
      img.addEventListener("load", onImageLoad);
      img.addEventListener("error", onImageLoad);
    }
  });

  return () => {
    viewportObserver.disconnect();
    contentObserver?.disconnect();
    images.forEach((img) => {
      img.removeEventListener("load", onImageLoad);
      img.removeEventListener("error", onImageLoad);
    });
  };
}
