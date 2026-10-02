export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="skeleton h-3 w-40 rounded-full" />
      <div className="skeleton mt-5 h-10 w-72 max-w-full rounded-xl" />
      <div className="skeleton mt-3 h-4 w-96 max-w-full rounded-full" />
      <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="overflow-hidden rounded-3xl border border-line bg-paper">
            <div className="skeleton h-64" />
            <div className="space-y-3 p-6">
              <div className="skeleton h-3 w-24 rounded-full" />
              <div className="skeleton h-6 w-3/4 rounded-lg" />
              <div className="skeleton h-4 w-1/2 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
