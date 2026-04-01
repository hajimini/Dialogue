import { listAdminConversationRows } from "@/lib/admin/insights";
import { queryPostgres } from "@/lib/postgres";
import ConversationsClient from "./ConversationsClient";

export default async function AdminConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string | string[]; persona?: string | string[]; character?: string | string[] }>;
}) {
  const params = await searchParams;
  const sessionId = Array.isArray(params.session) ? params.session[0] : params.session;
  const personaParam = Array.isArray(params.persona) ? params.persona[0] : params.persona;
  const characterParam = Array.isArray(params.character) ? params.character[0] : params.character;
  const rows = await listAdminConversationRows(40);
  const charactersResult = await queryPostgres<{ id: string; name: string }>(
    `
      select id, name
      from user_characters
      order by created_at desc nulls last
    `,
  );
  const characters = charactersResult.rows;

  const personaGroups = Array.from(
    rows.reduce((map, row) => {
      const key = row.session.persona_id;
      const current = map.get(key) ?? {
        personaId: key,
        personaName: row.persona?.name ?? "未知人设",
        sessionCount: 0,
        messageCount: 0,
        lastMessageAt: row.session.last_message_at,
      };

      current.sessionCount += 1;
      current.messageCount += row.messageCount;

      if (
        row.session.last_message_at &&
        (!current.lastMessageAt ||
          new Date(row.session.last_message_at).getTime() >
            new Date(current.lastMessageAt).getTime())
      ) {
        current.lastMessageAt = row.session.last_message_at;
      }

      map.set(key, current);
      return map;
    }, new Map<string, { personaId: string; personaName: string; sessionCount: number; messageCount: number; lastMessageAt: string | null }>()),
  )
    .map(([, value]) => value)
    .sort((left, right) => right.messageCount - left.messageCount);

  const selectedPersonaId =
    personaParam ??
    personaGroups[0]?.personaId ??
    rows[0]?.session.persona_id ??
    null;

  return (
    <div className="mx-auto flex w-full max-w-[1640px] flex-col gap-6 px-6 py-8">
      <section className="rounded-[30px] border border-[#dde8e2] bg-[linear-gradient(135deg,_rgba(255,252,247,0.98),_rgba(244,250,247,0.96))] p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.26em] text-[#76837c]">
              Conversation Review
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#163127]">
              对话记录按人设拆成工作区，不再是一整根长列表。
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#61716a]">
              左边先选人设，中间看这个人设下的会话列表，右边再看完整上下文，这样长列表也不会把页面拖得又长又慢。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-white/60 bg-white/78 px-4 py-4">
              <div className="text-xs text-[#708079]">可见人设</div>
              <div className="mt-2 text-2xl font-semibold text-[#173127]">
                {personaGroups.length}
              </div>
            </div>
            <div className="rounded-[22px] border border-white/60 bg-white/78 px-4 py-4">
              <div className="text-xs text-[#708079]">可见会话</div>
              <div className="mt-2 text-2xl font-semibold text-[#173127]">
                {rows.length}
              </div>
            </div>
            <div className="rounded-[22px] border border-white/60 bg-white/78 px-4 py-4">
              <div className="text-xs text-[#708079]">角色数</div>
              <div className="mt-2 text-2xl font-semibold text-[#173127]">
                {characters?.length ?? 0}
              </div>
            </div>
          </div>
        </div>
      </section>

      <ConversationsClient
        personaGroups={personaGroups}
        rows={rows}
        characters={(characters ?? []) as Array<{ id: string; name: string }>}
        initialPersonaId={selectedPersonaId}
        initialCharacterId={characterParam ?? null}
        initialSessionId={sessionId ?? null}
      />
    </div>
  );
}
