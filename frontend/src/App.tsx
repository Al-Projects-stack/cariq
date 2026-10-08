import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { AuthGuard } from "./components/AuthGuard";
import { RequireFavorite } from "./components/RequireFavorite";
import { AdminProvider } from "./contexts/AdminContext";
import { AdminGuard } from "./components/admin/AdminGuard";
import { AdminLayout } from "./components/admin/AdminLayout";
import { Home } from "./pages/Home";
import { ModelProfile } from "./pages/ModelProfile";
import { ComparePage } from "./pages/ComparePage";
import { RecommendPage } from "./pages/RecommendPage";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Watchlist } from "./pages/Watchlist";
import { History } from "./pages/History";
import { ChooseFavorite } from "./pages/ChooseFavorite";

// Admin area is lazy-loaded so public users never download its code.
const AdminLogin = lazy(() => import("./pages/admin/Login").then((m) => ({ default: m.AdminLogin })));
const AdminOverview = lazy(() => import("./pages/admin/Overview").then((m) => ({ default: m.AdminOverview })));
const AdminFailedQuestions = lazy(() => import("./pages/admin/FailedQuestions").then((m) => ({ default: m.AdminFailedQuestions })));
const AdminModels = lazy(() => import("./pages/admin/Models").then((m) => ({ default: m.AdminModels })));
const AdminModelEditor = lazy(() => import("./pages/admin/ModelEditor").then((m) => ({ default: m.AdminModelEditor })));
const AdminVersions = lazy(() => import("./pages/admin/Versions").then((m) => ({ default: m.AdminVersions })));
const AdminHealth = lazy(() => import("./pages/admin/Health").then((m) => ({ default: m.AdminHealth })));
const AdminAuditLog = lazy(() => import("./pages/admin/AuditLog").then((m) => ({ default: m.AdminAuditLog })));
const AdminUsers = lazy(() => import("./pages/admin/Users").then((m) => ({ default: m.AdminUsers })));

function AdminLoading() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-sm text-gray-500">Loading admin...</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RequireFavorite><Home /></RequireFavorite>} />
          <Route path="/model/:make/:model" element={<RequireFavorite><ModelProfile /></RequireFavorite>} />
          <Route path="/compare" element={<RequireFavorite><ComparePage /></RequireFavorite>} />
          <Route path="/recommend" element={<RequireFavorite><RecommendPage /></RequireFavorite>} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/choose-favorite"
            element={
              <AuthGuard>
                <ChooseFavorite />
              </AuthGuard>
            }
          />
          <Route
            path="/watchlist"
            element={
              <AuthGuard>
                <RequireFavorite>
                  <Watchlist />
                </RequireFavorite>
              </AuthGuard>
            }
          />
          <Route
            path="/history"
            element={
              <AuthGuard>
                <RequireFavorite>
                  <History />
                </RequireFavorite>
              </AuthGuard>
            }
          />
          <Route
            path="/admin/*"
            element={
              <AdminProvider>
                <Suspense fallback={<AdminLoading />}>
                  <Routes>
                    <Route path="login" element={<AdminLogin />} />
                    <Route
                      element={
                        <AdminGuard>
                          <AdminLayout />
                        </AdminGuard>
                      }
                    >
                      <Route index element={<AdminOverview />} />
                      <Route path="failures" element={<AdminFailedQuestions />} />
                      <Route path="models" element={<AdminModels />} />
                      <Route path="models/new" element={<AdminModelEditor />} />
                      <Route path="models/:slug" element={<AdminModelEditor />} />
                      <Route path="models/:slug/versions" element={<AdminVersions />} />
                      <Route path="health" element={<AdminHealth />} />
                      <Route path="audit" element={<AdminAuditLog />} />
                      <Route
                        path="users"
                        element={
                          <AdminGuard roles={["admin"]}>
                            <AdminUsers />
                          </AdminGuard>
                        }
                      />
                    </Route>
                  </Routes>
                </Suspense>
              </AdminProvider>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
