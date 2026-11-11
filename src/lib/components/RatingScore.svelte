<script lang="ts">
  /** A star glyph followed by a numeric score to one decimal ("⭐ 4.5"). Renders inline, no wrapper. */
  interface Props {
    value: number | undefined;
  }

  let { value }: Props = $props();
</script>

<span aria-hidden="true">⭐</span> {value?.toFixed(1)}
