import { createBrowserRouter } from "react-router";
import { LandingPage } from "./components/LandingPage";
import { AuthPage } from "./components/auth/AuthPage";
import { ClientSearch } from "./components/client/ClientSearch";
import { ClientAppointments } from "./components/client/ClientAppointments";
import { ClientChats } from "./components/client/ClientChats";
import { ClientSettings } from "./components/client/ClientSettings";
import { FirmDashboard } from "./components/firm/FirmDashboard";
import { FirmAnalytics } from "./components/firm/FirmAnalytics";
import { FirmEmployees } from "./components/firm/FirmEmployees";
import { FirmSettings } from "./components/firm/FirmSettings";
import { AdminDashboard } from "./components/firm/AdminDashboard";
import { FirmChats } from "./components/firm/FirmChats";
import { EmployeeSchedule } from "./components/employee/EmployeeSchedule";
import { EmployeeChats } from "./components/employee/EmployeeChats";
import { EmployeeSettings } from "./components/employee/EmployeeSettings";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LandingPage,
  },
  {
    path: "/auth",
    Component: AuthPage,
  },
  {
    path: "/client/search",
    Component: () => (
      <ProtectedRoute allowedRoles={['client']}>
        <ClientSearch />
      </ProtectedRoute>
    ),
  },
  {
    path: "/client/appointments",
    Component: () => (
      <ProtectedRoute allowedRoles={['client']}>
        <ClientAppointments />
      </ProtectedRoute>
    ),
  },
  {
    path: "/client/chats",
    Component: () => (
      <ProtectedRoute allowedRoles={['client']}>
        <ClientChats />
      </ProtectedRoute>
    ),
  },
  {
    path: "/client/settings",
    Component: () => (
      <ProtectedRoute allowedRoles={['client']}>
        <ClientSettings />
      </ProtectedRoute>
    ),
  },
  {
    path: "/firm/dashboard",
    Component: () => (
      <ProtectedRoute allowedRoles={['admin']}>
        <FirmDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/firm/settings",
    Component: () => (
      <ProtectedRoute allowedRoles={['admin']}>
        <FirmSettings />
      </ProtectedRoute>
    ),
  },
  {
    path: "/firm/chats",
    Component: () => (
      <ProtectedRoute allowedRoles={['admin']}>
        <FirmChats />
      </ProtectedRoute>
    ),
  },
  {
    path: "/firm/admin",
    Component: () => (
      <ProtectedRoute allowedRoles={['admin']}>
        <AdminDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/firm/analytics",
    Component: () => (
      <ProtectedRoute allowedRoles={['admin']}>
        <FirmAnalytics />
      </ProtectedRoute>
    ),
  },
  {
    path: "/firm/employees",
    Component: () => (
      <ProtectedRoute allowedRoles={['admin']}>
        <FirmEmployees />
      </ProtectedRoute>
    ),
  },
  {
    path: "/employee/schedule",
    Component: () => (
      <ProtectedRoute allowedRoles={['user']}>
        <EmployeeSchedule />
      </ProtectedRoute>
    ),
  },
  {
    path: "/employee/chats",
    Component: () => (
      <ProtectedRoute allowedRoles={['user']}>
        <EmployeeChats />
      </ProtectedRoute>
    ),
  },
  {
    path: "/employee/settings",
    Component: () => (
      <ProtectedRoute allowedRoles={['user']}>
        <EmployeeSettings />
      </ProtectedRoute>
    ),
  },
]);