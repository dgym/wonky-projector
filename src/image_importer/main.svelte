<script context='module'>
    let redrawCallback = null;
    function redraw(callback) {
        if (!redrawCallback) {
            requestAnimationFrame(() => {
                const current = redrawCallback;
                redrawCallback = null;
                current();
            });
        }

        redrawCallback = callback;
    }
</script>


<script>
    import { Renderer, Camera, Transform } from 'ogl';
    import { onMount } from 'svelte';

    import { Mat3 } from '../maths.mjs';
    import PerspectiveModifier from './modifiers/perspective/main.svelte';
    import Result from './result.svelte';
    import { TextureZProgram, loadTexture } from '../renderer.mjs';

    export let imageImports, updateImageImports, updateScene;

    let canvas, perspectiveModifier, result;
    let renderer, gl, camera, texture, program;
    let rect = {top: 0, left: 0, width: 1, height: 1};

    $: current = imageImports.items[0];
    $: modifier = current && current.currentModifier >= 0 ?
        current.modifiers[current.currentModifier] : null;
    $: modifierType = modifier ? modifier.type : null;

    onMount(() => {
        renderer = new Renderer({depth: false, canvas: canvas});
        gl = renderer.gl;
        camera = new Camera(gl);
        camera.orthographic(-1, 1, 1, -1, 1, 100);
        camera.position.z = 5;
        program = new TextureZProgram(gl, null, {
            depthTest: false,
            depthWrite: false,
        });

        const ro = new ResizeObserver(entries => {
            const newRect = canvas.parentElement.getBoundingClientRect();
            if (newRect.top !== rect.top ||
                    newRect.left !== rect.left ||
                    newRect.width !== rect.width ||
                    newRect.height !== rect.height) {
                rect = newRect;
            }
        });
        ro.observe(canvas.parentElement);

        return () => {
            ro.unobserve(canvas.parentElement);
            program.remove();
        };
    });

    function render() {
        if (!renderer) {
            return;
        }

        if (current && !texture) {
            texture = loadTexture(gl, current.dataUrl, () => {
                texture = texture;
            }, {flipY: false});
        }

        const { width: vw, height: vh } = rect;

        if (current && vw && vh && texture) {
            const { width: iw, height: ih } = current;

            redraw(() => {
                if (!(current && vw && vh && texture)) {
                    return;
                }

                //console.log('redraw', vw, vh);
                program.uniforms.tMap.value = texture;

                renderer.setSize(vw, vh);
                gl.enable(gl.SCISSOR_TEST);

                gl.viewport(0, 0, vw, vh);
                gl.scissor(0, 0, vw, vh);
                gl.clearColor(0x44/255, 0x66/255, 0x88/255, 1.0);
                renderer.render({scene: new Transform(), camera, sort: false});

                const uvMatrix = getUvMatrix(current.currentModifier);

                let comp = result;
                if (modifierType === 'perspective') {
                    comp = perspectiveModifier;
                }

                if (comp) {
                    comp.render({
                        renderer, camera,
                        imageSize: [iw, ih],
                        uvMatrix,
                        modifier: modifier,
                    });
                }
            });
        }
    }

    function getUvMatrix(end) {
        const uvMatrix = new Mat3();
        for (let idx=0; idx<end; ++idx) {
            uvMatrix.multiply(current.modifiers[idx].uvMatrix);
        }
        return uvMatrix;
    }

    function addPerspective() {
        updateImageImports({type: 'addPerspectiveModifier'});
    }

    function back() {
        updateImageImports({type: 'popModifier'});
    }

    function done() {
        const { width, height, dataUrl } = current;
        const uvMatrix = getUvMatrix(current.currentModifier+1);
        updateImageImports({type: 'done'});
        updateScene({
            type: 'addLayerByDataURL',
            dataUrl, width, height,
            uvMatrix,
        });
        if (texture) {
            gl.deleteTexture(texture.texture);
            texture = null;
        }
    }

    $: render(current, rect, texture)
</script>


<div class='popup{imageImports.items.length !== 0 ? " active" : ""}'>
    <div class='image-importer'>
        <h1>Import Image</h1>
        <div class='canvas-holder'>
            <canvas bind:this={canvas}></canvas>
            <div>
                {#if modifierType == 'perspective'}
                    <PerspectiveModifier on:refresh={render}
                            bind:this={perspectiveModifier}
                            {gl} {program}
                            handles={modifier.handles}
                            {updateImageImports} />
                {:else}
                    <Result on:refresh={render}
                            bind:this={result} {gl} {program} />
                {/if}
            </div>
        </div>
        <div class='button-bar'>
            {#if modifierType == 'perspective'}
                <span>
                </span>
                <button class='button' on:click={back}>Back</button>
            {:else}
                <span>
                </span>
                <button class='button' on:click={addPerspective}>Correct Perspective</button>
            {/if}
            <button class='button' on:click={done}>Done</button>
        </div>
    </div>
</div>


<style>
    .image-importer {
        margin: 1em;
        border-radius: 1em;
        border: 2px solid white;
        padding: 0.5em;
        display: flex;
        flex-direction: column;
        place-items: stretch;
        gap: 1em;
    }

    h1 {
        all: unset;
        font-weight: bold;
        text-align: center;
    }

    .canvas-holder {
        flex: 1;
        display: grid;
        grid-template-columns: 1fr;
        grid-template-rows: 1fr;
    }

    .canvas-holder > * {
        grid-area: 1 / 1;

        display: flex;
        place-items: stretch;
    }

    .canvas-holder > *:nth-child(2) {
        z-index: 0;
    }

    .button-bar {
        display: flex;
        align-items: center;
    }

    .button-bar span {
        flex: 1;
    }
</style>
