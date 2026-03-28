// Supabase Edge Function: process-venue-vote
// Called after a vote is cast. Tallies votes, checks threshold, and
// if the proposal passes: switches the meetup_location for the group.
//
// Invoked via: supabase.functions.invoke('process-venue-vote', { body: { proposalId, userId, vote } })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ACCEPT_THRESHOLD = 2 / 3; // fraction of active members needed

interface RequestBody {
  proposalId: string;
  userId: string;
  vote: boolean; // true = yes, false = no
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { proposalId, userId, vote } = body;

  // 1. Verify the caller is an active group member and the proposal is open
  const { data: proposal, error: pErr } = await supabase
    .from('venue_switch_proposals')
    .select('*, groups!inner(id)')
    .eq('id', proposalId)
    .eq('status', 'open')
    .gt('expires_at', new Date().toISOString())
    .single();

  if (pErr || !proposal) {
    return new Response(JSON.stringify({ error: 'Proposal not found or closed' }), { status: 404 });
  }

  const groupId = proposal.group_id;

  const { data: membership } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) {
    return new Response(JSON.stringify({ error: 'Not a group member' }), { status: 403 });
  }

  // 2. Upsert the vote (delete + insert to respect unique constraint)
  await supabase
    .from('venue_switch_votes')
    .delete()
    .eq('proposal_id', proposalId)
    .eq('user_id', userId);

  const { error: voteErr } = await supabase
    .from('venue_switch_votes')
    .insert({ proposal_id: proposalId, user_id: userId, vote });

  if (voteErr) {
    return new Response(JSON.stringify({ error: 'Failed to record vote' }), { status: 500 });
  }

  // 3. Tally votes
  const { data: votes } = await supabase
    .from('venue_switch_votes')
    .select('vote')
    .eq('proposal_id', proposalId);

  const yesCount = (votes ?? []).filter((v) => v.vote).length;
  const noCount = (votes ?? []).filter((v) => !v.vote).length;

  // 4. Get total active members for threshold calculation
  const { count: totalActive } = await supabase
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('status', 'active');

  const total = totalActive ?? 0;

  // 5. Update cached counts on proposal
  await supabase
    .from('venue_switch_proposals')
    .update({ votes_yes: yesCount, votes_no: noCount })
    .eq('id', proposalId);

  // 6. Check threshold — unanimous rejection also resolves proposal
  const passed = total > 0 && yesCount / total >= ACCEPT_THRESHOLD;
  const allVoted = yesCount + noCount >= total;

  if (passed) {
    // Accept the proposal
    await supabase
      .from('venue_switch_proposals')
      .update({ status: 'accepted' })
      .eq('id', proposalId);

    // Switch the meetup_location
    await supabase
      .from('meetup_locations')
      .upsert(
        {
          group_id: groupId,
          venue_id: proposal.venue_id,
          name: proposal.name,
          address: proposal.address,
          lat: proposal.lat,
          lng: proposal.lng,
          set_by: userId,
          is_switch: true,
        },
        { onConflict: 'group_id' },
      );

    return new Response(
      JSON.stringify({ outcome: 'accepted', yes: yesCount, no: noCount, total }),
      { status: 200 },
    );
  }

  // Reject if all members voted and threshold not reached
  if (allVoted && !passed) {
    await supabase
      .from('venue_switch_proposals')
      .update({ status: 'rejected' })
      .eq('id', proposalId);

    return new Response(
      JSON.stringify({ outcome: 'rejected', yes: yesCount, no: noCount, total }),
      { status: 200 },
    );
  }

  // Still waiting for more votes
  return new Response(
    JSON.stringify({ outcome: 'pending', yes: yesCount, no: noCount, total }),
    { status: 200 },
  );
});
