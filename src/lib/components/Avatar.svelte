<script lang="ts">
  import FallbackImage from './FallbackImage.svelte';

  /**
   * A round user picture. `size` is any CSS length; `border` (optional) draws
   * a primary-coloured ring of that width.
   *
   * By default this is a plain <img>. With `fallback` it uses FallbackImage,
   * which shows a loading shimmer and a placeholder glyph when the picture
   * is missing or fails to load.
   *
   * (Deliberately not classed `avatar`: FallbackImage shrinks its placeholder
   * glyph inside a global `.avatar`, which would change how these look today.)
   */
  interface Props {
    src: string | undefined;
    alt: string;
    size?: string;
    border?: string;
    fallback?: boolean;
  }

  let { src, alt, size = '2.5rem', border = '0px', fallback = false }: Props = $props();
</script>

{#if fallback}
  <span class="user-avatar fallback" style="--avatar-size: {size}; --avatar-border: {border}">
    <FallbackImage {src} {alt} fallbackType="avatar" />
  </span>
{:else}
  <img class="user-avatar" {src} {alt} style="--avatar-size: {size}; --avatar-border: {border}" />
{/if}

<style>
  .user-avatar {
    width: var(--avatar-size);
    height: var(--avatar-size);
    border-radius: 50%;
    border: var(--avatar-border) solid var(--primary);
    flex-shrink: 0;
  }

  img.user-avatar {
    object-fit: cover;
    display: block;
  }

  .fallback {
    display: block;
    overflow: hidden;
  }
</style>
