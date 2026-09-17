<script lang="ts">
  import { toLocalISODate, parseLocalDate, startOfLocalDay, rangesOverlap } from '$lib/dates';

  interface DateInfo {
    date: Date;
    dateStr: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    isPast: boolean;
    isBooked: boolean;
    isBlocked: boolean;
    isInRange: boolean;
    isRangeStart: boolean;
    isRangeEnd: boolean;
  }

  interface Props {
    bookedDates?: Array<{ startDate: string; endDate: string }>;
    blockedDates?: Array<{ startDate: string; endDate: string }>;
    startDate?: string;
    endDate?: string;
    onDateSelect?: (startDate: string, endDate: string | null) => void;
    minDate?: Date;
  }

  let {
    bookedDates = [],
    blockedDates = [],
    startDate = '',
    endDate = '',
    onDateSelect,
    minDate = startOfLocalDay()
  }: Props = $props();

  // Current view state
  let viewDate = $state(new Date());
  let selectingEndDate = $state(false);
  let hoverDate = $state<string | null>(null);
  let conflictMessage = $state<string | null>(null);

  // Normalize minDate to local midnight so "today" isn't treated as past
  // when a caller passes a Date carrying the current wall-clock time.
  let minDay = $derived(startOfLocalDay(minDate));

  // When the parent clears the selection (e.g. the request form is
  // cancelled), leave selection mode instead of staying stuck in it.
  $effect(() => {
    if (!startDate) {
      selectingEndDate = false;
      hoverDate = null;
    }
  });

  // Show the month containing a selection the parent pre-filled.
  $effect(() => {
    if (startDate) {
      const start = parseLocalDate(startDate);
      viewDate = new Date(start.getFullYear(), start.getMonth(), 1);
    }
  });

  // Day names for header
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Helper to check if a date is within any booked period
  function isDateBooked(dateStr: string): boolean {
    return bookedDates.some(
      (period) => dateStr >= period.startDate && dateStr <= period.endDate
    );
  }

  // Helper to check if a date is within any blocked period
  function isDateBlocked(dateStr: string): boolean {
    return blockedDates.some(
      (period) => dateStr >= period.startDate && dateStr <= period.endDate
    );
  }

  // Check if date is in selected range
  function isInRange(dateStr: string): boolean {
    if (!startDate) return false;
    const effectiveEnd = endDate || (selectingEndDate && hoverDate ? hoverDate : null);
    if (!effectiveEnd) return false;
    return dateStr > startDate && dateStr < effectiveEnd;
  }

  // Generate calendar days for current view month
  let calendarDays = $derived.by(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Start from the Sunday of the week containing the first day
    const startDate_ = new Date(firstDay);
    startDate_.setDate(startDate_.getDate() - firstDay.getDay());

    // End at the Saturday of the week containing the last day
    const endDate_ = new Date(lastDay);
    endDate_.setDate(endDate_.getDate() + (6 - lastDay.getDay()));

    const days: DateInfo[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentDate = new Date(startDate_);
    while (currentDate <= endDate_) {
      const dateStr = toLocalISODate(currentDate);
      const isPast = currentDate < minDay;
      const isBooked = isDateBooked(dateStr);
      const isBlocked_ = isDateBlocked(dateStr);

      days.push({
        date: new Date(currentDate),
        dateStr,
        isCurrentMonth: currentDate.getMonth() === month,
        isToday: currentDate.getTime() === today.getTime(),
        isPast,
        isBooked,
        isBlocked: isBlocked_,
        isInRange: isInRange(dateStr),
        isRangeStart: dateStr === startDate,
        isRangeEnd: dateStr === endDate
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  });

  // Month name for display
  let monthDisplay = $derived(
    viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );

  // Navigation
  function prevMonth() {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  }

  function nextMonth() {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
  }

  function goToToday() {
    viewDate = new Date();
  }

  // Check if prev month button should be disabled
  let canGoPrev = $derived.by(() => {
    const prevMonthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth(), 0);
    return prevMonthEnd >= minDay;
  });

  // Date selection
  function handleDateClick(day: DateInfo) {
    if (day.isPast || day.isBooked || day.isBlocked) return;

    if (!startDate || (startDate && endDate) || (selectingEndDate && day.dateStr < startDate)) {
      // Start new selection
      conflictMessage = null;
      onDateSelect?.(day.dateStr, null);
      selectingEndDate = true;
    } else if (selectingEndDate && day.dateStr >= startDate) {
      // Complete the selection (same-day borrows are allowed). Check the full
      // range against every booked/blocked period, not just the days rendered
      // in the current month, so cross-month conflicts are caught too.
      const hasConflict = [...bookedDates, ...blockedDates].some((period) =>
        rangesOverlap(period.startDate, period.endDate, startDate, day.dateStr)
      );
      if (hasConflict) {
        conflictMessage = 'That range includes booked or blocked days — please pick different dates.';
        return;
      }
      conflictMessage = null;
      onDateSelect?.(startDate, day.dateStr);
      selectingEndDate = false;
    }
  }

  function handleDateHover(day: DateInfo) {
    if (selectingEndDate && !day.isPast && !day.isBooked && !day.isBlocked) {
      hoverDate = day.dateStr;
    }
  }

  function handleMouseLeave() {
    hoverDate = null;
  }

  function clearSelection() {
    onDateSelect?.('', null);
    selectingEndDate = false;
    hoverDate = null;
    conflictMessage = null;
  }
</script>

<div class="date-range-calendar" onmouseleave={handleMouseLeave} role="application" aria-label="Date range picker">
  <div class="calendar-header">
    <button
      type="button"
      class="nav-btn"
      onclick={prevMonth}
      disabled={!canGoPrev}
      aria-label="Previous month"
    >
      <span aria-hidden="true">&larr;</span>
    </button>

    <div class="month-display">
      <span class="month-name">{monthDisplay}</span>
      <button type="button" class="today-btn" onclick={goToToday}>Today</button>
    </div>

    <button type="button" class="nav-btn" onclick={nextMonth} aria-label="Next month">
      <span aria-hidden="true">&rarr;</span>
    </button>
  </div>

  <div class="calendar-legend">
    <div class="legend-item">
      <span class="legend-dot available"></span>
      <span>Available</span>
    </div>
    <div class="legend-item">
      <span class="legend-dot booked"></span>
      <span>Booked</span>
    </div>
    <div class="legend-item">
      <span class="legend-dot blocked"></span>
      <span>Blocked</span>
    </div>
  </div>

  <div class="calendar-grid" role="grid">
    <div class="weekday-header" role="row">
      {#each dayNames as day}
        <div class="weekday" role="columnheader">{day}</div>
      {/each}
    </div>

    <div class="days-grid" role="rowgroup">
      {#each calendarDays as day, i}
        {@const isDisabled = day.isPast || day.isBooked || day.isBlocked}
        {@const showRangeHighlight = day.isInRange || (selectingEndDate && hoverDate && startDate && day.dateStr > startDate && day.dateStr < hoverDate)}
        <button
          type="button"
          class="calendar-day"
          class:other-month={!day.isCurrentMonth}
          class:today={day.isToday}
          class:past={day.isPast}
          class:booked={day.isBooked}
          class:blocked={day.isBlocked}
          class:range-start={day.isRangeStart}
          class:range-end={day.isRangeEnd}
          class:in-range={showRangeHighlight}
          class:selecting={selectingEndDate && !isDisabled}
          disabled={isDisabled}
          onclick={() => handleDateClick(day)}
          onmouseenter={() => handleDateHover(day)}
          aria-label="{day.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}{day.isBooked ? ', booked' : ''}{day.isBlocked ? ', blocked' : ''}{day.isRangeStart ? ', selection start' : ''}{day.isRangeEnd ? ', selection end' : ''}"
          aria-selected={day.isRangeStart || day.isRangeEnd}
          role="gridcell"
        >
          <span class="day-number">{day.date.getDate()}</span>
        </button>
      {/each}
    </div>
  </div>

  {#if conflictMessage}
    <div class="conflict-message" role="alert">
      <span aria-hidden="true">⚠️</span> {conflictMessage}
    </div>
  {/if}

  {#if startDate}
    <div class="selection-summary">
      <div class="selection-info">
        <span class="selection-label">Selected:</span>
        <span class="selection-dates">
          {parseLocalDate(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {#if endDate}
            <span aria-hidden="true"> &rarr; </span>
            {parseLocalDate(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {:else}
            <span class="select-end-hint">(click to select end date — same day is fine)</span>
          {/if}
        </span>
      </div>
      <button type="button" class="clear-btn" onclick={clearSelection}>Clear</button>
    </div>
  {:else}
    <div class="selection-hint">
      Click a date to start your selection
    </div>
  {/if}
</div>

<style>
  .date-range-calendar {
    background-color: var(--background);
    border-radius: var(--radius-lg);
    padding: 1rem;
  }

  .calendar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .nav-btn {
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius);
    font-size: 1.25rem;
    color: var(--text-secondary);
    transition: all var(--transition);
  }

  .nav-btn:hover:not(:disabled) {
    background-color: var(--surface);
    color: var(--text-primary);
  }

  .nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .month-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .month-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .today-btn {
    font-size: 0.75rem;
    color: var(--primary);
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius);
    transition: all var(--transition);
  }

  .today-btn:hover {
    background-color: rgba(16, 185, 129, 0.1);
  }

  .calendar-legend {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    margin-bottom: 1rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .legend-dot {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 50%;
  }

  .legend-dot.available {
    background-color: var(--success);
  }

  .legend-dot.booked {
    background-color: var(--error);
  }

  .legend-dot.blocked {
    background-color: #6b7280;
  }

  .calendar-grid {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .weekday-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background-color: var(--surface);
    border-bottom: 1px solid var(--border);
  }

  .weekday {
    padding: 0.75rem 0.25rem;
    text-align: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .days-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
  }

  .calendar-day {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    color: var(--text-primary);
    background-color: transparent;
    transition: all var(--transition);
    position: relative;
    border: 1px solid transparent;
  }

  .calendar-day:hover:not(:disabled) {
    background-color: rgba(16, 185, 129, 0.1);
  }

  .calendar-day.selecting:not(:disabled) {
    cursor: pointer;
  }

  .calendar-day.other-month {
    color: var(--text-muted);
    opacity: 0.5;
  }

  .calendar-day.today {
    font-weight: 700;
    color: var(--primary);
  }

  .calendar-day.today::after {
    content: '';
    position: absolute;
    bottom: 0.25rem;
    left: 50%;
    transform: translateX(-50%);
    width: 0.25rem;
    height: 0.25rem;
    border-radius: 50%;
    background-color: var(--primary);
  }

  .calendar-day.past {
    color: var(--text-muted);
    opacity: 0.4;
  }

  .calendar-day.booked {
    background-color: rgba(239, 68, 68, 0.15);
    color: var(--error);
  }

  .calendar-day.blocked {
    background-color: rgba(107, 114, 128, 0.15);
    color: #6b7280;
  }

  .calendar-day.range-start,
  .calendar-day.range-end {
    background-color: var(--primary);
    color: white;
    font-weight: 600;
  }

  .calendar-day.range-start {
    border-top-left-radius: var(--radius);
    border-bottom-left-radius: var(--radius);
  }

  .calendar-day.range-end {
    border-top-right-radius: var(--radius);
    border-bottom-right-radius: var(--radius);
  }

  .calendar-day.in-range {
    background-color: rgba(16, 185, 129, 0.2);
  }

  .calendar-day:disabled {
    cursor: not-allowed;
  }

  .day-number {
    position: relative;
    z-index: 1;
  }

  .selection-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 1rem;
    padding: 0.75rem;
    background-color: rgba(16, 185, 129, 0.1);
    border-radius: var(--radius);
  }

  .selection-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .selection-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .selection-dates {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .select-end-hint {
    font-weight: 400;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .clear-btn {
    font-size: 0.75rem;
    color: var(--text-secondary);
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius);
    transition: all var(--transition);
  }

  .clear-btn:hover {
    background-color: var(--surface);
    color: var(--error);
  }

  .selection-hint {
    margin-top: 1rem;
    padding: 0.75rem;
    text-align: center;
    font-size: 0.875rem;
    color: var(--text-muted);
    background-color: var(--surface);
    border-radius: var(--radius);
  }

  .conflict-message {
    margin-top: 1rem;
    padding: 0.75rem;
    font-size: 0.875rem;
    color: var(--error);
    background-color: rgba(239, 68, 68, 0.1);
    border-radius: var(--radius);
  }

  @media (max-width: 480px) {
    .calendar-legend {
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .weekday {
      padding: 0.5rem 0.125rem;
      font-size: 0.625rem;
    }

    .calendar-day {
      font-size: 0.75rem;
    }
  }
</style>
