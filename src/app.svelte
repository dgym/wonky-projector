<script>
    import { readImageFromFile, readImageFromUrl } from './image_utils.mjs';
    import { Vec2 } from './maths.mjs';
    import { sceneReducer } from './scene.mjs';
    import { undoReducer } from './undo_reducer.mjs';
    import LayerList from './layer_list.svelte';
    import Toolbar from './toolbar.svelte';
    import Composer from './composer.svelte';

    let [history, _updateScene] = undoReducer(
        sceneReducer,
        {
            editMode: null,
            canvas: {
                id: 0,
                size: new Vec2(60, 40),

                image: null,
                thumbnailImage: document
                    .querySelector('#projectorThumb')
                    .getAttribute('src'),
                selected: false,
            },
            layers: [
            ],
            nextLayerId: 1,
        },
        {
            ignore: ['selectLayer', 'setEditMode'],
        }
    );

    function updateScene(...args) {
        history = _updateScene(history, ...args);
    }

    const o = .95;
    let projection = {
        handles: [
            new Vec2(-o, o),
            new Vec2( o, o),
            new Vec2( o, -o),
            new Vec2(-o, -o),
        ],
    };

    function updateProjection(p) {
        projection = p;
    }

    async function addLayerBySourceURL(url) {
        const {dataUrl, width, height} = await readImageFromUrl(url);
        updateScene({
            type: 'addLayerByDataURL',
            dataUrl: dataUrl,
            width: width,
            height: height,
        });
    };

    $: scene = history.present;

    // Load the canvas images.
    const projectorBg = document
        .querySelector('#projectorBg')
        .getAttribute('src');
    readImageFromUrl(projectorBg).then((image) => {
        updateScene({
            type: 'updateCanvas',
            props: {image: image.dataUrl},
            noHistory: true,
        });
    });
    if (new URLSearchParams(window.location.search).has('example')) {
        addLayerBySourceURL('../assets/test-1024x512.svg');
    }

    // Set up image paste handling.
    function onPaste(event) {
        const items = (event.clipboardData || event.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.kind === 'file') {
                readImageFromFile(item.getAsFile()).then((results) => {
                    updateScene({
                        type: 'addLayerByDataURL',
                        ...results,
                    });
                });
            }
        }
    };
</script>


<div class='editor' on:paste={onPaste}>
    <Toolbar {history} {updateScene} />
    <LayerList {scene} {updateScene} />
    <Composer {scene} {projection} {updateScene} {updateProjection} />
</div>
