<script lang="ts">
  import type { BorrowRequest, RequestMessage } from '$lib/types';
  import { appStore, canSendRequestMessage, requestThreadEntries, unreadMessageCount } from '$lib/store';
  import { toLocalISODate } from '$lib/dates';
  import { REQUEST_MESSAGE_MAX_LENGTH } from '$lib/constants';

  interface Props {
    request: BorrowRequest;
    /**
     * Send a message; return true when it was accepted so the draft can be
     * cleared. The caller surfaces any error. Without it the thread is
     * read-only.
     */
    onSend?: (requestId: string, text: string) => boolean;
    /** Whether the thread is expanded; bindable so cards can hide duplicates. */
    open?: boolean;
  }

  let { request, onSend, open = $bindable(false) }: Props = $props();

  // Show the character counter once the draft is this close to the limit.
  const COUNTER_THRESHOLD = REQUEST_MESSAGE_MAX_LENGTH - 100;

  let me = $derived($appStore.currentUserId);
  let otherUserId = $derived(me === request.lenderId ? request.borrowerId : request.lenderId);
  let otherUser = $derived($appStore.users.find((u) => u.id === otherUserId));

  // The borrower's original note opens the thread; it is not stored in `messages`.
  let entries = $derived<RequestMessage[]>(requestThreadEntries(request));
  let unread = $derived(unreadMessageCount(request, me));

  let canSend = $derived(!!onSend && canSendRequestMessage(request, me));
  let draft = $state('');
  let trimmedLength = $derived(draft.trim().length);
  let overLimit = $derived(trimmedLength > REQUEST_MESSAGE_MAX_LENGTH);
  let listElement = $state<HTMLOListElement | undefined>();

  let threadId = $derived(`thread-${request.id}`);
  let inputId = $derived(`thread-input-${request.id}`);

  function senderLabel(userId: string): string {
    if (userId === me) return 'You';
    return $appStore.users.find((u) => u.id === userId)?.name ?? 'Unknown user';
  }

  /** "3:05 PM" today, "Mon 3:05 PM" this week, "Nov 2" before that. */
  function formatMessageTime(at: string): string {
    const date = new Date(at);
    const now = new Date();
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (toLocalISODate(date) === toLocalISODate(now)) return time;
    const ageDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays >= 0 && ageDays < 6) {
      return `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`;
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatFullTime(at: string): string {
    return new Date(at).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function send() {
    if (!onSend || trimmedLength === 0 || overLimit) return;
    if (onSend(request.id, draft)) draft = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    // Enter sends; Shift+Enter (or an IME composition) inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send();
    }
  }

  // Opening the thread, or a message arriving while it is open, marks it read.
  // Once marked, `unread` is 0 and the rule is not called again.
  $effect(() => {
    if (open && unread > 0) appStore.markRequestMessagesRead(request.id);
  });

  // Keep the newest message in view when the thread opens or grows.
  $effect(() => {
    if (open && listElement && entries.length > 0) {
      listElement.scrollTop = listElement.scrollHeight;
    }
  });
</script>

{#if entries.length > 0 || canSend}
  <div class="request-thread" data-testid="request-thread">
    <button
      type="button"
      class="thread-toggle"
      aria-expanded={open}
      aria-controls={threadId}
      onclick={() => (open = !open)}
    >
      <span aria-hidden="true">💬</span>
      {#if entries.length > 0}
        Messages ({entries.length})
      {:else}
        Message {otherUser?.name ?? 'the other person'}
      {/if}
      {#if unread > 0 && !open}
        <span class="unread-badge" data-testid="unread-badge">{unread} new</span>
      {/if}
      <span class="chevron" class:open aria-hidden="true">▾</span>
    </button>

    {#if open}
      <div class="thread-body" id={threadId}>
        {#if entries.length > 0}
          <ol
            class="thread-messages"
            bind:this={listElement}
            aria-label="Messages with {otherUser?.name ?? 'the other person'}"
          >
            {#each entries as entry (entry.id)}
              {@const mine = entry.fromUserId === me}
              <li class="thread-message" class:mine data-testid="thread-message">
                <div class="message-meta">
                  <span class="message-sender">{senderLabel(entry.fromUserId)}</span>
                  <time datetime={entry.at} title={formatFullTime(entry.at)}>{formatMessageTime(entry.at)}</time>
                </div>
                <p class="message-text">{entry.text}</p>
              </li>
            {/each}
          </ol>
        {:else}
          <p class="thread-empty">No messages yet — agree a pickup time or ask a question.</p>
        {/if}

        {#if canSend}
          <form
            class="thread-compose"
            onsubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label for={inputId} class="sr-only">Message {otherUser?.name ?? 'the other person'}</label>
            <textarea
              id={inputId}
              bind:value={draft}
              onkeydown={handleKeydown}
              rows="2"
              placeholder="Write a message…"
              aria-describedby={trimmedLength >= COUNTER_THRESHOLD ? `${inputId}-count` : undefined}
            ></textarea>
            <div class="compose-footer">
              <span class="compose-hint">Enter to send · Shift+Enter for a new line</span>
              {#if trimmedLength >= COUNTER_THRESHOLD}
                <span id="{inputId}-count" class="char-count" class:over={overLimit} aria-live="polite">
                  {trimmedLength}/{REQUEST_MESSAGE_MAX_LENGTH}
                </span>
              {/if}
              <button
                type="submit"
                class="btn btn-primary btn-sm"
                disabled={trimmedLength === 0 || overLimit}
              >
                Send
              </button>
            </div>
          </form>
        {:else if entries.length > 0}
          <p class="thread-closed">This request is closed — the conversation is read-only.</p>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .request-thread {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }

  .thread-toggle {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: none;
    border: none;
    padding: 0.25rem 0;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--primary-dark);
    cursor: pointer;
  }

  .thread-toggle:hover {
    text-decoration: underline;
  }

  .unread-badge {
    padding: 0.0625rem 0.5rem;
    border-radius: 999px;
    background-color: var(--primary-dark);
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .chevron {
    display: inline-block;
    transition: transform var(--transition);
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .thread-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background-color: var(--surface);
    min-width: 0;
  }

  .thread-messages {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 20rem;
    overflow-y: auto;
  }

  .thread-message {
    align-self: flex-start;
    max-width: 85%;
    min-width: 0;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    border-bottom-left-radius: 0;
    background-color: var(--background);
  }

  .thread-message.mine {
    align-self: flex-end;
    border-color: rgba(16, 185, 129, 0.35);
    border-radius: var(--radius);
    border-bottom-right-radius: 0;
    background-color: rgba(16, 185, 129, 0.1);
  }

  .message-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.5rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .thread-message.mine .message-meta {
    justify-content: flex-end;
  }

  .message-sender {
    font-weight: 600;
    color: var(--text-primary);
  }

  .message-text {
    margin: 0.25rem 0 0 0;
    font-size: 0.9375rem;
    color: var(--text-primary);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .thread-empty,
  .thread-closed {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .thread-compose {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .thread-compose textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-family: inherit;
    font-size: 0.9375rem;
    resize: vertical;
    background-color: var(--background);
    transition: border-color var(--transition);
  }

  .thread-compose textarea:focus {
    outline: none;
    border-color: var(--primary);
  }

  .compose-footer {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .compose-hint {
    flex: 1;
    min-width: 0;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .char-count {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .char-count.over {
    color: var(--error);
    font-weight: 600;
  }
</style>
