<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { appStore, currentUser, unreadNotificationsCount, STORAGE_KEY } from '$lib/store';
  import FallbackImage from '$lib/components/FallbackImage.svelte';

  let { children } = $props();

  const navItems = [
    { href: '/', label: 'Browse', icon: '🔍' },
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/my-items', label: 'My Library', icon: '📦' },
    { href: '/wishlist', label: 'Wishlist', icon: '❤️' },
    { href: '/network', label: 'Network', icon: '👥' },
    { href: '/tags', label: 'Tags', icon: '🏷️' }
  ];

  let showResetConfirm = $state(false);
  let resetModalElement = $state<HTMLDivElement | undefined>();

  function handleResetData() {
    showResetConfirm = true;
  }

  function confirmReset() {
    localStorage.removeItem(STORAGE_KEY);
    appStore.reset();
    window.location.reload();
  }

  function cancelReset() {
    showResetConfirm = false;
  }

  // Handle escape key for modal
  function handleModalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      cancelReset();
    }
  }

  // Focus modal when it opens
  $effect(() => {
    if (showResetConfirm && resetModalElement) {
      resetModalElement.focus();
    }
  });

  // User switcher (demo affordance: lets you experience each permission tier)
  let showUserMenu = $state(false);
  let userMenuElement = $state<HTMLDivElement | undefined>();

  function switchUser(userId: string) {
    appStore.setCurrentUser(userId);
    showUserMenu = false;
  }

  // Close the user menu on outside click or Escape
  $effect(() => {
    if (!showUserMenu) return;
    const onPointerDown = (e: MouseEvent) => {
      if (userMenuElement && !userMenuElement.contains(e.target as Node)) {
        showUserMenu = false;
      }
    };
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') showUserMenu = false;
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeydown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeydown);
    };
  });
</script>

<div class="app">
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <nav class="navbar">
    <div class="container nav-content">
      <a href="/" class="logo">
        <span class="logo-icon" aria-hidden="true">📚</span>
        <span class="logo-text">Library of Things</span>
      </a>

      <div class="nav-links">
        {#each navItems as item}
          <a
            href={item.href}
            class="nav-link"
            class:active={$page.url.pathname === item.href}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        {/each}
      </div>

      <div class="nav-actions">
        <button class="reset-btn" onclick={handleResetData} aria-label="Reset app data">
          <span aria-hidden="true">🔄</span>
        </button>

        <a href="/notifications" class="notification-btn" aria-label="View notifications{$unreadNotificationsCount > 0 ? `, ${$unreadNotificationsCount} unread` : ''}">
          <span aria-hidden="true">🔔</span>
          {#if $unreadNotificationsCount > 0}
            <span class="notification-badge" aria-hidden="true">{$unreadNotificationsCount}</span>
          {/if}
        </a>

        {#if $currentUser}
          <div class="user-menu" bind:this={userMenuElement}>
            <button
              class="user-avatar"
              onclick={() => (showUserMenu = !showUserMenu)}
              aria-haspopup="menu"
              aria-expanded={showUserMenu}
              aria-label="Switch user (currently {$currentUser.name})"
            >
              <FallbackImage src={$currentUser.profilePic} alt={$currentUser.name} fallbackType="avatar" />
            </button>

            {#if showUserMenu}
              <div class="user-menu-popover" role="menu" aria-label="Switch user">
                <div class="user-menu-header">
                  <span class="viewing-as">Viewing as</span>
                  <a
                    href="/profile/{$currentUser.id}"
                    class="current-user-link"
                    onclick={() => (showUserMenu = false)}
                  >
                    {$currentUser.name} <span aria-hidden="true">→</span>
                  </a>
                </div>
                <div class="user-menu-list">
                  {#each $appStore.users as user (user.id)}
                    <button
                      class="user-menu-item"
                      class:active={user.id === $currentUser.id}
                      role="menuitemradio"
                      aria-checked={user.id === $currentUser.id}
                      onclick={() => switchUser(user.id)}
                    >
                      <span class="menu-avatar">
                        <FallbackImage src={user.profilePic} alt="" fallbackType="avatar" />
                      </span>
                      <span class="menu-name">{user.name}</span>
                      {#if user.id === $currentUser.id}
                        <span class="menu-check" aria-hidden="true">✓</span>
                      {/if}
                    </button>
                  {/each}
                </div>
                <p class="user-menu-hint">Demo: switch users to explore the sharing tiers</p>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </nav>

  <main id="main-content" class="main-content">
    {@render children()}
  </main>
</div>

{#if showResetConfirm}
  <!-- svelte-ignore a11y_click_events_have_key_events - Modal overlay has onkeydown handler for Escape key -->
  <div class="modal-overlay" onclick={cancelReset} onkeydown={handleModalKeydown} role="presentation">
    <div class="modal-content" bind:this={resetModalElement} onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="reset-modal-title" tabindex="-1">
      <h2 id="reset-modal-title">Reset App Data?</h2>
      <p>This will clear all data and reload the app with mock data. This action cannot be undone.</p>
      <div class="modal-actions">
        <button class="btn btn-error" onclick={confirmReset}>Reset Data</button>
        <button class="btn btn-secondary" onclick={cancelReset}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    background: var(--primary);
    color: white;
    padding: 0.5rem 1rem;
    text-decoration: none;
    border-radius: 0 0 var(--radius) 0;
    z-index: 1001;
    font-weight: 600;
  }

  .skip-link:focus {
    top: 0;
  }

  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .navbar {
    background-color: var(--background);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: var(--shadow-sm);
  }

  .nav-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    gap: 2rem;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-weight: 700;
    font-size: 1.25rem;
    color: var(--text-primary);
    text-decoration: none;
  }

  .logo-icon {
    font-size: 1.75rem;
  }

  .logo-text {
    display: none;
  }

  @media (min-width: 640px) {
    .logo-text {
      display: inline;
    }
  }

  .nav-links {
    display: flex;
    gap: 0.5rem;
    flex: 1;
    justify-content: center;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    border-radius: var(--radius);
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 0.875rem;
    transition: all var(--transition);
  }

  .nav-link:hover {
    background-color: var(--surface);
    color: var(--text-primary);
  }

  .nav-link.active {
    background-color: rgba(16, 185, 129, 0.1);
    color: var(--primary);
  }

  .nav-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .reset-btn {
    padding: 0.5rem;
    border-radius: var(--radius);
    font-size: 1.25rem;
    background: none;
    border: none;
    cursor: pointer;
    transition: background-color var(--transition);
    color: var(--text-secondary);
  }

  .reset-btn:hover {
    background-color: var(--surface);
  }

  .notification-btn {
    position: relative;
    padding: 0.5rem;
    border-radius: var(--radius);
    font-size: 1.25rem;
    transition: background-color var(--transition);
  }

  .notification-btn:hover {
    background-color: var(--surface);
  }

  .notification-badge {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    background-color: var(--error);
    color: white;
    font-size: 0.625rem;
    font-weight: 700;
    padding: 0.125rem 0.375rem;
    border-radius: 9999px;
    min-width: 1.125rem;
    text-align: center;
  }

  .user-menu {
    position: relative;
  }

  .user-avatar {
    display: block;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid var(--primary);
    padding: 0;
    background: none;
    cursor: pointer;
    transition: transform var(--transition);
  }

  .user-avatar:hover {
    transform: scale(1.1);
  }

  .user-menu-popover {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    width: 240px;
    background-color: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    z-index: 200;
    animation: slideUp 0.15s ease-out;
    overflow: hidden;
  }

  .user-menu-header {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
  }

  .viewing-as {
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .current-user-link {
    font-weight: 600;
    font-size: 0.9375rem;
    color: var(--text-primary);
    text-decoration: none;
  }

  .current-user-link:hover {
    color: var(--primary);
  }

  .user-menu-list {
    max-height: 280px;
    overflow-y: auto;
    padding: 0.375rem;
  }

  .user-menu-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    padding: 0.5rem 0.625rem;
    border: none;
    background: none;
    border-radius: var(--radius);
    cursor: pointer;
    text-align: left;
    transition: background-color var(--transition);
  }

  .user-menu-item:hover {
    background-color: var(--surface);
  }

  .user-menu-item.active {
    background-color: rgba(16, 185, 129, 0.1);
  }

  .menu-avatar {
    display: block;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .menu-name {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .menu-check {
    color: var(--primary);
    font-weight: 700;
  }

  .user-menu-hint {
    margin: 0;
    padding: 0.625rem 1rem;
    font-size: 0.6875rem;
    color: var(--text-muted);
    background-color: var(--surface);
    border-top: 1px solid var(--border);
  }

  .main-content {
    flex: 1;
    padding: 2rem 0;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
  }

  .modal-content {
    background-color: var(--background);
    padding: 2rem;
    border-radius: var(--radius-lg);
    max-width: 500px;
    width: 90%;
    box-shadow: var(--shadow-lg);
    animation: slideUp 0.2s ease-out;
  }

  .modal-content h2 {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    color: var(--text-primary);
  }

  .modal-content p {
    margin: 0 0 1.5rem 0;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @media (max-width: 640px) {
    .nav-content {
      gap: 0.5rem;
    }

    .nav-links {
      gap: 0.25rem;
    }

    .nav-link span:last-child {
      display: none;
    }

    .nav-link {
      padding: 0.5rem;
      font-size: 1.125rem;
    }

    .modal-content {
      padding: 1.5rem;
    }

    .modal-actions {
      flex-direction: column;
    }
  }
</style>
