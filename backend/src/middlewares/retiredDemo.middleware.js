// Public demos use fictional browser-local fixtures, never privileged sessions.
export function evaluatorBypassController(_req, res) {
  return res.status(410).json({
    success: false,
    code: "DEMO_BYPASS_RETIRED",
    message: "Demo sign-in has been retired. Explore the read-only demo at /demo.",
  });
}
