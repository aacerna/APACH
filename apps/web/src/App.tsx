import { Navigate, Route, Routes } from "react-router-dom";
import { HomeRedirect, RequireRole } from "./components/Guards";
import { Layout } from "./components/Layout";
import { AdminAcademic, AdminSummary, AdminUsers } from "./pages/admin/AdminCore";
import { AdminAudit, AdminImport, AdminMemberships, AdminRules, AdminSettings, AdminTemplates } from "./pages/admin/AdminMore";
import { ForgotPage } from "./pages/auth/ForgotPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { TokenPasswordPage } from "./pages/auth/TokenPasswordPage";
import { CatalogPage } from "./pages/shared/CatalogPage";
import { DocumentResultsPage } from "./pages/shared/DocumentResultsPage";
import { GeneratorPage } from "./pages/shared/GeneratorPage";
import { GuidePage, LearnPage } from "./pages/shared/LearnPages";
import { LibraryPage } from "./pages/shared/LibraryPage";
import { ForbiddenPage, NotFoundPage } from "./pages/shared/StatusPages";
import { TemplatesPage } from "./pages/shared/TemplatesPage";
import { DocumentsPage } from "./pages/student/DocumentsPage";
import { StudentDashboard } from "./pages/student/StudentDashboard";
import { UploadPage } from "./pages/student/UploadPage";
import { TeacherDashboard, TeacherSectionPage } from "./pages/teacher/TeacherPages";

const ALL = ["ADMIN", "TEACHER", "STUDENT"] as const;

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomeRedirect />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="activar" element={<TokenPasswordPage purpose="ACTIVATION" />} />
        <Route path="restablecer" element={<TokenPasswordPage purpose="RESET" />} />
        <Route path="olvide" element={<ForgotPage />} />
        <Route path="403" element={<ForbiddenPage />} />

        {/* Disponibles sin conexión y sin sesión: guía, catálogo y generador (guardar requiere sesión). */}
        <Route path="aprende" element={<LearnPage />} />
        <Route path="aprende/:slug" element={<GuidePage />} />
        <Route path="referencias" element={<CatalogPage />} />
        <Route path="generador" element={<GeneratorPage />} />
        <Route path="biblioteca" element={<RequireRole roles={[...ALL]} needsServer={false}><LibraryPage /></RequireRole>} />

        <Route path="inicio" element={<RequireRole roles={["STUDENT"]}><StudentDashboard /></RequireRole>} />
        <Route path="revisar" element={<RequireRole roles={["STUDENT"]}><UploadPage /></RequireRole>} />
        <Route path="trabajos" element={<RequireRole roles={["STUDENT"]}><DocumentsPage /></RequireRole>} />
        <Route path="trabajos/:id" element={<RequireRole roles={[...ALL]}><DocumentResultsPage /></RequireRole>} />
        <Route path="plantillas" element={<RequireRole roles={[...ALL]}><TemplatesPage /></RequireRole>} />

        <Route path="docente" element={<RequireRole roles={["TEACHER"]}><TeacherDashboard /></RequireRole>} />
        <Route path="docente/secciones/:id" element={<RequireRole roles={["TEACHER"]}><TeacherSectionPage /></RequireRole>} />

        <Route path="admin" element={<RequireRole roles={["ADMIN"]}><AdminSummary /></RequireRole>} />
        <Route path="admin/usuarios" element={<RequireRole roles={["ADMIN"]}><AdminUsers /></RequireRole>} />
        <Route path="admin/academico" element={<RequireRole roles={["ADMIN"]}><AdminAcademic /></RequireRole>} />
        <Route path="admin/matriculas" element={<RequireRole roles={["ADMIN"]}><AdminMemberships /></RequireRole>} />
        <Route path="admin/importar" element={<RequireRole roles={["ADMIN"]}><AdminImport /></RequireRole>} />
        <Route path="admin/plantillas" element={<RequireRole roles={["ADMIN"]}><AdminTemplates /></RequireRole>} />
        <Route path="admin/reglas" element={<RequireRole roles={["ADMIN"]}><AdminRules /></RequireRole>} />
        <Route path="admin/ajustes" element={<RequireRole roles={["ADMIN"]}><AdminSettings /></RequireRole>} />
        <Route path="admin/auditoria" element={<RequireRole roles={["ADMIN"]}><AdminAudit /></RequireRole>} />

        <Route path="inicio/*" element={<Navigate to="/inicio" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
