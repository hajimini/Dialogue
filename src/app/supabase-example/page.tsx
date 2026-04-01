import { createServerSupabaseClient } from "@/lib/supabase/server";

type TodoRow = {
  id: string | number;
  name: string | null;
};

export default async function SupabaseExamplePage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("todos").select("id,name");

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold">Supabase Example</h1>
        <p className="text-sm text-neutral-600">
          Could not load <code>todos</code>: {error.message}
        </p>
      </main>
    );
  }

  const todos = (data ?? []) as TodoRow[];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Supabase Example</h1>
        <p className="text-sm text-neutral-600">
          Reading <code>todos</code> with the App Router SSR client.
        </p>
      </div>

      {todos.length === 0 ? (
        <p className="text-sm text-neutral-600">No todos found.</p>
      ) : (
        <ul className="list-disc space-y-2 pl-5">
          {todos.map((todo) => (
            <li key={todo.id}>{todo.name ?? "(unnamed todo)"}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
