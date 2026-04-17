import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navbar } from "./components/Navbar"
import { Hero } from "./components/Hero"
import { BlueSenseFeatures } from "./components/BlueSenseFeatures"
import { Dashboard } from "./pages/Dashboard"
import { Portfolio } from "./pages/Portfolio"
import "./bluesense.css"

function Landing() {
  return (
    <div className="w-full bg-[#0A3FFF] min-h-screen selection:bg-white/20 selection:text-white pb-0">
      <Navbar />
      <Hero />
      <BlueSenseFeatures />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/vault" element={<Dashboard />} />
        <Route path="/portfolio" element={<Portfolio />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
