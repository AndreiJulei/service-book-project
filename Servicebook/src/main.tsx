
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import "./utils/cookieManager"; // Initialize tracking system

  createRoot(document.getElementById("root")!).render(<App />);
  