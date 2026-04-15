import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { RealtimeMonitor } from "./pages/RealtimeMonitor";
import { AlertManagement } from "./pages/AlertManagement";
import { DeviceControl } from "./pages/DeviceControl";
import { AutomationRules } from "./pages/AutomationRules";
import { HistoricalData } from "./pages/HistoricalData";
import { DeviceManagement } from "./pages/DeviceManagement";
import { AIAssistant } from "./pages/AIAssistant";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "monitor", Component: RealtimeMonitor },
      { path: "alerts", Component: AlertManagement },
      { path: "control", Component: DeviceControl },
      { path: "automation", Component: AutomationRules },
      { path: "history", Component: HistoricalData },
      { path: "devices", Component: DeviceManagement },
      { path: "ai", Component: AIAssistant },
    ],
  },
]);
