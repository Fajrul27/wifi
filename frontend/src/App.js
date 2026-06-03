import { BrowserRouter, Routes, Route } from "react-router-dom";
import routes from "./config/routes";
import { GlobalRealtimeProvider } from "./context/GlobalRealtimeContext";

export default function App() {
  return (
    <GlobalRealtimeProvider>
      <BrowserRouter>
        <Routes>
          {routes.map((r, i) => {
            const Page = r.element;

            if (r.layout) {
              const Layout = r.layout;

              return (
                <Route
                  key={i}
                  path={r.path}
                  element={
                    <Layout>
                      <Page />
                    </Layout>
                  }
                />
              );
            }

            return (
              <Route
                key={i}
                path={r.path}
                element={<Page />}
              />
            );
          })}
        </Routes>
      </BrowserRouter>
    </GlobalRealtimeProvider>
  );
}