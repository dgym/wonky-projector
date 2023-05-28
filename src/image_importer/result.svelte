<script>
    import { Mesh } from 'ogl';
    import { onDestroy } from 'svelte';

    import { PlaneZ, stretchPlane } from '../geometry.mjs';
    import { withViewport, registerHMRRefresh } from '../render_utils.mjs';

    export let gl;
    export let program;

    export function render({renderer, camera, imageSize, uvMatrix}) {
        const canvasRect = gl.canvas.getBoundingClientRect();
        const rect = div.getBoundingClientRect();
        withViewport(gl, canvasRect, rect, () => {
            const viewportSize = [rect.width, rect.height];
            const [iw, ih] = imageSize;
            const [vw, vh] = viewportSize;
            const [uw, uh] = this.planeSize = stretchPlane({
                imageSize, viewportSize,
            });

            const geometry = new PlaneZ(gl, {
                width: uw,
                height: uh,
                uvMatrix,
            });

            const node = new Mesh(gl, {geometry, program});

            renderer.render({scene: node, camera, sort: false});

            geometry.remove();
        });
    }

    let div;

    // Send a refresh event after hot reloading.
    registerHMRRefresh();
</script>


<div bind:this={div} />


<style>
    div {
        flex: 1 1 0px;
    }
</style>
