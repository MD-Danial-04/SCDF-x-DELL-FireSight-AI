export const SLIDE_DESIGN_WIDTH = 960;

const FIT_MARGIN = 0;
const MIN_SCALE = 0.25;

export interface FitSlidePreviewElements {
  viewport: HTMLElement;
  host: HTMLElement;
  scaler: HTMLElement;
}

/** Scale slide preview to panel; both slides fit without scroll. */
export function fitSlidePreviewToViewport({
  viewport,
  host,
  scaler,
}: FitSlidePreviewElements): boolean {
  host.style.transform = "";
  host.style.width = "";
  host.style.height = "";
  scaler.style.width = "";
  scaler.style.height = "";

  const naturalWidth = host.offsetWidth || SLIDE_DESIGN_WIDTH;
  const naturalHeight = host.offsetHeight;
  if (naturalWidth <= 0 || naturalHeight <= 0) return false;

  const viewportStyle = getComputedStyle(viewport);
  const padX =
    parseFloat(viewportStyle.paddingLeft) + parseFloat(viewportStyle.paddingRight);
  const padY =
    parseFloat(viewportStyle.paddingTop) + parseFloat(viewportStyle.paddingBottom);
  const availW = viewport.clientWidth - padX - FIT_MARGIN;
  const availH = viewport.clientHeight - padY - FIT_MARGIN;

  const scale = Math.min(availW / naturalWidth, availH / naturalHeight, 1);
  const clampedScale = Math.max(scale, MIN_SCALE);

  host.style.width = `${naturalWidth}px`;
  host.style.setProperty("--slide-fit-scale", String(clampedScale));
  host.style.transform = `scale(${clampedScale})`;
  host.style.transformOrigin = "top left";
  scaler.style.width = `${naturalWidth * clampedScale}px`;
  scaler.style.height = `${naturalHeight * clampedScale}px`;

  return true;
}

/** @deprecated Use fitSlidePreviewToViewport */
export const fitSlidePreviewToWidth = fitSlidePreviewToViewport;

export function scheduleSlidePreviewFit(
  elements: FitSlidePreviewElements,
  onFit?: () => void
): () => void {
  const run = () => {
    fitSlidePreviewToViewport(elements);
    onFit?.();
  };

  const rafId = requestAnimationFrame(run);
  const timeoutId = window.setTimeout(run, 150);

  return () => {
    cancelAnimationFrame(rafId);
    window.clearTimeout(timeoutId);
  };
}

export function observeSlidePreviewFit(
  elements: FitSlidePreviewElements
): () => void {
  const run = () => fitSlidePreviewToViewport(elements);

  const viewportObserver = new ResizeObserver(run);
  viewportObserver.observe(elements.viewport);

  const hostObserver = new ResizeObserver(run);
  hostObserver.observe(elements.host);

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
    hostObserver.disconnect();
    images.forEach((img) => {
      img.removeEventListener("load", onImageLoad);
      img.removeEventListener("error", onImageLoad);
    });
  };
}
