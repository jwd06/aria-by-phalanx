"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export interface TextCarouselProps {
  words: string[];
  /** Milliseconds each word is held before transitioning to the next. */
  interval?: number;
  className?: string;
}

export default function TextCarousel({
  words,
  interval = 2600,
  className,
}: TextCarouselProps) {
  const currentRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    function measure() {
      const el = measureRef.current;
      if (!el) return;
      let max = 0;
      Array.from(el.children).forEach((child) => {
        max = Math.max(max, (child as HTMLElement).getBoundingClientRect().width);
      });
      if (max > 0) setWidth(max);
    }
    measure();
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, [words]);

  useEffect(() => {
    if (words.length < 2) return;
    const id = setInterval(() => {
      const el = currentRef.current;
      if (!el) return;
      const next = (indexRef.current + 1) % words.length;
      const tl = gsap.timeline();
      tl.to(el, {
        yPercent: -100,
        opacity: 0,
        duration: 0.45,
        ease: "power2.in",
      })
        .call(() => {
          indexRef.current = next;
          setIndex(next);
        })
        .set(el, { yPercent: 100 })
        .to(el, {
          yPercent: 0,
          opacity: 1,
          duration: 0.5,
          ease: "power2.out",
        });
    }, interval);
    return () => clearInterval(id);
  }, [words, interval]);

  return (
    <span
      className={`relative inline-flex overflow-hidden align-bottom ${className ?? ""}`}
      style={{
        width: width ?? "auto",
        height: "1.15em",
      }}
    >
      <span
        ref={currentRef}
        className="absolute inset-0 inline-flex items-center whitespace-nowrap"
      >
        {words[index]}
      </span>
      <span
        ref={measureRef}
        className="invisible absolute -z-10 flex flex-col whitespace-nowrap"
        aria-hidden="true"
      >
        {words.map((word) => (
          <span key={word}>{word}</span>
        ))}
      </span>
    </span>
  );
}
