import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { AuthGuard } from "./components/AuthGuard";
import { Home } from "./pages/Home";
import { ModelProfile } from "./pages/ModelProfile";
import { ComparePage } from "./pages/ComparePage";
import { RecommendPage } from "./pages/RecommendPage";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Watchlist } from "./pages/Watchlist";
import { History } from "./pages/History";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/model/:make/:model" element={<ModelProfile />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/recommend" element={<RecommendPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/watchlist"
            element={
              <AuthGuard>
                <Watchlist />
              </AuthGuard>
            }
          />
          <Route
            path="/history"
            element={
              <AuthGuard>
                <History />
              </AuthGuard>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
