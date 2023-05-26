<script>
    import { onMount } from 'svelte';

    import { Vec2, Vec3, Mat3, Mat4, clamp, getPerspectiveModelMatrix } from './maths.mjs';
    import { ProjectorRenderer } from './renderer.mjs';
    import { default as Handle, HandleInst } from './handle.svelte';
    import {
        ProjectionHandle,
        MoveCenterHandle, MoveAxisHandle,
        ScaleHandle,
        RotateHandle,
    } from './projector_handles.mjs';

    export let rect;
    export let projection, scene;
    export let updateProjection, updateScene;

    let matrix = new Mat3();
    let invMatrix = new Mat3();

    // projectorMatrix maps a point from gl coordinates to
    // the projector.
    let projectorMatrix3 = new Mat3();
    let projectorMatrix4 = new Mat4();
    let invProjectorMatrix3 = new Mat3();

    let canvas2camera = new Mat3();
    let camera2canvas = new Mat3();

    $: ({canvas, editMode} = scene);
    $: canvasSize = canvas.size;
    $: selected = scene.layers.find((l) => l.selected);

    // matrix maps a point from gl coordinates to the viewport.
    $: {
        matrix = matrix.set(
            rect.width*0.5, 0, 0,
            0, -rect.height*0.5, 0,
            rect.width*0.5, rect.height*0.5, 1,
        );
        invMatrix = invMatrix.copy(matrix).inverse();

        const w2 = canvasSize.x * 0.5;
        const h2 = canvasSize.y * 0.5;
        getPerspectiveModelMatrix(projectorMatrix3, projectorMatrix4,
            new Vec2(-w2,  h2),
            new Vec2( w2,  h2),
            new Vec2( w2, -h2),
            new Vec2(-w2, -h2),
            ...projection.handles,
        );
        projectorMatrix3 = projectorMatrix3;
        projectorMatrix4 = projectorMatrix4;
        invProjectorMatrix3 = invProjectorMatrix3.copy(projectorMatrix3).inverse();

        canvas2camera = canvas2camera.copy(matrix).multiply(projectorMatrix3);
        camera2canvas = camera2canvas.copy(canvas2camera).inverse();
    }

    let render;
    let renderer = null;
    onMount(() => {
        renderer = new ProjectorRenderer(render);
    });

    $: if (renderer) {
        renderer.render({
            canvas,
            layers: scene.layers,
            matrix: projectorMatrix4,
            rect,
        });
    }

    let projectorHandles = [...Array(4).keys()].map((idx) =>
        new ProjectionHandle({idx})
    );
    $: {
        const props = {
            projection, updateProjection,
            matrix, invMatrix, viewportRect: rect,
        };
        projectorHandles = projectorHandles.map((handle) => handle.update(props));
    }

    let moveCenterHandle = new MoveCenterHandle({pos: new Vec2(0, 0)});
    let moveAxisHandles = [...Array(4).keys()].map((axis) => new MoveAxisHandle({axis}));
    let scaleHandles = [...Array(3).keys()].map((axis) => new ScaleHandle({axis}));
    let rotateHandles = [
        new HandleInst({pos: new Vec2(0, 0)}),
        new RotateHandle(),
    ];
    $: {
        const props = {
            layer: selected,
            viewportRect: rect,
            matrix,
            invMatrix,
            updateScene,
        };
        const moveProps = { ...props, invMatrix: camera2canvas };
        moveCenterHandle = moveCenterHandle.update(moveProps);
        moveAxisHandles = moveAxisHandles.map((handle) => handle.update(moveProps));
        scaleHandles = scaleHandles.map((handle) => handle.update(props));
        rotateHandles = rotateHandles.map((handle) => handle.update(props));
    }
</script>


<div class='overlay'>
    <div bind:this={render} class='render' />
    <svg class='handles'>
        {#if scene.canvas.selected}
            {#each projectorHandles as handle}
                <Handle href='#projectorHandle' inst={handle} scale=3 />
            {/each}
        {:else if selected && editMode === 'move'}
            <Handle href='#moveOmniHandle' inst={moveCenterHandle} scale=3 />
            {#each moveAxisHandles as handle}
                <Handle href='#moveHorizHandle' inst={handle} scale=3 rotate={handle.axis*-90} />
            {/each}
        {:else if selected && editMode === 'scale'}
            {#each scaleHandles as handle}
                <Handle href='#scaleHorizHandle' inst={handle} scale=3 rotate={handle.axis*-45} />
            {/each}
        {:else if selected && editMode === 'rotate'}
            <Handle href='#blankHandle' inst={rotateHandles[0]} scale=3 />
            <Handle href='#rotateHandle' inst={rotateHandles[1]} scale=3 />
        {/if}
    </svg>
</div>
