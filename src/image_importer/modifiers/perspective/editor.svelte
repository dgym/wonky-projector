<script context='module'>
    import { default as Handle, HandleInst } from '../../../handle.svelte';
    import { Vec2, Mat3, clamp } from '../../../maths.mjs';

    class PerspectiveHandle extends HandleInst {
        getPos() {
            this.pos = this.handles ? this.handles[this.idx] : new Vec2(0, 0);
            return super.getPos();
        }

        dragStart(point) {
            this.start = {
                point,
                handle: this.handles[this.idx],
            }
        }

        dragMove(point) {
            const newPoint = point.clone()
                .sub(this.start.point)
                .add(this.start.handle);
            newPoint.x = clamp(newPoint.x, 0, 1);
            newPoint.y = clamp(newPoint.y, 0, 1);
            const newHandles = [...this.handles];
            newHandles[this.idx] = newPoint;
            this.updateImageImports({
                type: 'setPerspectiveHandles',
                handles: newHandles,
            });
        }
    }
</script>


<script>
    import { Mesh } from 'ogl';

    import { PlaneZ, stretchPlane } from '../../../geometry.mjs';
    import { TextureZProgram } from '../../../renderer.mjs';
    import {
        withViewport, registerHMRRefresh, registerResizeObserver
    } from '../../../render_utils.mjs';

    export let gl;
    export let program;
    export let handles;
    export let updateImageImports;

    const uv2window = new Mat3();
    const window2uv = new Mat3();
    let svgHandles = [...Array(4).keys()].map((idx) =>
        new PerspectiveHandle({idx})
    );

    export function render({renderer, camera, imageSize, uvMatrix}) {
        const canvasRect = gl.canvas.getBoundingClientRect();
        const rect = div.getBoundingClientRect();
        withViewport(gl, canvasRect, rect, () => {
            // Render.
            const viewportSize = [rect.width, rect.height];
            const [iw, ih] = imageSize;
            const [vw, vh] = viewportSize;
            const [uw, uh] = stretchPlane({
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

            // Update matrix and svg handles.
            uv2window.set(
                uw*vw/2, 0, 0,
                0, uh*vh/2, 0,
                (1-uw/2)*vw/2, (1-uh/2)*vh/2, 1,
            );
            window2uv.copy(uv2window).inverse();

            const props = {
                handles,
                matrix: uv2window,
                invMatrix: window2uv,
                updateImageImports,
                viewportRect: rect,
            };
            svgHandles = svgHandles.map((handle) => handle.update(props));
        });
    }

    let div;

    // Send a refresh event after hot reloading.
    registerHMRRefresh();
</script>


<svg bind:this={div} width='100%' height='100%'>
    {#each svgHandles as handle}
        <Handle href='#projectorHandle' inst={handle} scale=3 />
    {/each}
</svg>


<style>
    svg {
        flex: 1 1 0px;
        overflow: visible;
    }
</style>
