/**
 * Shown when extraction itself is suspect. The score below it is still real and
 * still shown - a resume an ATS cannot read genuinely is a low score - but
 * every downstream check is measuring the extraction rather than the resume,
 * and saying so is the difference between one actionable problem and fifteen
 * confusing ones.
 */
export default function LowConfidenceBanner({ message }: { message: string }) {
  return (
    <div className="rounded-card border border-berry-lipstick/40 bg-berry-lipstick/10 p-24">
      <p className="font-arial text-[10px] uppercase tracking-[0.15em] text-berry-lipstick">
        Fix this first
      </p>
      <p className="mt-12 font-arial text-[14px] leading-[1.43] text-platinum">
        {message}
      </p>
    </div>
  );
}
