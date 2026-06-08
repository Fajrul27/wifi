import { BrowserRouter, Routes, Route } from "react-router-dom";
import routes from "./config/routes";
import { GlobalRealtimeProvider } from "./context/GlobalRealtimeContext";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <GlobalRealtimeProvider>
        <Routes>
          {routes.map((r, i) => {
            const Page = r.element;

            if (r.layout) {
              const Layout = r.layout;
              const content = (
                <Layout>
                  <Page {...(r.props || {})} />
                </Layout>
              );

              return (
                <Route
                  key={i}
                  path={r.path}
                  element={
                    r.role ? (
                      <ProtectedRoute role={r.role}>{content}</ProtectedRoute>
                    ) : content
                  }
                />
              );
            }

            return (
              <Route
                key={i}
                path={r.path}
                element={
                  r.role ? (
                    <ProtectedRoute role={r.role}>
                      <Page {...(r.props || {})} />
                    </ProtectedRoute>
                  ) : (
                    <Page {...(r.props || {})} />
                  )
                }
              />
            );
          })}
        </Routes>
      </GlobalRealtimeProvider>
    </BrowserRouter>
  );
}
