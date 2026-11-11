<script lang="ts">
  import { appStore } from '$lib/store';
  import DateRangeCalendar from '$lib/components/DateRangeCalendar.svelte';
  import type { Item } from '$lib/types';
  import { addDays, startOfLocalDay } from '$lib/dates';

  /**
   * "Availability & Booking" card. Picking dates here also opens the request
   * form in the main column (the draft dates are shared with the page).
   */
  interface Props {
    item: Item;
    startDate: string;
    endDate: string;
    showRequestForm: boolean;
  }

  let {
    item,
    startDate = $bindable(),
    endDate = $bindable(),
    showRequestForm = $bindable()
  }: Props = $props();

  // Booked date ranges: approved or active loans of this item
  let bookedDateRanges = $derived(
    $appStore.borrowRequests
      .filter((r) => r.itemId === item.id && (r.status === 'approved' || r.status === 'active'))
      .map((b) => ({ startDate: b.startDate, endDate: b.endDate }))
  );

  // Blocked date ranges: the owner's own no-lend dates
  let blockedDateRanges = $derived(item.blockedDates || []);

  // Min date for calendar (tomorrow)
  let minCalendarDate = $derived(startOfLocalDay(addDays(new Date(), 1)));

  function handleDateSelect(start: string, end: string | null) {
    startDate = start;
    endDate = end || '';
    if (start && !showRequestForm) {
      showRequestForm = true;
    }
  }
</script>

<div class="calendar-section card">
  <h3>Availability & Booking</h3>
  <p class="calendar-hint">Select dates to request this item</p>
  <DateRangeCalendar
    bookedDates={bookedDateRanges}
    blockedDates={blockedDateRanges}
    {startDate}
    {endDate}
    onDateSelect={handleDateSelect}
    minDate={minCalendarDate}
  />
</div>

<style>
  .calendar-section {
    padding: 1.5rem;
  }

  .calendar-section h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .calendar-hint {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin: 0 0 1rem 0;
  }
</style>
