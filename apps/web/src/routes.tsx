import { Navigate, Outlet, useParams, type RouteObject } from 'react-router';
import { homeRoute, useAuth } from './stores/auth';
import { Placeholder } from './screens/Placeholder';
import { SignUp } from './screens/SignUp';
import { StepMeetPlant } from './screens/onboarding/StepMeetPlant';
import { StepPack } from './screens/onboarding/StepPack';
import { StepReminders } from './screens/onboarding/StepReminders';
import { StepSpace } from './screens/onboarding/StepSpace';
import { StepSunlight } from './screens/onboarding/StepSunlight';
import { VerifyCode } from './screens/VerifyCode';
import { Welcome } from './screens/Welcome';

function Splash() {
  return (
    <main className="splash" aria-busy="true">
      <span className="spinner spinner-lg" aria-label="Loading" />
    </main>
  );
}

/** Welcome, save-your-garden and sign-in are for signed-out visitors; signed-in users go to where they left off. */
function GuestOnly() {
  const { status, session } = useAuth();
  if (status === 'loading') return <Splash />;
  if (session) return <Navigate to={homeRoute(session)} replace />;
  return <Outlet />;
}

/** Question steps 2–5: open to guests and to signed-in users who haven't finished onboarding. */
function QuestionStep() {
  const { status, session } = useAuth();
  if (status === 'loading') return <Splash />;
  if (session?.onboardingDone) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function RequireAuth() {
  const { status, session } = useAuth();
  if (status === 'loading') return <Splash />;
  if (!session) return <Navigate to="/onboarding/1" replace />;
  return <Outlet />;
}

/** Placeholder for the unbuilt step 8; it can't be reached before step 7 is done. */
function OnboardingStep() {
  const session = useAuth((s) => s.session)!;
  const step = Number(useParams().step);
  const next = Math.min(session.onboardingStep + 1, 8);
  if (session.onboardingDone) return <Navigate to="/dashboard" replace />;
  if (!Number.isInteger(step) || step < 7 || step > next) {
    return <Navigate to={homeRoute(session)} replace />;
  }
  return <Placeholder title={`Onboarding step ${step}`} />;
}

/** Steps after the garden is saved (7, and soon 8): only once setup has happened. */
function AfterGarden() {
  const session = useAuth((s) => s.session)!;
  if (session.onboardingDone) return <Navigate to="/dashboard" replace />;
  if (session.onboardingStep < 6) return <Navigate to={homeRoute(session)} replace />;
  return <Outlet />;
}

function RootRedirect() {
  const { status, session } = useAuth();
  if (status === 'loading') return <Splash />;
  return <Navigate to={session ? homeRoute(session) : '/onboarding/1'} replace />;
}

export const routes: RouteObject[] = [
  { path: '/', element: <RootRedirect /> },
  {
    element: <QuestionStep />,
    children: [
      { path: '/onboarding/2', element: <StepSpace /> },
      { path: '/onboarding/3', element: <StepSunlight /> },
      { path: '/onboarding/4', element: <StepPack /> },
      { path: '/onboarding/5', element: <StepMeetPlant /> },
    ],
  },
  {
    element: <GuestOnly />,
    children: [
      { path: '/onboarding/1', element: <Welcome /> },
      { path: '/onboarding/6', element: <SignUp mode="save" /> },
      { path: '/onboarding/6/code', element: <VerifyCode mode="save" /> },
      { path: '/signin', element: <SignUp mode="signin" /> },
      { path: '/signin/code', element: <VerifyCode mode="signin" /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AfterGarden />,
        children: [{ path: '/onboarding/7', element: <StepReminders /> }],
      },
      { path: '/onboarding/:step', element: <OnboardingStep /> },
      { path: '/dashboard', element: <Placeholder title="Dashboard" /> },
    ],
  },
  { path: '*', element: <RootRedirect /> },
];
