import Link from "next/link";
import MobileNav, { type NavLink } from "./MobileNav";

/** Shared by the desktop cluster and the mobile drawer so they can't drift. */
const NAV_LINKS: readonly NavLink[] = [
  { label: "Product", href: "#" },
  { label: "How it works", href: "#" },
  { label: "ATS checker", href: "/ats-checker" },
  { label: "Log in", href: "#" },
];

// Lives inside the landing hero, which is `pointer-events-none` so drag and
// cursor repulsion reach the particle canvas behind it — hence the explicit
// `pointer-events-auto` here. Harmless on ordinary pages.
export default function SiteNav() {
  return (
    <nav className="pointer-events-auto relative z-20 flex items-center justify-between px-24 py-24 sm:px-48 lg:px-80">
      <Link
        href="/"
        className="font-arial text-[14px] uppercase tracking-[0.12em] text-platinum"
      >
        Aria
      </Link>
      <div className="hidden items-center gap-32 font-arial text-[14px] text-pale-oak md:flex">
        {NAV_LINKS.map((link) =>
          link.href.startsWith("/") ? (
            <Link
              key={link.label}
              href={link.href}
              className="transition-colors hover:text-platinum"
            >
              {link.label}
            </Link>
          ) : (
            <a
              key={link.label}
              href={link.href}
              className="transition-colors hover:text-platinum"
            >
              {link.label}
            </a>
          )
        )}
      </div>
      {/* Below `md` the CTA moves into the drawer, so the bar stays two items. */}
      <a
        href="#"
        className="hidden rounded-button bg-berry-lipstick px-20 py-12 font-arial text-[14px] text-platinum transition-colors hover:bg-[#b32a56] md:inline-block"
      >
        Get Started
      </a>
      <MobileNav links={NAV_LINKS} />
    </nav>
  );
}
