import { createRoot } from "react-dom/client";
import App from "./App";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

if (import.meta.env.VITE_API_URL) {
  setBaseUrl(import.meta.env.VITE_API_URL);
}
setAuthTokenGetter(() => localStorage.getItem("quantedge_token"));

import "./index.css";
createRoot(document.getElementById("root")!).render(<App />);
