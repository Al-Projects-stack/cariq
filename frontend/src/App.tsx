import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { AuthGuard } from "./components/AuthGuard";
import { RequireFavorite } from "./components/RequireFavorite";
import { Home } from "./pages/Home";
import { ModelProfile } from "./pages/ModelProfile";
import { ComparePage } from "./pages/ComparePage";
import { RecommendPage } from "./pages/RecommendPage";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Watchlist } from "./pages/Watchlist";
import { History } from "./pages/History";
import { ChooseFavorite } from "./pages/ChooseFavorite";

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
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
