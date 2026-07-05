


import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from "../pages/Home";

function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Add more routes here as needed */}
      </Routes>
    </Router>
  );
}


export default AppRoutes;
