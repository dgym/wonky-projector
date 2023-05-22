import { useReducer } from 'react';


export function useUndoReducer(reducer, initialState, options={}) {
    const {ignore=[]} = options;

    const undoState = {
        past: [],
        present: initialState,
        future: [],
        lastBatchToken: undefined,
    };

    const undoReducer = (state, action) => {
        if (action.type === 'history:undo') {
            const [newPresent, ...past] = state.past;
            return {
                past,
                present: newPresent,
                future: [state.present, ...state.future],
                lastBatchToken: undefined,
            };
        }
        if (action.type === 'history:redo') {
            const [newPresent, ...future] = state.future;
            return {
                past: [state.present, ...state.past],
                present: newPresent,
                future,
                lastBatchToken: undefined,
            };
        }
        if (action.type === 'history:finishBatch') {
            return {
                ...state,
                lastBatchToken: undefined,
            };
        }

        const newPresent = reducer(state.present, action);

        const replace = ignore.includes(action.type) ||
            (action.historyBatchToken != undefined &&
                action.historyBatchToken === state.lastBatchToken);

        if (replace) {
            return {
                past: state.past,
                present: newPresent,
                future: state.future,
                lastBatchToken: action.historyBatchToken,
            };
        }
        return {
            past: [state.present, ...state.past],
            present: newPresent,
            future: [],
            lastBatchToken: action.historyBatchToken,
        };
    };

    return useReducer(undoReducer, undoState);
};
