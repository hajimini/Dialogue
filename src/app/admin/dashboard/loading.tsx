export default function DashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-6 py-8">
      <div className="h-52 animate-pulse rounded-[32px] border border-[#d9e6df] bg-white/60" />
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="h-72 animate-pulse rounded-[30px] border border-[#dde8e2] bg-white/60" />
        <div className="h-72 animate-pulse rounded-[30px] border border-[#dde8e2] bg-white/60" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="h-64 animate-pulse rounded-[30px] border border-[#dde8e2] bg-white/60" />
        <div className="h-64 animate-pulse rounded-[30px] border border-[#dde8e2] bg-white/60" />
      </div>
    </div>
  );
}
