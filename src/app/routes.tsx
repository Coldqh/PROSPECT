import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LoadingScreen } from "../components/feedback/LoadingScreen";

const CareerLibraryScreen = lazy(() => import("../screens/CareerLibraryScreen"));
const NewCareerScreen = lazy(() => import("../screens/NewCareerScreen"));
const CareerOverviewScreen = lazy(() => import("../screens/CareerOverviewScreen"));

export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen label="Загрузка PROSPECT" />}>
      <Routes>
        <Route path="/" element={<CareerLibraryScreen />} />
        <Route path="/new" element={<NewCareerScreen />} />
        <Route path="/career/:careerId" element={<CareerOverviewScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
