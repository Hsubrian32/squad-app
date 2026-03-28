import { supabase, getErrorMessage } from '../supabase';
import type { AvailabilitySlot, ApiResult, DayOfWeek, TimeSlot } from '../../constants/types';
import { TIME_SLOT_RANGES } from '../../constants/types';

export interface AvailabilitySlotInput {
  day_of_week: DayOfWeek;
  time_slot: TimeSlot;
}

/**
 * Replace all existing availability slots for a user with the new set.
 * Converts UI time_slot strings to start_time/end_time for the DB.
 */
export async function saveAvailabilitySlots(
  userId: string,
  slots: AvailabilitySlotInput[]
): Promise<ApiResult<AvailabilitySlot[]>> {
  try {
    const { error: deleteError } = await supabase
      .from('availability_slots')
      .delete()
      .eq('user_id', userId);

    if (deleteError) return { data: null, error: deleteError.message };
    if (slots.length === 0) return { data: [], error: null };

    const rows = slots.map((slot) => ({
      user_id: userId,
      day_of_week: slot.day_of_week,
      start_time: TIME_SLOT_RANGES[slot.time_slot].start,
      end_time: TIME_SLOT_RANGES[slot.time_slot].end,
    }));

    const { data, error: insertError } = await supabase
      .from('availability_slots')
      .insert(rows)
      .select();

    if (insertError) return { data: null, error: insertError.message };
    return { data: data as AvailabilitySlot[], error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

/**
 * Fetch all availability slots for a user.
 */
export async function getAvailabilitySlots(
  userId: string
): Promise<ApiResult<AvailabilitySlot[]>> {
  try {
    const { data, error } = await supabase
      .from('availability_slots')
      .select('*')
      .eq('user_id', userId)
      .order('day_of_week', { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: data as AvailabilitySlot[], error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}
