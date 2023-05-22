import { createElement, useRef } from 'react';

import {readImageFromFile} from './image_utils.mjs';

const e = createElement;


function CommonButtons(props) {
    const { history, updateScene } = props;

    const fileRef = useRef(null);

    return [
        e('span',
            {
                className: 'input',
                key: 'open',
            },
            e('input',
                {
                    ref: fileRef,
                    className: 'hidden-file',
                    type: 'file',
                    accept: 'image/*',
                    multiple: true,
                    onChange(event) {
                        const files = fileRef.current && fileRef.current.files;
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
                }
            ),
            e('span',
                {
                    className: 'button',
                    onClick: (event) => {
                        if (fileRef.current) {
                            fileRef.current.click();
                        }
                    }
                },
                'open',
            ),
        ),
        e('span',
            {
                className: 'input',
                key: 'history',
            },
            e('span',
                {
                    className: 'button',
                    disabled: history.past.length == 0,
                    onClick: (event) => {
                        if (history.past.length == 0) return;
                        updateScene({type: 'history:undo'});
                    }
                },
                'undo',
            ),
            e('span',
                {
                    className: 'button',
                    disabled: history.future.length == 0,
                    onClick: (event) => {
                        if (history.future.length == 0) return;
                        updateScene({type: 'history:redo'});
                    }
                },
                'redo',
            ),
        ),
    ];
}


function CanvasToolbar(props) {
    const {history, updateScene} = props;
    const scene = history.present;
    const canvas = scene.canvas;

    const updateCanvas = (layer, props, token) => {
        updateScene({
            type: 'updateCanvas',
            layer: layer, props: props,
            historyBatchToken: token && ('CanvasToolbar:' + token),
        });
    };

    const NumberInput = (props) => {
        const {onChange} = props;
        return e('input',
            {
                type: 'number',
                onBlur: (event) => {
                    updateScene({type: 'history:finishBatch'});
                },
                ...props,
                onChange: (event) => {
                    const v = parseFloat(event.target.value);
                    if (isNaN(v)) return;
                    onChange(event, v);
                },
            },
        );
    };

    return e('div',
        {
            className: 'toolbar',
            key: 'CanvasToolbar',
        },
        e(CommonButtons, props),
        e('span',
            {
                className: 'input',
            },
            'size',
            NumberInput(
                {
                    value: canvas.size.x,
                    onChange: (event, v) => {
                        updateCanvas(canvas, {
                            size: canvas.size.clone().setX(Math.max(v, 1)),
                        }, 'size.x');
                    }
                },
            ),
            NumberInput(
                {
                    value: canvas.size.y,
                    onChange: (event, v) => {
                        updateCanvas(canvas, {
                            size: canvas.size.clone().setY(Math.max(v, 1)),
                        }, 'size.y');
                    }
                },
            ),
        ),
    );
}


function LayerToolbar(props) {
    const {history, updateScene} = props;
    const scene = history.present;
    const {editMode, layers} = scene;
    const selected = layers.find((l) => l.selected);
    const item = selected ? selected : null;
    const idx = layers.indexOf(selected);
    const canLower = item && idx >= 1;
    const canRaise = item && idx < (layers.length - 1);

    const reorderLayers = (layers) =>
        updateScene({type: 'reorderLayers', layers: layers});

    const updateLayer = (layer, props, token) => {
        updateScene({
            type: 'updateLayer',
            layer: layer,
            props: props,
            historyBatchToken: token && ('LayerToolbar:' + token),
        });
    };

    const NumberInput = (props) => {
        const {onChange} = props;
        return e('input',
            {
                type: 'number',
                disabled: item === null,
                onBlur: (event) => {
                    updateScene({type: 'history:finishBatch'});
                },
                ...props,
                onChange: (event) => {
                    const v = parseFloat(event.target.value);
                    if (isNaN(v)) return;
                    onChange(event, v);
                },
            },
        );
    };

    return e('div',
        {
            className: 'toolbar',
            key: 'LayerToolbar',
        },
        e(CommonButtons, props),
        e('span',
            {
                className: `input ${item ? "" : "disabled"}`,
            },
            e('span', {className: 'label'}, 'tool'),
            e('span',
                {
                    className: `button ${editMode == 'move' ? 'toggled' : ''}`,
                    disabled: !item,
                    onClick: (event) => {
                        if (!item) return;
                        updateScene({
                            type: 'setEditMode',
                            editMode: editMode == 'move' ? '' : 'move',
                        });
                    }
                },
                'pos',
            ),
            e('span',
                {
                    className: `button ${editMode == 'scale' ? 'toggled' : ''}`,
                    disabled: !item,
                    onClick: (event) => {
                        if (!item) return;
                        updateScene({
                            type: 'setEditMode',
                            editMode: editMode == 'scale' ? '' : 'scale',
                        });
                    }
                },
                'scale',
            ),
            e('span',
                {
                    className: `button ${editMode == 'rotate' ? 'toggled' : ''}`,
                    disabled: !item,
                    onClick: (event) => {
                        if (!item) return;
                        updateScene({
                            type: 'setEditMode',
                            editMode: editMode == 'rotate' ? '' : 'rotate',
                        });
                    }
                },
                'rot',
            ),
        ),
        e('span',
            {
                className: `input ${item ? "" : "disabled"}`,
            },
            e('span', {className: 'label'}, 'opacity'),
            e('input',
                {
                    type: 'range',
                    min: '0',
                    max: '100',
                    value: item ? item.opacity * 100 : 0,
                    disabled: item === null,
                    onMouseUp: (event) => {
                        updateScene({type: 'history:finishBatch'});
                    },
                    onChange: (event) => {
                        const v = parseFloat(event.target.value);
                        if (isNaN(v)) return;
                        updateLayer(item, {
                            opacity: v / 100,
                        }, 'opacity');
                    }
                },
            ),
        ),
        e('span',
            {
                className: `input ${item ? "" : "disabled"}`,
            },
            e('span', {className: 'label'}, 'order'),
            e('span',
                {
                    className: 'button',
                    disabled: !canLower,
                    onClick: (event) => {
                        if (!canLower) return;
                        const newLayers = [...layers];
                        newLayers.splice(
                            idx-1, 2, item, layers[idx-1],
                        );
                        reorderLayers(newLayers);
                    }
                },
                '\u25b4',
            ),
            e('span',
                {
                    className: 'button',
                    disabled: !canRaise,
                    onClick: (event) => {
                        if (!canRaise) return;
                        const newLayers = [...layers];
                        newLayers.splice(
                            idx, 2, layers[idx+1], item,
                        );
                        reorderLayers(newLayers);
                    }
                },
                '\u25be',
            ),
        ),
        //e('span',
        //    {},
        //    e('span',
        //        {
        //            className: 'button',
        //            onClick: (event) => {
        //                document.execCommand('paste');
        //            }
        //        },
        //        'paste',
        //    ),
        //),
        e('span',
            {
                className: `input ${item ? "" : "disabled"}`,
            },
            e('span',
                {
                    className: 'button',
                    disabled: !item,
                    onClick: (event) => {
                        if (!item) return;
                        const newLayers = [...layers];
                        newLayers.splice(
                            idx, 1,
                        );
                        reorderLayers(newLayers);
                    }
                },
                'delete',
            ),
        ),
    );
}


export function Toolbar(props) {
    const {history, updateScene} = props;
    const scene = history.present;

    if (scene.canvas.selected) {
        return CanvasToolbar(props);
    } else {
        return LayerToolbar(props);
    }
}
