import { readImageFromFile, readImageFromUrl } from './image_utils.mjs';
import { Vec2 } from './maths.mjs';


const actions = {};


actions.set = (scene, {state}) => {
    return state;
};


actions.setEditMode = (scene, {editMode}) => {
    return {
        ...scene,
        editMode,
    };
};


actions.updateCanvas = (scene, {props}) => {
    return {
        ...scene,
        canvas: {...scene.canvas, ...props},
    };
};


actions.addLayer = (scene, {layer}) => {
    return {
        ...scene,
        layers: [...scene.layers, layer],
        nextLayerId: layer.id+1,
    };
};


actions.addLayerByDataURL = (
        scene,
        {dataUrl, thumbnailImage=null, width, height, uvMatrix},
) => {
    const canvasSize = scene.canvas.size;
    const scale = Math.min(
        canvasSize.x / width,
        canvasSize.y / height,
    );

    const layer = {
        id: scene.nextLayerId,
        image: dataUrl,
        thumbnailImage: thumbnailImage || dataUrl,
        uvMatrix,
        size: new Vec2(width, height),
        scale: new Vec2(scale, scale),
        rotation: 0,
        translation: new Vec2(0, 0),
        opacity: 1,

        selected: true,
    };

    return actions.addLayer(actions.selectLayer(scene, {layer: null}), {layer});
};


actions.selectLayer = (scene, {layer}) => {
    return {
        ...scene,
        canvas: {
            ...scene.canvas,
            selected: layer === scene.canvas,
        },
        layers: scene.layers.map((l) => {
            return {
                ...l,
                selected: l === layer,
            };
        }),
    };
};


actions.updateLayer = (scene, action) => {
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
};


actions.reorderLayers = (scene, {layers}) => {
    return {
        ...scene,
        layers,
    };
}


export function sceneReducer(scene, action) {
    return actions[action.type](scene, action);
}
