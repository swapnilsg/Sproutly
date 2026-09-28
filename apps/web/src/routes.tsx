import { Navigate, Outlet, useParams, type RouteObject } from 'react-router';
import { homeRoute, useAuth } from './stores/auth';
import { Placeholder } from './screens/Placeholder';
import { SignUp } from './screens/SignUp';
import { VerifyCode } from './screens/VerifyCode';

function Splash() {
  return (
    <main className="splash" aria-busy="true">
      <span className="spinner spinner-lg" aria-label="Loading" />
    </main>
  );
}

/** Step 1 is for signed-out visitors; signed-in users go to where they left off. */
function GuestOnly() {
  const { status, session } = useAuth();
  if (status === 'loading') return <Splash />;
  if (session) return <Navigate to={homeRoute(session)} replace />;
  return <Outlet />;
}

function RequireAuth() {
  const { status, session } = useAuth();
  if (status === 'loading') return <Splash />;
  if (!session) return <Navigate to="/onboarding/1" replace />;
  return <Outlet />;
}

/** Users can revisit completed steps but not jump ahead of their next one. */
function OnboardingStep() {
  const session = useAuth((s) => s.session)!;
  const step = Number(useParams().step);
  const next = Math.min(session.onboardingStep + 1, 8);
  if (session.onboardingDone) return <Navigate to="/dashboard" replace />;
  if (!Number.isInteger(step) || step < 2 || step > next) {
    return <Navigate to={homeRoute(session)} replace />;
  }
  return <Placeholder title={`Onboarding step ${step}`} />;
}

function RootRedirect() {
  const { status, session } = useAuth();
  if (status === 'loading') return <Splash />;
  return <Navigate to={session ? homeRoute(session) : '/onboarding/1'} replace />;
}

export const routes: RouteObject[] = [
  { path: '/', element: <RootRedirect /> },
  {
    element: <GuestOnly />,
    children: [
      { path: '/onboarding/1', element: <SignUp /> },
      { path: '/onboarding/1/code', element: <VerifyCode /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: '/onboarding/:step', element: <OnboardingStep /> },
      { path: '/dashboard', element: <Placeholder title="Dashboard" /> },
    ],
  },
  { path: '*', element: <RootRedirect /> },
];
