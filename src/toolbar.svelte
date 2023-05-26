<script>
    import { readImageFromFile } from './image_utils.mjs';

    export let history;
    export let updateScene;

    export function setHistory(h) {
        history = h;
    }

    $: scene = history.present;
    $: ({canvas, editMode, layers} = scene);
    $: canvasSizeX = canvas.size.x;
    $: canvasSizeY = canvas.size.y;
    $: selected = layers.find((l) => l.selected);
    $: item = selected ? selected : null;
    $: idx = layers.indexOf(selected);
    $: canLower = item && idx >= 1;
    $: canRaise = item && idx < (layers.length - 1);

    function updateLayer(layer, props, token) {
        updateScene({
            type: 'updateLayer',
            layer: layer,
            props: props,
            historyBatchToken: token && ('LayerToolbar:' + token),
        });
    };

    let openElement;
    function open(event) {
        const files = openElement.files;
        if (files && files.length) {
            for (const file of files) {
                readImageFromFile(file).then((results) => {
                    updateScene({
                        type: 'addLayerByDataURL',
                        ...results,
                    });
                });
            }
        }
    }

    function undo() {
        updateScene({type: 'history:undo'});
    }

    function redo() {
        updateScene({type: 'history:redo'});
    }

    function resizeCanvas(token) {
        updateScene({
            type: 'updateCanvas',
            props: {
                size: canvas.size.clone().set(canvasSizeX, canvasSizeY),
            },
            historyBatchToken: token,
        });
    }

    function selectMode(mode) {
        updateScene({
            type: 'setEditMode',
            editMode: editMode == mode ? '' : mode,
        });
    }

    function setOpacity(value) {
        updateLayer(item, {
            opacity: parseFloat(value) / 100,
        }, 'opacity');
    }

    function lower() {
        const newLayers = [...layers];
        newLayers.splice(
            idx-1, 2, item, layers[idx-1],
        );
        updateScene({type: 'reorderLayers', layers: newLayers});
    }

    function raise() {
        const newLayers = [...layers];
        newLayers.splice(
            idx, 2, layers[idx+1], item,
        );
        updateScene({type: 'reorderLayers', layers: newLayers});
    }

    function remove() {
        const newLayers = [...layers];
        newLayers.splice(idx, 1);
        updateScene({type: 'reorderLayers', layers: newLayers});
    }
</script>


<div class='toolbar'>
    <span class='input'>
        <input bind:this={openElement} class='hidden-file' type='file' accept='image/*' on:change={open}>
        <button class='button' on:click={openElement.click()}>open</button>
    </span>
    <span class='input'>
        <button class='button' disabled='{history.past.length == 0}' on:click={undo}>undo</button>
        <button class='button' disabled='{history.future.length == 0}' on:click={redo}>redo</button>
    </span>

    {#if canvas.selected}
        <span class='input'>
            <span class='label'>size</span>
            <input type='number'
                    bind:value={canvasSizeX}
                    on:input={() => resizeCanvas('size.x')}
                    on:blur={() => updateScene({type: 'history:finishBatch'})}>
            <input type='number'
                    bind:value={canvasSizeY}
                    on:input={() => resizeCanvas('size.y')}
                    on:blur={() => updateScene({type: 'history:finishBatch'})}>
        </span>
    {:else}
        <span class='input{item ? "" : " disabled"}'>
            <span class='label'>tool</span>
            <button class='button{editMode == 'move' ? ' toggled' : ' '}'
                    disabled='{!selected}'
                    on:click={() => selectMode('move')}>
                pos
            </button>
            <button class='button{editMode == 'scale' ? ' toggled' : ' '}'
                    disabled='{!selected}'
                    on:click={() => selectMode('scale')}>
                scale
            </button>
            <button class='button{editMode == 'rotate' ? ' toggled' : ' '}'
                    disabled='{!selected}'
                    on:click={() => selectMode('rotate')}>
                rot
            </button>
        </span>
        <span class='input{item ? "" : " disabled"}'>
            <span class='label'>opacity</span>
            <input type='range' min='0' max='100' value='{item ? item.opacity * 100 : 100}'
                    on:input={(event) => setOpacity(event.target.value)}
                    on:change={() => updateScene({type: 'history:finishBatch'})}>
        </span>
        <span class='input{item ? "" : " disabled"}'>
            <span class='label'>order</span>
            <button class='button' disabled='{!canLower}' on:click={lower}>&#x25b4;</button>
            <button class='button' disabled='{!canRaise}' on:click={raise}>&#x25be;</button>
        </span>
        <span class='input{item ? "" : " disabled"}'>
            <button class='button' disabled='{!item}' on:click={remove}>delete</button>
        </span>
    {/if}
</div>
