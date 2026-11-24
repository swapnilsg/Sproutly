import { Router } from 'express';

/**
 * City guess for onboarding step 4, from Cloudflare's visitor-location headers
 * (enable "Add visitor location headers" in Cloudflare). No third-party call, no permission prompt.
 * Locally there's no Cloudflare in front, so the answer is { city: null }.
 */
export function geoRoutes(): Router {
  const router = Router();

  router.get('/guess', (req, res) => {
    const city = header(req.headers['cf-ipcity']);
    const country = header(req.headers['cf-ipcountry']);
    res.set('Cache-Control', 'private, no-store');
    res.json(
      city
        ? { city, country_code: country && /^[A-Z]{2}$/.test(country) ? country : null }
        : { city: null },
    );
  });

  return router;
}

function header(value: string | string[] | undefined): string | null {
  const v = (Array.isArray(value) ? value[0] : value)?.trim();
  // Cloudflare uses "XX" / "T1" for unknown / Tor; treat anything odd as unknown.
  if (!v || v.length > 80 || v === 'XX' || v === 'T1') return null;
  return v;
}
