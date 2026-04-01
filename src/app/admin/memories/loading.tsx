export default function AdminMemoriesLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1640px] flex-col gap-6 px-6 py-8">
      <div className="h-52 animate-pulse rounded-[32px] border border-[#d9e6df] bg-white/60" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-[26px] border border-[#dde8e2] bg-white/60" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_360px]">
        <div className="h-[calc(100vh-20rem)] animate-pulse rounded-[30px] border border-[#dde8e2] bg-white/60" />
        <div className="h-[calc(100vh-20rem)] animate-pulse rounded-[30px] border border-[#dde8e2] bg-white/60" />
      </div>
    </div>
  );
}
