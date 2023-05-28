import { Vec2, Mat3, getPerspectiveModelMatrix } from '../maths.mjs';


const perspective = {
    type: 'perspective',
    handles: [
        new Vec2(0, 0),
        new Vec2(1, 0),
        new Vec2(0, 1),
        new Vec2(1, 1),
    ],
    uvMatrix: new Mat3(),
};


const actions = {};


actions.init = (state) => {
    return {
        items: [],
    };
};


actions.add = (state, {dataUrl, width, height}) => {
    return {
        ...state,
        items: [
            ...state.items,
            {
                dataUrl, width, height,
                modifiers: [],
                currentModifier: -1,
            },
        ],
    };
};


actions.done = (state) => {
    if (!state.items) {
        return state;
    }
    const items = [...state.items];
    items.shift();
    return { ...state, items };
};


actions.popModifier = (state) => {
    if (!state.items) {
        return state;
    }
    const items = [...state.items];
    const item = items[0];
    if (!item.modifiers) {
        return state;
    }
    const modifiers = [...item.modifiers];
    modifiers.pop();
    items[0] = {
        ...items[0],
        modifiers,
        currentModifier: modifiers.length - 1,
    }
    return { ...state, items };
};


actions.addPerspectiveModifier = (state) => {
    const items = [...state.items];
    if (items) {
        const modifiers = [
            ...items[0].modifiers,
            perspective,
        ];
        items[0] = {
            ...items[0],
            modifiers,
            currentModifier: modifiers.length - 1,
        }
    }
    return { ...state, items };
};


actions.setPerspectiveHandles = (state, {handles}) => {
    if (!state.items) {
        return state;
    }
    const items = [...state.items];
    const item = items[0];
    if (item.currentModifier < 0 ||
            item.currentModifier >= item.modifiers.length) {
        return state;
    }
    const modifier = item.modifiers[item.currentModifier];
    if (modifier.type !== 'perspective') {
        return state;
    }
    const uvMatrix = new Mat3();
    getPerspectiveModelMatrix(uvMatrix, null,
        new Vec2(0, 0),
        new Vec2(1, 0),
        new Vec2(0, 1),
        new Vec2(1, 1),
        ...handles,
    );
    const modifiers = [
        ...item.modifiers,
    ];
    modifiers[item.currentModifier] = {
        ...modifier,
        handles,
        uvMatrix,
    };
    items[0] = {
        ...items[0],
        modifiers,
    }
    return { ...state, items };
};


export function imageImportReducer(state, action) {
    return actions[action.type](state, action);
}
