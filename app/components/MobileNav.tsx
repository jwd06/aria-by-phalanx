"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";

export interface NavLink {
  label: string;
  href: string;
}

/**
 * The sub-`md` counterpart to SiteNav's link cluster: a right-hand drawer.
 *
 * The overlay is portalled to `document.body` rather than left in the nav's
 * subtree. On the landing page SiteNav lives inside `<section id="hero">`
 * (`relative z-10`) and the pillars section is a later `relative z-10` sibling,
 * so a `fixed` drawer rendered in place would paint *under* the pillars once
 * the page has been scrolled. The portal escapes that stacking context — and
 * the hero's `pointer-events-none`, which exists so drags reach the canvas.
 */
export default function MobileNav({ links }: { links: readonly NavLink[] }) {
  const [open, setOpen] = useState(false);
  /**
   * Mounted state for the overlay, kept true through the exit animation.
   * It also doubles as the portal's client guard: it can only ever be true
   * after a click, so the server and first client render always agree.
   */
  const [rendered, setRendered] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  /** False when the close came from navigating away, so focus isn't yanked. */
  const restoreFocus = useRef(true);
  const wasOpen = useRef(false);

  // Resizing past `md` hides the drawer via CSS; close it so the scroll lock
  // and focus trap don't outlive what the user can see.
  useEffect(() => {
    if (!open) return;
    const query = window.matchMedia("(min-width: 48rem)");
    function onChange() {
      if (!query.matches) return;
      restoreFocus.current = false;
      setOpen(false);
    }
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [open]);

  // --- Enter / exit animation ---
  // `useLayoutEffect`, not `useEffect`: the panel's committed markup carries no
  // offset and the backdrop no transparency, so GSAP's `xPercent: 100` /
  // `opacity: 0` are what put them in their closed state. A passive effect isn't
  // guaranteed to run before paint, which can flash one frame of a fully-open
  // drawer that then snaps off-screen and slides back in.
  useLayoutEffect(() => {
    if (!rendered) return;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!panel || !backdrop) return;

    const items = panel.querySelectorAll<HTMLElement>("[data-nav-item]");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const d = (seconds: number) => (reduce ? 0 : seconds);

    const tl = gsap.timeline();
    if (open) {
      tl.fromTo(
        backdrop,
        { opacity: 0 },
        { opacity: 1, duration: d(0.25), ease: "power2.out" }
      )
        .fromTo(
          panel,
          { xPercent: 100 },
          { xPercent: 0, duration: d(0.4), ease: "power3.out" },
          0
        )
        .fromTo(
          items,
          { opacity: 0, x: 16 },
          {
            opacity: 1,
            x: 0,
            duration: d(0.3),
            stagger: d(0.05),
            ease: "power2.out",
          },
          d(0.12)
        );
    } else {
      tl.to(panel, { xPercent: 100, duration: d(0.3), ease: "power3.in" })
        .to(backdrop, { opacity: 0, duration: d(0.25) }, 0)
        .call(() => setRendered(false));
    }
    return () => {
      tl.kill();
    };
  }, [open, rendered]);

  // --- Scroll lock, held through the exit animation ---
  useEffect(() => {
    if (!rendered) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [rendered]);

  // --- Escape + focus trap ---
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        restoreFocus.current = true;
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])"
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      // The panel has plenty of non-focusable area, and tapping it blurs to
      // `<body>` - so focus can already sit outside the dialog by the time Tab
      // arrives. Without this guard neither edge matches and focus walks into
      // the page behind the backdrop.
      if (!(active instanceof Node) || !panel.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey ? active === first : active === last) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (wasOpen.current && !open && restoreFocus.current) {
      triggerRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  function openMenu() {
    restoreFocus.current = true;
    setRendered(true);
    setOpen(true);
  }

  function close() {
    restoreFocus.current = true;
    setOpen(false);
  }

  /** Closing because the user is leaving the page - leave focus to the route. */
  function closeForNavigation() {
    restoreFocus.current = false;
    setOpen(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openMenu}
        aria-expanded={open}
        // The panel only exists in the DOM while `rendered`; pointing at a
        // dangling id the rest of the time is worse than omitting the attribute.
        aria-controls={rendered ? "mobile-nav-panel" : undefined}
        aria-label={open ? "Close menu" : "Open menu"}
        className="-mr-12 flex h-40 w-40 items-center justify-center rounded-small text-platinum md:hidden"
      >
        <span aria-hidden="true" className="flex w-20 flex-col gap-[5px]">
          <span className="block h-[1.5px] w-full bg-current" />
          <span className="block h-[1.5px] w-full bg-current" />
        </span>
      </button>

      {rendered
        ? createPortal(
            <div className="pointer-events-auto fixed inset-0 z-50 md:hidden">
              <div
                ref={backdropRef}
                onClick={close}
                aria-hidden="true"
                className="absolute inset-0 bg-pitch-black/70 backdrop-blur-sm"
              />
              <div
                ref={panelRef}
                id="mobile-nav-panel"
                role="dialog"
                aria-modal="true"
                aria-label="Site navigation"
                className="absolute inset-y-0 right-0 flex w-[min(80vw,320px)] flex-col border-l border-graphite bg-pitch-black px-24 py-24"
              >
                <div className="flex justify-end">
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={close}
                    aria-label="Close menu"
                    className="-mr-12 flex h-40 w-40 items-center justify-center rounded-small text-platinum"
                  >
                    <span aria-hidden="true" className="relative block h-20 w-20">
                      <span className="absolute left-0 top-1/2 block h-[1.5px] w-full -translate-y-1/2 rotate-45 bg-current" />
                      <span className="absolute left-0 top-1/2 block h-[1.5px] w-full -translate-y-1/2 -rotate-45 bg-current" />
                    </span>
                  </button>
                </div>

                <nav className="mt-40 flex flex-col gap-24">
                  {links.map((link) => {
                    const className =
                      "font-matter text-subheading font-medium text-pale-oak transition-colors hover:text-platinum";
                    return link.href.startsWith("/") ? (
                      <Link
                        key={link.label}
                        href={link.href}
                        data-nav-item
                        onClick={closeForNavigation}
                        className={className}
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        key={link.label}
                        href={link.href}
                        data-nav-item
                        onClick={close}
                        className={className}
                      >
                        {link.label}
                      </a>
                    );
                  })}
                </nav>

                <a
                  href="#"
                  data-nav-item
                  onClick={close}
                  className="mt-auto rounded-button bg-berry-lipstick px-20 py-16 text-center font-arial text-[14px] text-platinum transition-colors hover:bg-[#b32a56]"
                >
                  Get Started
                </a>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
