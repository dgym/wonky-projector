<script>
    import { onMount } from 'svelte';

    import { readImageFromFile, readImageFromUrl } from './image_utils.mjs';
    import { Vec2 } from './maths.mjs';
    import { sceneReducer } from './scene.mjs';
    import { undoReducer } from './undo_reducer.mjs';
    import Composer from './composer.svelte';
    import ImageImporter from './image_importer/main.svelte';
    import { imageImportReducer } from './image_importer/model.mjs';
    import LayerList from './layer_list.svelte';
    import Toolbar from './toolbar.svelte';

    let [history, _updateScene] = undoReducer(
        sceneReducer,
        {
            editMode: null,
            canvas: {
                id: 0,
                size: new Vec2(60, 40),

                image: null,
                thumbnailImage: null,
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

    let imageImports = imageImportReducer(null, {type: 'init'});
    function updateImageImports(action) {
        imageImports = imageImportReducer(imageImports, action);
    }

    async function addLayerBySourceURL(url, doImport=false) {
        const {dataUrl, width, height} = await readImageFromUrl(url);
        if (doImport) {
            updateImageImports({type: 'add', dataUrl, width, height});
        } else {
            updateScene({
                type: 'addLayerByDataURL',
                dataUrl,
                width,
                height,
                uvMatrix: null,
            });
        }
    };

    $: scene = history.present;

    // Load the canvas images.
    onMount(() => {
        const projectorThumb = document
            .querySelector('#projectorThumb')
            .getAttribute('src')
        const projectorBg = document
            .querySelector('#projectorBg')
            .getAttribute('src');
        readImageFromUrl(projectorBg).then((image) => {
            updateScene({
                type: 'updateCanvas',
                props: {
                    thumbnailImage: projectorThumb,
                    image: image.dataUrl,
                },
                noHistory: true,
            });
        });
    });

    onMount(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.has('example')) {
            addLayerBySourceURL('../assets/test-1024x512.svg', params.has('import'));
        }
    });

    // Set up image paste handling.
    function onPaste(event) {
        const items = (event.clipboardData || event.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.kind === 'file') {
                readImageFromFile(item.getAsFile()).then((results) => {
                    const {dataUrl, width, height} = results;
                    updateImageImports({type: 'add', dataUrl, width, height});
                });
            }
        }
    };
</script>


<div class='editor' on:paste={onPaste}>
    <Toolbar {history} {updateScene} {updateImageImports} />
    <LayerList {scene} {updateScene} />
    <Composer {scene} {projection} {updateScene} {updateProjection} />
    <ImageImporter {imageImports} {updateImageImports} {updateScene} />
</div>
