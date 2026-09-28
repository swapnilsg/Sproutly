import { useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { SproutMark } from '../components/Logo';
import { useAuth } from '../stores/auth';

/** Stand-in for screens that aren't built yet (onboarding steps 2–8, dashboard). */
export function Placeholder({ title }: { title: string }) {
  const navigate = useNavigate();
  const logout = useAuth((s) => s.logout);

  return (
    <main className="placeholder">
      <SproutMark size={48} />
      <h1>{title}</h1>
      <p>You're signed in. This screen is coming next.</p>
      <Button
        variant="ghost"
        onClick={async () => {
          await logout();
          navigate('/onboarding/1', { replace: true });
        }}
      >
        Log out
      </Button>
    </main>
  );
}
