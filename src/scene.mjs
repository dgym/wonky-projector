import { readImageFromFile, readImageFromUrl } from './image_utils.mjs';
import { Vec2 } from './maths.mjs';


export function sceneReducer(scene, action) {
    const addLayer = (scene, layer) => {
        return {
            ...scene,
            layers: [...scene.layers, layer],
            nextLayerId: layer.id+1,
        };
    }

    const addLayerByDataURL = (scene, dataUrl, width, height) => {
        const canvasSize = scene.canvas.size;
        const scale = Math.min(
            canvasSize.x / width,
            canvasSize.y / height,
        );

        const layer = {
            id: scene.nextLayerId,
            image: dataUrl,
            thumbnailImage: dataUrl,
            size: new Vec2(width, height),
            scale: new Vec2(scale, scale),
            rotation: 0,
            translation: new Vec2(0, 0),
            opacity: 1,

            selected: true,
        };

        return addLayer(selectLayer(scene, null), layer);
    };

    const selectLayer = (scene, item) => {
        return {
            ...scene,
            canvas: {
                ...scene.canvas,
                selected: item === scene.canvas,
            },
            layers: scene.layers.map((layer) => {
                return {
                    ...layer,
                    selected: item === layer,
                };
            }),
        };
    };

    switch (action.type) {
        case 'set':
            return action.state;
        case 'setEditMode':
            return {
                ...scene,
                editMode: action.editMode,
            };
        case 'updateCanvas':
            return {
                ...scene,
                canvas: {...scene.canvas, ...action.props},
            };
        case 'addLayer':
            return addLayer(scene, action.layer);
        case 'addLayerByDataURL':
            const {dataUrl, width, height} = action;
            return addLayerByDataURL(scene, dataUrl, width, height);
        case 'selectLayer':
            // Also used to select the canvas.
            return selectLayer(scene, action.layer);
        case 'updateLayer':
            return {
                ...scene,
                layers: scene.layers.map((layer) => {
                    if (action.layer === layer || action.layer == layer.id) {
                        return {
                            ...layer,
                            ...action.props,
                        };
                    }
                    return layer;
                }),
            };
        case 'reorderLayers':
            return {
                ...scene,
                layers: action.layers,
            };
        default:
            throw new Error();
    }
}
