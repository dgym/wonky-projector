import { onMount, createEventDispatcher, tick } from 'svelte';

export function withViewport(gl, canvasRect, viewportRect, callback) {
    const inner = [
        viewportRect.left - canvasRect.left,
        viewportRect.top - canvasRect.top,
        viewportRect.width, viewportRect.height
    ];
    gl.viewport(...inner);
    gl.scissor(...inner);

    callback();

    const outer = [
        0, 0,
        canvasRect.width, canvasRect.height
    ];
    gl.viewport(...outer);
    gl.scissor(...outer);
}


export function registerHMRRefresh() {
    // Send a refresh event after hot reloading.
    const dispatch = createEventDispatcher();

    async function refresh() {
        await tick();
        dispatch('refresh', null);
    }

    onMount(refresh);
}


export function registerResizeObserver(el, callback) {
    onMount(() => {
        let rect = el.getBoundingClientRect();

        const ro = new ResizeObserver(entries => {
            const newRect = canvas.parentElement.getBoundingClientRect();
            if (newRect.top !== rect.top ||
                    newRect.left !== rect.left ||
                    newRect.width !== rect.width ||
                    newRect.height !== rect.height) {
                rect = newRect;
                callback(rect);
            }
        });

        ro.observe(el);

        return () => {
            ro.unobserve(el);
        };
    });
}
