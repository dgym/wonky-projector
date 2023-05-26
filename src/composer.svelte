<script>
    import { onMount } from 'svelte';

    import Projector from './projector.svelte';

    export let projection, scene;
    export let updateProjection, updateScene;

    export function setScene(s) {
        scene = s;
    }
    export function setProjection(p) {
        projection = p;
    }

    let rect = {top: 0, left: 0, width: 1, height: 1};
    let composer;
    onMount(() => {
        const resize = () => {
            const newRect = composer.getBoundingClientRect();
            if (newRect.top !== rect.top ||
                    newRect.left !== rect.left ||
                    newRect.width !== rect.width ||
                    newRect.height !== rect.height) {
                rect = newRect;
            }
        }

        const ro = new ResizeObserver(entries => {
            resize();
        });

        ro.observe(composer);
        return () => { ro.unobserve(composer); }
    });
</script>


<div
        bind:this={composer}
        class='composer'
        on:contextmenu={(event) => {event.preventDefault(); return false;}} >
    <Projector {rect}
            {projection}
            {scene}
            {updateProjection}
            {updateScene} />
</div>
