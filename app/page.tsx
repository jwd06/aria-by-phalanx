import ParticleSphere from "./components/ParticleSphere";
import TextCarousel from "./components/TextCarousel";

const PROFESSIONS = [
  "ML Engineers",
  "Software Engineers",
  "Data Analysts",
  "Product Managers",
  "UI/UX Designers",
  "DevOps Engineers",
];

export default function Home() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-pitch-black text-platinum">
      <nav className="relative z-20 flex items-center justify-between px-24 py-24 sm:px-48 lg:px-80">
        <span className="font-arial text-[14px] uppercase tracking-[0.12em] text-platinum">
          Aria
        </span>
        <div className="hidden items-center gap-32 font-arial text-[14px] text-pale-oak md:flex">
          <a href="#" className="transition-colors hover:text-platinum">
            Product
          </a>
          <a href="#" className="transition-colors hover:text-platinum">
            How it works
          </a>
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

      <div className="relative z-10 mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-48 px-24 pb-80 pt-40 sm:px-48 lg:grid-cols-2 lg:gap-64 lg:px-80 lg:pt-64">
        <div className="flex flex-col gap-32">
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

          <div className="flex flex-col gap-16 sm:flex-row sm:items-center">
            <a
              href="#"
              className="rounded-button bg-berry-lipstick px-32 py-16 text-center font-arial text-[14px] text-platinum transition-colors hover:bg-[#b32a56]"
            >
              Build your resume
            </a>
            <a
              href="#"
              className="rounded-button border border-pale-oak/30 px-32 py-16 text-center font-arial text-[14px] text-platinum transition-colors hover:border-pale-oak/60"
            >
              See how it works
            </a>
          </div>
        </div>

        <div className="relative h-[360px] sm:h-[460px] lg:h-[560px]">
          <div
            className="pointer-events-none absolute inset-0 blur-3xl"
            style={{
              background:
                "radial-gradient(circle at center, rgba(204,51,99,0.25), transparent 65%)",
            }}
            aria-hidden="true"
          />
          <ParticleSphere className="absolute inset-0 h-full w-full" />
        </div>
      </div>
    </main>
  );
}
