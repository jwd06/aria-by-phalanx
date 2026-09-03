import type { ATSCategory } from "@/lib/ats/types";

/**
 * Where the points went. The bar reads as "how much of this category you kept",
 * so a short bar is the thing to look at.
 */
export default function CategoryBreakdown({
  categories,
}: {
  categories: ATSCategory[];
}) {
  return (
    <ul className="flex flex-col gap-16">
      {categories.map((category) => {
        const filled =
          category.weight > 0 ? (category.score / category.weight) * 100 : 0;

        return (
          <li key={category.id}>
            <div className="flex items-baseline justify-between gap-16">
              <span className="font-arial text-[14px] text-platinum">
                {category.name}
              </span>
              <span className="font-arial text-[14px] text-pale-oak">
                {category.score}
                <span className="text-pale-oak/40">/{category.weight}</span>
              </span>
            </div>

            <div
              className="mt-12 h-[4px] w-full overflow-hidden rounded-full bg-graphite"
              role="img"
              aria-label={`${category.name}: ${category.score} of ${category.weight} points`}
            >
              <div
                className="h-full rounded-full bg-berry-lipstick"
                style={{ width: `${filled}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
