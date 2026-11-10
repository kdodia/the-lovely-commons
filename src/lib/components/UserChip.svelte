<script lang="ts">
  import Avatar from './Avatar.svelte';

  /** A small avatar + name that links to the person's profile. */
  interface Props {
    userId: string | undefined;
    name: string;
    src: string | undefined;
    /** Use the avatar's loading/placeholder behaviour (see Avatar). */
    fallback?: boolean;
  }

  let { userId, name, src, fallback = false }: Props = $props();
</script>

<a href="/profile/{userId}" class="user-chip">
  <Avatar {src} alt={name} size="1.75rem" {fallback} />
  <span class="user-name">{name}</span>
</a>

<style>
  .user-chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    color: inherit;
    border-radius: var(--radius);
    padding: 0.25rem 0.5rem;
    margin: -0.25rem -0.5rem;
    transition: all var(--transition);
  }

  .user-chip:hover {
    background-color: rgba(16, 185, 129, 0.1);
  }

  .user-name {
    font-weight: 500;
    color: var(--text-primary);
  }

  .user-chip:hover .user-name {
    color: var(--primary);
  }
</style>
