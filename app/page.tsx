import SphereStage from "./components/SphereStage";
import SiteNav from "./components/SiteNav";
import TextCarousel from "./components/TextCarousel";

const PROFESSIONS = [
  "ML Engineers",
  "Software Engineers",
  "Data Analysts",
  "Product Managers",
  "UI/UX Designers",
  "DevOps Engineers",
];

const PILLARS = [
  {
    index: "01",
    title: "ATS-friendly resume builder",
    body: "Upload a PDF or DOCX and Aria parses it into structured sections — or build one from scratch in the editor. Every export stays machine-readable.",
  },
  {
    index: "02",
    title: "Tailoring with nothing fabricated",
    body: "Paste a job description and Aria rephrases, reorders, and re-emphasises what your resume already says. Every change lands as a diff you accept or reject. Nothing is auto-applied.",
  },
  {
    index: "03",
    title: "Resume-grounded interview practice",
    body: "Technical and behavioural questions drawn from your own resume and target role. Weak topics resurface until they aren't weak, moving you from not ready to interview ready.",
  },
];

export default function Home() {
  return (
    <main className="relative w-full overflow-x-hidden bg-pitch-black text-platinum">
      {/* Background layer: the glow stays with the hero, the particle canvas
          is fixed so the dissolved field sits behind the whole page. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-screen blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 72% 50%, rgba(204,51,99,0.25), transparent 60%)",
        }}
        aria-hidden="true"
      />
      <SphereStage className="pointer-events-none fixed inset-0 z-0 h-full w-full" />

      {/* pointer-events-none across the hero so drag, cursor repulsion and
          click-scatter reach the canvas behind it; interactive children opt
          back in. Below the hero the canvas turns pointer-transparent itself. */}
      <section
        id="hero"
        className="pointer-events-none relative z-10 min-h-screen"
      >
        <SiteNav />

      <div className="relative z-10 mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-32 px-24 pb-80 pt-40 sm:gap-48 sm:px-48 lg:px-80 lg:pt-64">
        {/* pointer-events-none, with only the CTAs opting back in below: this
            column now sits directly on top of the orb, and its box would
            otherwise swallow every drag, repulsion and scatter event across the
            whole headline. The cost is that the h1 and paragraph stop being
            mouse-selectable; the alternative is a dead sphere behind the words.

            min-w-0: the carousel pins a px width on a nowrap span, which would
            otherwise become this grid item's min-content and drag the whole
            copy column past the viewport.

            max-w: with the hero down to one column the headline would run the
            full 1440px container, which is far too long a measure at
            text-display. */}
        <div className="pointer-events-none flex min-w-0 max-w-[820px] flex-col gap-32">
          <span className="font-arial text-[14px] uppercase tracking-[0.12em] text-berry-lipstick">
            AI-Powered Interview Prep
          </span>

          <h1 className="font-matter text-heading-lg font-medium leading-none text-platinum lg:text-display">
            Built to get{" "}
            <TextCarousel words={PROFESSIONS} className="text-berry-lipstick" />{" "}
            hired.
          </h1>

          <p className="max-w-md text-body text-pale-oak">
            Aria turns your resume and a target role into one closed loop —
            a tailored resume with nothing fabricated, resume-grounded
            interview practice, and a single readiness signal that moves
            from not ready to interview ready.
          </p>

          {/* pointer-events-auto sits on each anchor rather than this wrapper,
              which stretches the full column width and would put the dead zone
              straight back over the orb. */}
          <div className="flex flex-col gap-16 sm:flex-row sm:items-center">
            <a
              href="#"
              className="pointer-events-auto rounded-button bg-berry-lipstick px-32 py-16 text-center font-arial text-[14px] text-platinum transition-colors hover:bg-[#b32a56]"
            >
              Build your resume
            </a>
            <a
              href="#"
              className="pointer-events-auto rounded-button border border-pale-oak/30 px-32 py-16 text-center font-arial text-[14px] text-platinum transition-colors hover:border-pale-oak/60"
            >
              See how it works
            </a>
          </div>
        </div>
      </div>
      </section>

      {/* Anchor target for the nav's "How it works" link. */}
      <section
        id="how-it-works"
        className="relative z-10 mx-auto max-w-[1440px] px-24 py-80 sm:px-48 sm:py-120 lg:px-80"
      >
        <span className="font-arial text-[14px] uppercase tracking-[0.12em] text-berry-lipstick">
          The loop
        </span>
        <h2 className="mt-24 max-w-2xl font-matter text-heading font-medium leading-none text-platinum">
          Everything you need to become interview ready.
        </h2>

        <div className="mt-64 grid grid-cols-1 gap-24 sm:grid-cols-2 md:grid-cols-3">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.index}
              className="rounded-card border border-graphite bg-pitch-black/60 p-24 sm:p-32"
            >
              <span className="font-arial text-[14px] uppercase tracking-[0.12em] text-pale-oak/60">
                {pillar.index}
              </span>
              <h3 className="mt-20 font-matter text-subheading font-medium text-platinum">
                {pillar.title}
              </h3>
              <p className="mt-16 text-body text-pale-oak">{pillar.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
