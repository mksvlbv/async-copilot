import type { User } from "@supabase/supabase-js";

export type RunEventInsert = {
  workspace_id: string;
  case_id: string;
  run_id: string;
  event_type: string;
  actor_type: "system" | "user";
  actor_user_id?: string | null;
  stage_key?: string | null;
  payload?: Record<string, unknown>;
  created_at?: string;
};

type RunEventsWriter = {
  from: (table: string) => {
    insert: (payload: unknown) => PromiseLike<unknown>;
  };
};

export async function appendRunEvent(
  admin: RunEventsWriter,
  event: RunEventInsert,
) {
  return appendRunEvents(admin, [event]);
}

export async function appendRunEvents(
  admin: RunEventsWriter,
  events: RunEventInsert[],
) {
  if (events.length === 0) {
    return;
  }

  await admin.from("run_events").insert(
    events.map((event) => ({
      ...event,
      payload: event.payload ?? {},
    })),
  );
}

export function userActorPayload(user: User | null, summary: string, extra?: Record<string, unknown>) {
  return {
    actor_label: user?.email ?? null,
    summary,
    ...(extra ?? {}),
  };
}
