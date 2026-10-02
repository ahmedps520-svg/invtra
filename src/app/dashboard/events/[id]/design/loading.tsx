/** Quiet placeholder while the editor's data loads (mirrors the two-pane layout). */
export default function Loading() {
  return (
    <div aria-busy="true" className="pb-14">
      <div className="skeleton h-10 w-72 max-w-full rounded-full" />
      <div className="skeleton mt-4 h-4 w-96 max-w-full rounded-full" />
      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] xl:gap-12">
        <div className="rounded-3xl border border-line bg-paper p-6 shadow-soft">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton aspect-[4/5] rounded-xl" />
            ))}
          </div>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton mt-6 h-12 rounded-xl" />
          ))}
        </div>
        <div className="hidden rounded-3xl border border-line bg-paper p-6 shadow-soft lg:block">
          <div className="skeleton aspect-[4/5] rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
