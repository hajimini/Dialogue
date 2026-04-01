export default function ConversationsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1640px] flex-col gap-6 px-6 py-8">
      <div className="h-36 animate-pulse rounded-[30px] border border-[#dde8e2] bg-white/60" />
      <div className="grid gap-6 xl:grid-cols-[260px_380px_minmax(0,1fr)]">
        <div className="h-[calc(100vh-18rem)] animate-pulse rounded-[28px] border border-[#dde8e2] bg-white/60" />
        <div className="h-[calc(100vh-18rem)] animate-pulse rounded-[28px] border border-[#dde8e2] bg-white/60" />
        <div className="h-[calc(100vh-18rem)] animate-pulse rounded-[30px] border border-[#dde8e2] bg-white/60" />
      </div>
    </div>
  );
}
