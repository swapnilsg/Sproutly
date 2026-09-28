import { useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { routes } from './routes';
import { useAuth } from './stores/auth';

export function App() {
  const [router] = useState(() => createBrowserRouter(routes));

  useEffect(() => {
    // Restore the session from the refresh cookie; the access token is never stored.
    void useAuth.getState().refresh();
  }, []);

  return <RouterProvider router={router} />;
}
