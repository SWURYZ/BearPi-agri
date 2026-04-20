import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { RealtimeMonitor } from "./pages/RealtimeMonitor";
import { AlertManagement } from "./pages/AlertManagement";
import { DeviceControl } from "./pages/DeviceControl";
import { AutomationRules } from "./pages/AutomationRules";
import { HistoricalData } from "./pages/HistoricalData";
import { DeviceManagement } from "./pages/DeviceManagement";
import { AIAssistant } from "./pages/AIAssistant";
import { SmartDecision } from "./pages/SmartDecision";
import { Login } from "./pages/Login";
import { UserManagement } from "./pages/UserManagement";
import { LoginLogs } from "./pages/LoginLogs";
import { getCurrentUser } from "./services/auth";
import { useState, useEffect } from "react";

/** 认证守卫：未登录则跳转 /login */
function AuthLayout() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    getCurrentUser().then((u) => {
      setAuthed(!!u);
      setChecking(false);
    });
  }, []);

  if (checking) return null; // 或者 loading spinner
  if (!authed) return <Navigate to="/login" replace />;
  return <Layout />;
}

export const router = createBrowserRouter([
  { path: "/login", Component: Login },
  {
    path: "/",
    Component: AuthLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "monitor", Component: RealtimeMonitor },
      { path: "alerts", Component: AlertManagement },
      { path: "control", Component: DeviceControl },
      { path: "automation", Component: AutomationRules },
      { path: "history", Component: HistoricalData },
      { path: "devices", Component: DeviceManagement },
      { path: "ai", Component: AIAssistant },
      { path: "decision", Component: SmartDecision },
      { path: "users", Component: UserManagement },
      { path: "logs", Component: LoginLogs },
    ],
  },
]);
