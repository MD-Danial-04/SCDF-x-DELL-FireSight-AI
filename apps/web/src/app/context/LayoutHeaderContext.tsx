import { createContext, useContext } from "react";

export interface LayoutHeaderContextValue {
  /** Portal target in the app header where a page can render its own menu trigger. */
  slot: HTMLElement | null;
  /** Portal target in the app header (right side) where a page can render action buttons. */
  actionsSlot: HTMLElement | null;
  /** Portal target in the desktop sidebar where a page can render its own navigation. */
  sidebarSlot: HTMLElement | null;
  /** Pages call this to tell the header to hide its default app-navigation hamburger. */
  setHasMenu: (hasMenu: boolean) => void;
  /** Pages call this to take over the desktop sidebar with their own navigation. */
  setHasSidebar: (hasSidebar: boolean) => void;
  /** Pages call this to override the sticky header title (null = use the default route title). */
  setTitle: (title: string | null) => void;
  /** Pages call this to show the current document/incident id under the header title (null = hide). */
  setDocumentId: (documentId: string | null) => void;
}

export const LayoutHeaderContext = createContext<LayoutHeaderContextValue | null>(null);

export function useLayoutHeader(): LayoutHeaderContextValue | null {
  return useContext(LayoutHeaderContext);
}
