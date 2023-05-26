<script>
    export let scene;
    export let updateScene;

    export function setScene(s) {
        scene = s;
    }

    function select(event, item) {
        event.stopPropagation();
        updateScene({
            type: 'selectLayer',
            layer: item && item.selected ? null : item,
        });
    }
</script>


<div class='layer-list'
        on:click={(event) => select(event, null)}
        on:keydown={(event) => {if (event.key === 'Enter') select(event, null)}}>
    <button class='layer-list-item{scene.canvas.selected ? " selected" : ""}'
        on:click={(event) => select(event, scene.canvas)}>
        <img class='thumbnail' alt='projector' src='{scene.canvas.thumbnailImage}'>
    </button>
    {#each scene.layers as layer}
        <button class='layer-list-item{layer.selected ? " selected" : ""}'
            on:click={(event) => select(event, layer)}>
            <img class='thumbnail' alt='layer {layer.id}' src='{layer.thumbnailImage}'>
        </button>
    {/each}
</div>
