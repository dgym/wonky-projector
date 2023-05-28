<script>
    import { Mat3 } from '../../../maths.mjs';
    import Editor from './editor.svelte';
    import Result from '../../result.svelte';

    export let gl;
    export let program;
    export let handles;
    export let updateImageImports;

    let result, perspectiveHandles;

    export function render(props) {
        if (perspectiveHandles) {
            perspectiveHandles.render(props);
        }
        if (result) {
            const uvMatrix = new Mat3()
                .copy(props.uvMatrix)
                .multiply(props.modifier.uvMatrix);
            result.render({
                ...props,
                uvMatrix,
            });
        }
    }
</script>


<div class='stretch'>
    <div class='stretch'>
        <Editor on:refresh
                bind:this={perspectiveHandles}
                {gl} {program}
                {handles}
                {updateImageImports} />
    </div>
    <span class='arrow'>&#x25b6</span>
    <div class='stretch'>
        <Result on:refresh bind:this={result} {gl} {program} />
    </div>
</div>


<style>
    .arrow {
        padding: 1em;
        align-self: center;
    }

    .stretch {
        flex: 1 1 0px;
        display: flex;
        place-items: stretch;
    }
</style>
