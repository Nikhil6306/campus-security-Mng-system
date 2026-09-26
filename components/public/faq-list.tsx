import { ChevronDown } from "lucide-react";

/**
 * FAQ list.
 *
 * Built on `<details>`/`<summary>` so it is keyboard operable, expandable
 * without JavaScript and findable by in-page browser search — no accordion
 * library and no client bundle.
 */
export function FaqList({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <div className="mt-10 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {items.map((item) => (
        <details key={item.question} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            {item.question}
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="px-5 pb-5 pt-0">
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {item.answer}
            </p>
          </div>
        </details>
      ))}
    </div>
  );
}
