/**
 * send-notifications Edge Function
 *
 * Handles dispatching notifications for all Squad lifecycle events.
 * For MVP, all notifications are logged to stdout in a structured format.
 * The NotificationDispatcher class is designed so that a real push/email/SMS
 * provider can be plugged in by implementing the `send` method.
 *
 * Supported notification types (passed as `type` in the POST body):
 *   - new_group_formed     : Called after matching; sent to all group members
 *   - rsvp_reminder        : Sent 48h before the scheduled event
 *   - event_reminder       : Sent 24h before the scheduled event
 *   - feedback_request     : Sent 24h after the event completes
 *   - stay_leave_reminder  : Sent when a stay/leave vote is open
 *
 * Request body (JSON):
 *   {
 *     type: NotificationType,
 *     group_id?: string,   // required for group-scoped notifications
 *     user_id?: string,    // required for single-user notifications
 *     payload?: object     // optional extra data passed to the template
 *   }
 */

import {
  corsHeaders,
  createServiceRoleClient,
  errorResponse,
  handleCors,
  jsonResponse,
} from "../_shared/supabase-client.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationType =
  | "new_group_formed"
  | "rsvp_reminder"
  | "event_reminder"
  | "feedback_request"
  | "stay_leave_reminder";

interface NotificationRequest {
  type: NotificationType;
  group_id?: string;
  user_id?: string;
  payload?: Record<string, unknown>;
}

interface NotificationPayload {
  notification_type: NotificationType;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

interface GroupRow {
  id: string;
  scheduled_time: string;
  status: string;
  venues: { name: string; address: string } | null;
}

interface GroupMemberRow {
  user_id: string;
  rsvp_status: string;
  user_profiles: { display_name: string; push_token: string | null } | null;
}

// ---------------------------------------------------------------------------
// Notification templates
// ---------------------------------------------------------------------------

function buildNotification(
  type: NotificationType,
  userId: string,
  context: {
    groupId?: string;
    scheduledTime?: string;
    venueName?: string;
    venueAddress?: string;
    displayName?: string;
    extra?: Record<string, unknown>;
  }
): NotificationPayload {
  const { groupId, scheduledTime, venueName, venueAddress, displayName, extra } =
    context;

  // Format a readable date string if we have one
  const formattedTime = scheduledTime
    ? new Date(scheduledTime).toLocaleString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "this week";

  switch (type) {
    case "new_group_formed":
      return {
        notification_type: type,
        user_id: userId,
        title: "Your Squad is ready!",
        body: `You have been matched with a new group. You are meeting at ${venueName ?? "a local spot"} on ${formattedTime}. Tap to RSVP!`,
        data: {
          group_id: groupId,
          scheduled_time: scheduledTime,
          venue_name: venueName,
          venue_address: venueAddress,
          action: "open_group",
          ...extra,
        },
      };

    case "rsvp_reminder":
      return {
        notification_type: type,
        user_id: userId,
        title: "Have you RSVP'd yet?",
        body: `Your Squad meetup is in 48 hours at ${venueName ?? "your venue"} (${formattedTime}). Let your group know if you are coming!`,
        data: {
          group_id: groupId,
          scheduled_time: scheduledTime,
          action: "open_rsvp",
          ...extra,
        },
      };

    case "event_reminder":
      return {
        notification_type: type,
        user_id: userId,
        title: "Squad meetup tomorrow!",
        body: `Reminder: you are meeting your Squad tomorrow at ${venueName ?? "your venue"} — ${venueAddress ?? ""} (${formattedTime}).`,
        data: {
          group_id: groupId,
          scheduled_time: scheduledTime,
          venue_name: venueName,
          venue_address: venueAddress,
          action: "open_group",
          ...extra,
        },
      };

    case "feedback_request":
      return {
        notification_type: type,
        user_id: userId,
        title: "How was your Squad?",
        body: "Hope you had a great time! Take 30 seconds to rate your experience and help us improve your next match.",
        data: {
          group_id: groupId,
          action: "open_feedback",
          ...extra,
        },
      };

    case "stay_leave_reminder":
      return {
        notification_type: type,
        user_id: userId,
        title: "Stay or find a new Squad?",
        body: `Hi ${displayName ?? "there"}, it is time to vote! Let us know if you want to stay with your current group or get matched with someone new next week.`,
        data: {
          group_id: groupId,
          action: "open_vote",
          ...extra,
        },
      };

    default: {
      // Exhaustiveness guard
      const _exhaustive: never = type;
      console.warn("Unknown notification type:", _exhaustive);
      return {
        notification_type: type,
        user_id: userId,
        title: "Squad update",
        body: "You have a new update in Squad.",
        data: { group_id: groupId, ...extra },
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Dispatcher — plug in your push provider here
// ---------------------------------------------------------------------------

/**
 * NotificationDispatcher wraps the act of sending a single notification.
 *
 * MVP: logs the payload to stdout.
 * Production: replace the `send` implementation (or subclass) to call
 * Expo Push, FCM, APNs, SendGrid, Twilio, etc.
 */
class NotificationDispatcher {
  async send(notification: NotificationPayload): Promise<void> {
    // -----------------------------------------------------------------------
    // MVP: structured log only.
    // To add a real provider, replace or augment this method, e.g.:
    //
    //   const token = await getPushToken(notification.user_id);
    //   await fetch("https://exp.host/--/api/v2/push/send", {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({
    //       to: token,
    //       title: notification.title,
    //       body: notification.body,
    //       data: notification.data,
    //     }),
    //   });
    // -----------------------------------------------------------------------
    console.log(
      JSON.stringify({
        event: "notification_dispatched",
        ...notification,
        dispatched_at: new Date().toISOString(),
      })
    );
  }

  async sendBatch(notifications: NotificationPayload[]): Promise<void> {
    // In production you may want to batch push API calls for efficiency
    await Promise.all(notifications.map((n) => this.send(n)));
  }
}

// ---------------------------------------------------------------------------
// Handler helpers — one per notification type
// ---------------------------------------------------------------------------

const dispatcher = new NotificationDispatcher();

async function handleNewGroupFormed(
  supabase: ReturnType<typeof createServiceRoleClient>,
  groupId: string,
  extra?: Record<string, unknown>
): Promise<{ sent: number }> {
  // Fetch group details
  const { data: group, error: groupErr } = await supabase
    .from("groups")
    .select("id, scheduled_time, status, venues(name, address)")
    .eq("id", groupId)
    .single();

  if (groupErr || !group) {
    throw new Error(`Group not found: ${groupId}`);
  }

  const g = group as GroupRow;

  // Fetch all members of this group
  const { data: members, error: membersErr } = await supabase
    .from("group_members")
    .select("user_id, rsvp_status, user_profiles(display_name, push_token)")
    .eq("group_id", groupId);

  if (membersErr) {
    throw new Error(`Could not fetch group members: ${membersErr.message}`);
  }

  const notifications = ((members ?? []) as GroupMemberRow[]).map((m) =>
    buildNotification("new_group_formed", m.user_id, {
      groupId,
      scheduledTime: g.scheduled_time,
      venueName: g.venues?.name,
      venueAddress: g.venues?.address,
      displayName: m.user_profiles?.display_name,
      extra,
    })
  );

  await dispatcher.sendBatch(notifications);
  return { sent: notifications.length };
}

async function handleRsvpReminder(
  supabase: ReturnType<typeof createServiceRoleClient>,
  groupId: string,
  extra?: Record<string, unknown>
): Promise<{ sent: number }> {
  const { data: group, error: groupErr } = await supabase
    .from("groups")
    .select("id, scheduled_time, venues(name, address)")
    .eq("id", groupId)
    .single();

  if (groupErr || !group) throw new Error(`Group not found: ${groupId}`);

  const g = group as GroupRow;

  // Only remind users who have not yet responded
  const { data: members, error: membersErr } = await supabase
    .from("group_members")
    .select("user_id, rsvp_status, user_profiles(display_name, push_token)")
    .eq("group_id", groupId)
    .eq("rsvp_status", "pending");

  if (membersErr) throw new Error(`Could not fetch members: ${membersErr.message}`);

  const notifications = ((members ?? []) as GroupMemberRow[]).map((m) =>
    buildNotification("rsvp_reminder", m.user_id, {
      groupId,
      scheduledTime: g.scheduled_time,
      venueName: g.venues?.name,
      extra,
    })
  );

  await dispatcher.sendBatch(notifications);
  return { sent: notifications.length };
}

async function handleEventReminder(
  supabase: ReturnType<typeof createServiceRoleClient>,
  groupId: string,
  extra?: Record<string, unknown>
): Promise<{ sent: number }> {
  const { data: group, error: groupErr } = await supabase
    .from("groups")
    .select("id, scheduled_time, venues(name, address)")
    .eq("id", groupId)
    .single();

  if (groupErr || !group) throw new Error(`Group not found: ${groupId}`);

  const g = group as GroupRow;

  // Only send to users who accepted
  const { data: members, error: membersErr } = await supabase
    .from("group_members")
    .select("user_id, rsvp_status, user_profiles(display_name, push_token)")
    .eq("group_id", groupId)
    .eq("rsvp_status", "accepted");

  if (membersErr) throw new Error(`Could not fetch members: ${membersErr.message}`);

  const notifications = ((members ?? []) as GroupMemberRow[]).map((m) =>
    buildNotification("event_reminder", m.user_id, {
      groupId,
      scheduledTime: g.scheduled_time,
      venueName: g.venues?.name,
      venueAddress: g.venues?.address,
      extra,
    })
  );

  await dispatcher.sendBatch(notifications);
  return { sent: notifications.length };
}

async function handleFeedbackRequest(
  supabase: ReturnType<typeof createServiceRoleClient>,
  groupId: string,
  extra?: Record<string, unknown>
): Promise<{ sent: number }> {
  // Send to all members who attended (accepted RSVP)
  const { data: members, error: membersErr } = await supabase
    .from("group_members")
    .select("user_id, rsvp_status, user_profiles(display_name, push_token)")
    .eq("group_id", groupId)
    .eq("rsvp_status", "accepted");

  if (membersErr) throw new Error(`Could not fetch members: ${membersErr.message}`);

  const notifications = ((members ?? []) as GroupMemberRow[]).map((m) =>
    buildNotification("feedback_request", m.user_id, { groupId, extra })
  );

  await dispatcher.sendBatch(notifications);
  return { sent: notifications.length };
}

async function handleStayLeaveReminder(
  supabase: ReturnType<typeof createServiceRoleClient>,
  groupId: string,
  extra?: Record<string, unknown>
): Promise<{ sent: number }> {
  const { data: members, error: membersErr } = await supabase
    .from("group_members")
    .select("user_id, rsvp_status, user_profiles(display_name, push_token)")
    .eq("group_id", groupId);

  if (membersErr) throw new Error(`Could not fetch members: ${membersErr.message}`);

  const notifications = ((members ?? []) as GroupMemberRow[]).map((m) =>
    buildNotification("stay_leave_reminder", m.user_id, {
      groupId,
      displayName: m.user_profiles?.display_name,
      extra,
    })
  );

  await dispatcher.sendBatch(notifications);
  return { sent: notifications.length };
}

// Single-user variant for targeting one person directly
async function handleSingleUserNotification(
  supabase: ReturnType<typeof createServiceRoleClient>,
  type: NotificationType,
  userId: string,
  groupId?: string,
  extra?: Record<string, unknown>
): Promise<{ sent: number }> {
  let scheduledTime: string | undefined;
  let venueName: string | undefined;
  let venueAddress: string | undefined;
  let displayName: string | undefined;

  if (groupId) {
    const { data: group } = await supabase
      .from("groups")
      .select("scheduled_time, venues(name, address)")
      .eq("id", groupId)
      .single();

    if (group) {
      const g = group as GroupRow;
      scheduledTime = g.scheduled_time;
      venueName = g.venues?.name;
      venueAddress = g.venues?.address;
    }
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name")
    .eq("id", userId)
    .single();

  if (profile) {
    displayName = (profile as { display_name: string }).display_name;
  }

  const notification = buildNotification(type, userId, {
    groupId,
    scheduledTime,
    venueName,
    venueAddress,
    displayName,
    extra,
  });

  await dispatcher.send(notification);
  return { sent: 1 };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  let body: NotificationRequest;

  try {
    body = (await req.json()) as NotificationRequest;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { type, group_id, user_id, payload: extra } = body;

  if (!type) {
    return errorResponse("Missing required field: type", 400);
  }

  const supabase = createServiceRoleClient();

  try {
    let result: { sent: number };

    // If a specific user_id is provided, send to that user only
    if (user_id) {
      result = await handleSingleUserNotification(
        supabase,
        type,
        user_id,
        group_id,
        extra
      );
    } else if (group_id) {
      // Group-scoped dispatch
      switch (type) {
        case "new_group_formed":
          result = await handleNewGroupFormed(supabase, group_id, extra);
          break;
        case "rsvp_reminder":
          result = await handleRsvpReminder(supabase, group_id, extra);
          break;
        case "event_reminder":
          result = await handleEventReminder(supabase, group_id, extra);
          break;
        case "feedback_request":
          result = await handleFeedbackRequest(supabase, group_id, extra);
          break;
        case "stay_leave_reminder":
          result = await handleStayLeaveReminder(supabase, group_id, extra);
          break;
        default: {
          const _exhaustive: never = type;
          return errorResponse(`Unknown notification type: ${_exhaustive}`, 400);
        }
      }
    } else {
      return errorResponse(
        "Either group_id or user_id is required for all notification types",
        400
      );
    }

    console.log(
      `Notification run complete: type=${type} group=${group_id ?? "n/a"} user=${user_id ?? "all"} sent=${result.sent}`
    );

    return jsonResponse({
      success: true,
      notification_type: type,
      notifications_sent: result.sent,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error sending notification (type=${type}):`, message);
    return errorResponse(`Failed to send notification: ${message}`, 500);
  }
});
