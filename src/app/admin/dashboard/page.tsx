import Link from "next/link";
import { getDashboardSnapshot } from "@/lib/admin/insights";

function formatDate(value: string | null) {
  if (!value) return "暂无";

  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDuration(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }

  return `${Math.round(value)}ms`;
}

export default async function AdminDashboardPage() {
  const snapshot = await getDashboardSnapshot();
  const topOperation = snapshot.memoryHealth.operations[0] ?? null;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-6 py-8">
      <section className="overflow-hidden rounded-[32px] border border-[#d9e6df] bg-[radial-gradient(circle_at_top_left,_rgba(43,111,83,0.16),_transparent_36%),linear-gradient(135deg,_rgba(255,252,247,0.98),_rgba(245,251,248,0.96))] p-6 shadow-[0_20px_60px_rgba(35,63,52,0.08)]">
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.26em] text-[#6c7a73]">
              Workspace Snapshot
            </div>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-[#173128]">
              后台现在先给你“判断面”，不是把所有记录一股脑堆出来。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5f6f67]">
              我把对话活跃度、记忆系统健康度和最近风险点拆成了几个清楚的观察层，切页时能更快读到重点。
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/admin/conversations"
                className="rounded-full bg-[#1f6b50] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#17563f]"
              >
                查看对话记录
              </Link>
              <Link
                href="/admin/memory-performance"
                className="rounded-full border border-[#c8dbd2] bg-white/80 px-5 py-3 text-sm font-medium text-[#214f3e] transition hover:bg-[#f3faf6]"
              >
                查看性能监控
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "总用户数", value: snapshot.totals.userCount },
              { label: "今日活跃", value: snapshot.totals.activeTodayCount },
              { label: "会话总量", value: snapshot.totals.sessionCount },
              { label: "消息总量", value: snapshot.totals.messageCount },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[24px] border border-white/60 bg-white/82 px-5 py-5"
              >
                <div className="text-sm text-[#708077]">{item.label}</div>
                <div className="mt-2 text-3xl font-semibold text-[#183026]">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[30px] border border-[#dde8e2] bg-white/88 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[#183026]">系统节奏</h2>
              <p className="mt-1 text-sm text-[#67766f]">
                从会话状态和记忆调用健康度看当前后台是否稳定。
              </p>
            </div>
            <Link
              href="/admin/memory-performance"
              className="rounded-full border border-[#d4e3db] bg-[#f3faf6] px-4 py-2 text-sm text-[#2c5f4b] transition hover:bg-[#e9f6ef]"
            >
              深入查看
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[24px] border border-[#edf2ee] bg-[#fbfdfc] p-4">
              <div className="text-sm font-medium text-[#315444]">会话状态分布</div>
              <div className="mt-4 space-y-3">
                {snapshot.statusBreakdown.map((item) => (
                  <div key={item.status}>
                    <div className="flex items-center justify-between text-sm text-[#4b665b]">
                      <span>{item.status}</span>
                      <span>{item.count}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eaf1ec]">
                      <div
                        className="h-full rounded-full bg-[#2f7a5b]"
                        style={{
                          width: `${Math.max(
                            8,
                            (item.count / Math.max(snapshot.totals.sessionCount, 1)) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-[#eef2ed] bg-[#fcfdfb] p-4">
                <div className="text-sm text-[#6f7d76]">近期调用量</div>
                <div className="mt-2 text-2xl font-semibold text-[#173128]">
                  {snapshot.memoryHealth.totalCalls}
                </div>
                <div className="mt-2 text-xs text-[#7a6c5d]">
                  最近 240 条记录
                </div>
              </div>
              <div className="rounded-[24px] border border-[#eef2ed] bg-[#fcfdfb] p-4">
                <div className="text-sm text-[#6f7d76]">成功率</div>
                <div className="mt-2 text-2xl font-semibold text-[#173128]">
                  {(snapshot.memoryHealth.successRate * 100).toFixed(0)}%
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eaf1ec]">
                  <div
                    className="h-full rounded-full bg-[#2f7a5b]"
                    style={{ width: `${snapshot.memoryHealth.successRate * 100}%` }}
                  />
                </div>
              </div>
              <div className="rounded-[24px] border border-[#eef2ed] bg-[#fcfdfb] p-4">
                <div className="text-sm text-[#6f7d76]">慢调用 {'>'}2s</div>
                <div className="mt-2 text-2xl font-semibold text-[#9a5a1c]">
                  {snapshot.memoryHealth.slowCount}
                </div>
                <div className="mt-2 text-xs text-[#7a6c5d]">
                  占比 {((snapshot.memoryHealth.slowCount / Math.max(snapshot.memoryHealth.totalCalls, 1)) * 100).toFixed(1)}%
                </div>
              </div>
              <div className="rounded-[24px] border border-[#eef2ed] bg-[#fcfdfb] p-4">
                <div className="text-sm text-[#6f7d76]">平均延迟</div>
                <div className="mt-2 text-2xl font-semibold text-[#173128]">
                  {formatDuration(snapshot.memoryHealth.avgDuration)}
                </div>
                <div className="mt-2 text-xs text-[#7a6c5d]">
                  失败 {snapshot.memoryHealth.failureCount} 次
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-[#edf2ee] bg-[#fbfdfc] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-[#315444]">最活跃操作</div>
              {topOperation ? (
                <div className="rounded-full bg-[#edf7f2] px-3 py-1 text-xs text-[#2f684f]">
                  {topOperation.operation}
                </div>
              ) : null}
            </div>
            {topOperation ? (
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-[#536861]">
                <span>{topOperation.count} 次调用</span>
                <span>{topOperation.failureCount} 次失败</span>
                <span>平均 {formatDuration(topOperation.avgDuration)}</span>
              </div>
            ) : (
              <div className="mt-3 text-sm text-[#75857d]">还没有可展示的调用记录。</div>
            )}
          </div>
        </div>

        <div className="rounded-[30px] border border-[#dde8e2] bg-white/88 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[#183026]">风险观察</h2>
              <p className="mt-1 text-sm text-[#67766f]">
                先看错误，再决定要不要钻到具体日志。
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {snapshot.memoryHealth.recentErrors.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#dce6df] bg-[#fbfdfc] px-4 py-8 text-sm text-[#72827b]">
                最近的记忆调用没有错误记录。
              </div>
            ) : (
              snapshot.memoryHealth.recentErrors.map((log) => (
                <div
                  key={`${log.timestamp}-${log.operation}`}
                  className="rounded-[22px] border border-[#f0ddd8] bg-[#fff8f6] px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium text-[#7b3d33]">
                      {log.operation}
                    </div>
                    <div className="text-xs text-[#9d6b61]">
                      {formatDate(log.timestamp)}
                    </div>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[#6f554f]">
                    {log.error_message ?? "未知错误"}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#87665e]">
                    <span>延迟 {formatDuration(log.duration)}</span>
                    <span>用户 {log.user_id}</span>
                    {log.persona_id ? <span>人设 {log.persona_id}</span> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[30px] border border-[#dde8e2] bg-white/88 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[#183026]">人设使用热度</h2>
              <p className="mt-1 text-sm text-[#67766f]">
                用消息量和最近活跃时间快速判断哪些人设正在被频繁使用。
              </p>
            </div>
            <Link
              href="/admin/personas"
              className="rounded-full border border-[#e2ddd2] bg-[#fffaf2] px-4 py-2 text-sm text-[#6d5637] transition hover:bg-[#fff2dd]"
            >
              管理人设
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {snapshot.personaUsage.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#dce6df] bg-[#fbfdfc] px-4 py-8 text-sm text-[#72827b]">
                还没有足够的会话数据。
              </div>
            ) : (
              snapshot.personaUsage.slice(0, 8).map((item, index) => (
                <div
                  key={item.personaId}
                  className="grid gap-3 rounded-[22px] border border-[#edf2ee] bg-[#fbfdfc] px-4 py-4 md:grid-cols-[auto_1fr_auto]"
                >
                  <div className="text-xs uppercase tracking-[0.22em] text-[#8a7a68]">
                    #{index + 1}
                  </div>
                  <div>
                    <div className="text-base font-semibold text-[#1a342a]">
                      {item.personaName}
                    </div>
                    <div className="mt-1 text-sm text-[#66766f]">
                      最近活跃：{formatDate(item.lastMessageAt)}
                    </div>
                  </div>
                  <div className="text-right text-sm text-[#4f665c]">
                    <div>{item.sessionCount} 个会话</div>
                    <div className="mt-1">{item.messageCount} 条消息</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[30px] border border-[#dde8e2] bg-white/88 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[#183026]">角色活跃度</h2>
              <p className="mt-1 text-sm text-[#67766f]">
                按角色统计会话和消息数量，了解用户创建的角色使用情况。
              </p>
            </div>
            <Link
              href="/admin/conversations"
              className="rounded-full border border-[#e2ddd2] bg-[#fffaf2] px-4 py-2 text-sm text-[#6d5637] transition hover:bg-[#fff2dd]"
            >
              查看对话
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {snapshot.characterUsage.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#dce6df] bg-[#fbfdfc] px-4 py-8 text-sm text-[#72827b]">
                还没有角色数据。
              </div>
            ) : (
              snapshot.characterUsage.slice(0, 8).map((item, index) => (
                <div
                  key={item.characterId}
                  className="grid gap-3 rounded-[22px] border border-[#edf2ee] bg-[#fbfdfc] px-4 py-4 md:grid-cols-[auto_1fr_auto]"
                >
                  <div className="text-xs uppercase tracking-[0.22em] text-[#8a7a68]">
                    #{index + 1}
                  </div>
                  <div>
                    <div className="text-base font-semibold text-[#1a342a]">
                      {item.characterId === "unknown" ? "未知角色" : item.characterName}
                    </div>
                  </div>
                  <div className="text-right text-sm text-[#4f665c]">
                    <div>{item.sessionCount} 个会话</div>
                    <div className="mt-1">{item.messageCount} 条消息</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[30px] border border-[#dde8e2] bg-white/88 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[#183026]">最近会话流</h2>
              <p className="mt-1 text-sm text-[#67766f]">
                这里只保留最近重点，完整列表放到对话记录页做分组浏览。
              </p>
            </div>
            <Link
              href="/admin/conversations"
              className="rounded-full border border-[#d4e3db] bg-[#f3faf6] px-4 py-2 text-sm text-[#2c5f4b] transition hover:bg-[#e9f6ef]"
            >
              查看全部
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {snapshot.recentConversations.slice(0, 8).map((row) => (
              <Link
                key={row.session.id}
                href={`/admin/conversations?session=${encodeURIComponent(row.session.id)}`}
                className="grid gap-3 rounded-[22px] border border-[#edf2ee] bg-[#fbfdfc] px-4 py-4 transition hover:border-[#d7e5dd] hover:bg-white md:grid-cols-[1fr_auto]"
              >
                <div>
                  <div className="text-sm font-semibold text-[#1a342a]">
                    {row.user?.nickname ?? "未知用户"} · {row.persona?.name ?? "未知人设"}
                  </div>
                  <div className="mt-1 text-xs text-[#7a6c5d]">
                    {row.messageCount} 条消息 · 最近更新 {formatDate(row.session.last_message_at)}
                  </div>
                  {row.latestMessage ? (
                    <div className="mt-3 line-clamp-2 text-sm leading-6 text-[#50645c]">
                      {row.latestMessage.content}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-start justify-end">
                  <span className="rounded-full bg-[#edf7f2] px-3 py-1 text-xs text-[#2f684f]">
                    {row.session.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
