
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { registerRoomScanBridge } from "./app/lib/roomScanBridge.ts";
  import "./styles/index.css";

  registerRoomScanBridge();

  createRoot(document.getElementById("root")!).render(<App />);
  