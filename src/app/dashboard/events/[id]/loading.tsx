/** Shown below the event header while a step loads. */
export default function EventStepLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="skeleton h-3 w-32 rounded-full" />
      <div className="skeleton mt-4 h-9 w-80 max-w-full rounded-xl" />
      <div className="skeleton mt-3 h-4 w-[28rem] max-w-full rounded-full" />
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="skeleton h-72 rounded-2xl lg:col-span-2" />
        <div className="skeleton h-72 rounded-2xl" />
      </div>
    </div>
  );
}
