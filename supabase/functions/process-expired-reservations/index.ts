import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.rpc("cancel_expired_reservations");

    if (error) {
      console.error("RPC cancel_expired_reservations error:", error);
      return new Response(JSON.stringify({ ok: false, error }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const processed = Array.isArray(data) ? data : [];

    for (const item of processed) {
      const { user_id, slot_id, cancel_reason } = item;

      try {
        await supabase.functions.invoke("notify-reservation-cancelled", {
          body: {
            user_id,
            slot_id,
            reason: cancel_reason
          }
        });
      } catch (e) {
        console.error("notify-reservation-cancelled failed:", item, e);
      }

      try {
        await supabase.functions.invoke("notify-new-slot", {
          body: {
            slot_id,
            exclude_user_id: user_id
          }
        });
      } catch (e) {
        console.error("notify-new-slot failed:", item, e);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      processed_count: processed.length,
      processed
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(JSON.stringify({ ok: false, message: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});