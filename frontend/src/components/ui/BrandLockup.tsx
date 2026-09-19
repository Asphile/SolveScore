const LOGO_HEIGHT: Record<"sm" | "md" | "lg", number> = { sm: 13, md: 17, lg: 26 };
const NAME_SIZE: Record<"sm" | "md" | "lg", string> = { sm: "0.98rem", md: "1.15rem", lg: "1.7rem" };

/** The app's brand mark: Samsung's logo (as supplied for this Solve for
 * Tomorrow submission) paired with the SolveScore product name. The logo
 * always sits in its own light chip so it reads cleanly on both light and
 * dark surfaces, since the source image isn't transparent. */
export function BrandLockup({ size = "md", theme = "light" }: { size?: "sm" | "md" | "lg"; theme?: "light" | "dark" }) {
  return (
    <span className="brand-lockup">
      <span className="brand-logo-chip">
        <img src="/samsung-logo.png" alt="Samsung" style={{ height: LOGO_HEIGHT[size] }} />
      </span>
      <span className="brand-lockup-sep">:</span>
      <span
        className="brand-lockup-name"
        style={{ fontSize: NAME_SIZE[size], color: theme === "dark" ? "#ffffff" : "var(--text)" }}
      >
        Solve<span style={{ color: "var(--brand-cyan-500)" }}>Score</span>
      </span>
    </span>
  );
}
