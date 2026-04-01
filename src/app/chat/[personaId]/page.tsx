import { notFound } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getChatBootstrap, type SessionListItem } from "@/lib/chat/sessions";
import { queryPostgres } from "@/lib/postgres";
import ChatWithPersona from "./ChatWithPersona";
import type { AppUserRecord, MessageRecord, Persona } from "@/lib/supabase/types";

type PersonaListItem = {
  id: string;
  name: string;
  avatar_url: string | null;
  occupation: string | null;
  city: string | null;
  is_active: boolean;
  created_at: string | null;
};

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ personaId: string }>;
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  const { personaId } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedSessionId = Array.isArray(resolvedSearchParams.session)
    ? resolvedSearchParams.session[0]
    : resolvedSearchParams.session;
  const user = await requireAuthenticatedUser(
    requestedSessionId
      ? `/chat/${personaId}?session=${encodeURIComponent(requestedSessionId)}`
      : `/chat/${personaId}`,
  );

  const personaResult = await queryPostgres<Persona>(
    `
      select *
      from personas
      where id = $1
      limit 1
    `,
    [personaId],
  );
  const data = personaResult.rows[0] ?? null;

  if (!data) return notFound();

  const personaListResult = await queryPostgres<PersonaListItem>(
    `
      select id, name, avatar_url, occupation, city, is_active, created_at
      from personas
      where is_active = true
      order by created_at asc nulls last
    `,
  );
  const personaList = personaListResult.rows;

  const bootstrap = await getChatBootstrap(personaId, requestedSessionId, {
    userId: user.id,
  });

  const charactersResult = await queryPostgres<{ id: string; name: string }>(
    `
      select id, name
      from user_characters
      where owner_id = $1
      order by created_at desc nulls last
    `,
    [user.id],
  );
  const characters = charactersResult.rows;

  return (
    <ChatWithPersona
      persona={data as Persona}
      personas={(personaList ?? []) as PersonaListItem[]}
      viewer={user as AppUserRecord}
      initialSessionId={bootstrap.currentSession?.id ?? ""}
      initialSessions={bootstrap.sessions as SessionListItem[]}
      initialMessages={bootstrap.messages as MessageRecord[]}
      requiresCharacterSelection={bootstrap.requiresCharacterSelection}
      characters={(characters ?? []) as Array<{ id: string; name: string }>}
    />
  );
}
