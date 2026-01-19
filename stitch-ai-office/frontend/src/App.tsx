import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import Dashboard from './pages/Dashboard';
import SpreadsheetEditor from './pages/SpreadsheetEditor';
import PPTDesigner from './pages/PPTDesigner';
import ReportGenerator from './pages/ReportGenerator';
import DataAnalysis from './pages/DataAnalysis';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="spreadsheet" element={<SpreadsheetEditor />} />
          <Route path="ppt" element={<PPTDesigner />} />
          <Route path="report" element={<ReportGenerator />} />
          <Route path="analytics" element={<DataAnalysis />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
