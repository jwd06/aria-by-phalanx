/**
 * Asked before the upload, not after, because the answer changes how the resume
 * is scored rather than how it is displayed.
 *
 * There is no preselected default on purpose. Defaulting to "yes" would quietly
 * penalize every student who did not notice the question - which is exactly the
 * failure this control exists to prevent.
 */
export default function ExperienceQuestion({
  value,
  onChange,
  disabled,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  const options: { label: string; value: boolean; hint: string }[] = [
    { label: "Yes", value: true, hint: "I have held a job or internship" },
    { label: "No", value: false, hint: "My projects are my experience so far" },
  ];

  return (
    <fieldset disabled={disabled} className="disabled:opacity-60">
      <legend className="font-arial text-[14px] text-platinum">
        Do you have formal work experience?
      </legend>

      <p className="mt-12 font-arial text-[14px] text-pale-oak">
        If you do not, a missing Experience section will not count against your
        score - your Projects section carries that weight instead.
      </p>

      <div className="mt-20 flex flex-wrap gap-12">
        {options.map((option) => {
          const selected = value === option.value;

          return (
            <label
              key={option.label}
              className={`flex-1 cursor-pointer rounded-button border px-24 py-16 transition-colors ${
                selected
                  ? "border-berry-lipstick bg-berry-lipstick/10"
                  : "border-graphite hover:border-pale-oak/60"
              } ${disabled ? "cursor-not-allowed" : ""}`}
            >
              <input
                type="radio"
                name="hasExperience"
                className="sr-only"
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(option.value)}
              />
              <span className="block font-arial text-[14px] text-platinum">
                {option.label}
              </span>
              <span className="mt-12 block font-arial text-[14px] text-pale-oak">
                {option.hint}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
