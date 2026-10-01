Place shared floorplan PNG elements in this folder.

How to add a shared PNG for all users:
1. Copy the PNG into this folder.
2. Import it in `src/app/constants/floorplanPngLibrary.ts` with `?url`.
3. Add an entry to `SHARED_FLOORPLAN_PNG_LIBRARY`.

Example:

```ts
import doorSwingLeftUrl from "../../assets/floorplan-library/door-swing-left.png?url";

export const SHARED_FLOORPLAN_PNG_LIBRARY = [
  {
    id: "door-swing-left",
    name: "Door swing left",
    dataUrl: doorSwingLeftUrl,
    width: 128,
    height: 128,
  },
];
```
