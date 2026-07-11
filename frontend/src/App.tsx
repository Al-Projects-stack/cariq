import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { ModelProfile } from "./pages/ModelProfile";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/model/:make/:model" element={<ModelProfile />} />
      </Routes>
    </BrowserRouter>
  );
}
