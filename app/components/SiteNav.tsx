import Link from "next/link";

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
        <a href="#" className="transition-colors hover:text-platinum">
          Product
        </a>
        <a href="#" className="transition-colors hover:text-platinum">
          How it works
        </a>
        <Link
          href="/ats-checker"
          className="transition-colors hover:text-platinum"
        >
          ATS checker
        </Link>
        <a href="#" className="transition-colors hover:text-platinum">
          Log in
        </a>
      </div>
      <a
        href="#"
        className="rounded-button bg-berry-lipstick px-20 py-12 font-arial text-[14px] text-platinum transition-colors hover:bg-[#b32a56]"
      >
        Get Started
      </a>
    </nav>
  );
}
