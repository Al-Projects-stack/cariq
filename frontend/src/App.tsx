import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { ModelProfile } from "./pages/ModelProfile";
import { ComparePage } from "./pages/ComparePage";
import { RecommendPage } from "./pages/RecommendPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/model/:make/:model" element={<ModelProfile />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/recommend" element={<RecommendPage />} />
      </Routes>
    </BrowserRouter>
  );
}
