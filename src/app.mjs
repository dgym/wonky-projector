import { useState, createElement, useRef, useEffect, useReducer, useId } from 'react';
import * as THREE from 'three';

import {readImageFromFile, readImageFromUrl} from './image_utils.mjs';
import {LayerList} from './layer_list.mjs';
import {Toolbar} from './toolbar.mjs';
import {useUndoReducer} from './use_undo_reducer.mjs';


const e = createElement;
const Mat3 = THREE.Matrix3;
const Mat4 = THREE.Matrix4;
const textureLoader = new THREE.TextureLoader();
const Vec2 = THREE.Vector2;
const Vec3 = THREE.Vector3;


function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}


const getPerspectiveModelMatrix = (mat3, mat4, sa, sb, sc, sd, da, db, dc, dd) => {
    const basisToPoints = (p1, p2, p3, p4) => {
        const m = new Mat3();
        m.set(
            p1.x, p2.x, p3.x,
            p1.y, p2.y, p3.y,
            1,  1,  1
        );
        const v = new Vec3(p4.x, p4.y, 1).applyMatrix3(m.clone().invert());
        const t = new Mat3();
        t.set(
            v.x, 0, 0,
            0, v.y, 0,
            0, 0, v.z,
        );
        return m.multiply(t);
    };

    const s = basisToPoints(sa, sb, sc, sd);
    const d = basisToPoints(da, db, dc, dd);
    d.multiply(s.invert());
    d.multiplyScalar(1/d.elements[8]);

    mat3.copy(d);

    // Convert to a Mat4.
    const e = d.elements;
    mat4.fromArray([
        e[0], e[1], 0, e[2],
        e[3], e[4], 0, e[5],
        0   , 0   , 1, 0   ,
        e[6], e[7], 0, e[8]
    ]);
}


// Creates and renders a 3D scene.
const glReducer = (state, action) => {
    const actions = {};

    actions.create = () => {
        const scene = new THREE.Scene();

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 100);
        camera.position.z = 5;

        const renderer = new THREE.WebGLRenderer({depth: false});
        renderer.setClearColor(0, 0);
        renderer.outputEncoding = THREE.LinearEncoding;

        const root = new THREE.Object3D();
        root.matrixAutoUpdate = false;
        scene.add(root);

        const black = new THREE.MeshBasicMaterial({color: 0});
        black.depthTest = false;

        action.el.appendChild(renderer.domElement);
        return {
            scene: scene,
            root: root,
            camera: camera,
            renderer: renderer,
            materials: {
                black: black,
            },
        };
    };

    actions.render = () => {
        const {canvas, layers, matrix, rect} = action;

        // Resize the viewport.
        const {camera, renderer, scene, root} = state;
        renderer.setSize(rect.width, rect.height, true);

        // Clear the previous render.
        root.clear();

        // Set up the transformation matrix.
        root.matrix.copy(matrix);

        // Add the canvas layer.
        {
            if (canvas.image && !state.materials[canvas.id]) {
                const texture = textureLoader.load(canvas.image, actions.render);
                texture.magFilter = THREE.NearestFilter;
                const material = new THREE.MeshBasicMaterial({map: texture});
                material.depthTest = false;
                state.materials[canvas.id] = material;
            }
            const geometry = new THREE.PlaneGeometry(canvas.size.x, canvas.size.y);
            const ux = canvas.size.x > canvas.size.y ? 0.5 : (canvas.size.x / canvas.size.y * 0.5);
            const uy = canvas.size.y > canvas.size.x ? 0.5 : (canvas.size.y / canvas.size.x * 0.5);
            const uvs = new Float32Array([
                0.5-ux, 0.5+uy,
                0.5+ux, 0.5+uy,
                0.5-ux, 0.5-uy,
                0.5+ux, 0.5-uy,
            ]);
            geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

            // Use black if the canvas is not selected (or not loaded).
            const material = (canvas.selected && state.materials[canvas.id]) ?
                state.materials[canvas.id] :
                state.materials.black;
            const plane = new THREE.Mesh(geometry, material);
            root.add(plane);
        }

        // Add the layers
        for (const layer of layers) {
            if (!state.materials[layer.id]) {
                const texture = textureLoader.load(layer.image, actions.render);
                const material = new THREE.MeshBasicMaterial({map: texture, transparent: true});
                material.depthTest = false;
                state.materials[layer.id] = material;
            }
            const geometry = new THREE.PlaneGeometry(layer.size.x, layer.size.y);
            const material = state.materials[layer.id];
            const plane = new THREE.Mesh(geometry, material);
            plane.scale.x = layer.scale.x;
            plane.scale.y = layer.scale.y;
            plane.rotation.z = layer.rotation;
            plane.position.x = layer.translation.x;
            plane.position.y = layer.translation.y;
            material.opacity = Math.min(
                canvas.selected ? 0.4 : 1.0,
                layer.opacity,
            );
            root.add(plane);
        }

        requestAnimationFrame(() => {
            renderer.render(scene, camera);
        });        

        return state;
    };

    if (actions.hasOwnProperty(action.type)) {
        return actions[action.type]();
    }
    return state;
};


function HandleAdapter(props, component, componentProps) {
    const {
        origin, clampPoint=null, dragStart=null, dragMove=null, dragEnd=null,
        viewportRect=null, matrix=null, invMatrix=null,
    } = props;

    const pos = origin.clone();
    if (matrix) pos.applyMatrix3(matrix);
    const handle_sz = 8;

    const getMouse = (event) => {
        const mouse = new Vec3(event.clientX, event.clientY, 1);
        if (viewportRect) {
            mouse.x -= viewportRect.left;
            mouse.y -= viewportRect.top;
        }
        if (invMatrix) {
            mouse.applyMatrix3(invMatrix);
        }
        mouse.multiplyScalar(1/mouse.z);
        return new Vec2(mouse.x, mouse.y);
    };

    const mouseDown = (event) => {
        event.preventDefault();
        window.addEventListener("pointermove", mouseMove, false);
        window.addEventListener("pointerup", mouseUp, false);
        window.addEventListener("pointercancel", mouseUp, false);
        if (dragStart) {
            const point = getMouse(event);
            dragStart(point);
        }
        return false;
    };

    const mouseMove = (event) => {
        event.preventDefault();
        const point = getMouse(event);
        if (dragMove) {
            if (clampPoint) {
                clampPoint(point);
            }
            dragMove(point);
        }
        return false;
    };

    const mouseUp = (event) => {
        event.preventDefault();
        window.removeEventListener("pointermove", mouseMove, false);
        window.removeEventListener("pointerup", mouseUp, false);
        window.removeEventListener("pointercancel", mouseUp, false);
        if (dragEnd) {
            dragEnd();
        }
        return false;
    };

    return component({
        ...componentProps,
        pos: pos,
        onPointerDown: mouseDown,
    });
}


const UseHandle = (props)  => {
    const {href, pos, rotate} = props;
    const rtf = rotate ? ` rotate(${rotate})` : '';
    return e('use',
        {
            ...props,
            href: href,
            className: 'handle',
            transform: `translate(${pos.x} ${pos.y})${rtf} scale(3 3)`,
        }
    );
};


function ProjectorHandle(props) {
    const {handle, idx, projection, setProjection} = props;
    let start = null;

    const callbacks = {
        ...props,
        origin: handle,
        clampPoint: (point) => {
            point.x = clamp(point.x, -1, 1);
            point.y = clamp(point.y, -1, 1);
        },
        dragMove: (point) => {
            const handles = [...projection.handles];
            handles[idx] = point;
            setProjection({
                ...projection,
                handles: handles,
            });
        },
    };

    return HandleAdapter(callbacks, UseHandle, {
        href: '#projectorHandle',
    });
}


function ProjectorHandles(props) {
    const {handles} = props;

    return handles.map((handle, idx) => {
        return e(ProjectorHandle, {
            ...props,
            handle: handle,
            idx: idx,
            key: idx,
        });
    });
}


function MoveCenterHandle(props) {
    const {layer, element2canvas, updateScene} = props;
    let start = null;

    const callbacks = {
        ...props,
        invMatrix: element2canvas,
        dragStart: (point) => {
            start = point.clone().sub(layer.translation);
        },
        dragMove: (point) => {
            const newPos = point.clone().sub(start);
            updateScene({
                type: 'updateLayer',
                layer: layer.id,
                props: {translation: newPos},
                historyBatchToken: 'drag:position',
            });
        },
        dragEnd: () => updateScene({type: 'history:finishBatch'}),
    };

    return HandleAdapter(callbacks, UseHandle, {href: '#moveOmniHandle'});
};


function MoveAxisHandle(props) {
    const {axis, layer, viewportRect, element2canvas, updateScene} = props;
    const [vw, vh] = [viewportRect.width, viewportRect.height];
    const aspect = vw / vh;
    const origin = (new Vec2(vw < vh ? 0.5 : 0.5 / aspect, 0))
        .rotateAround(new Vec2(0, 0), Math.PI * 0.5 * axis);
    origin.setY(origin.y*aspect);

    let start = null;

    const callbacks = {
        ...props,
        invMatrix: element2canvas,
        origin: origin,
        dragStart: (point) => {
            start = point.clone().sub(layer.translation);
        },
        dragMove: (point) => {
            const newPos = point.clone().sub(start);
            if (axis & 1) {
                newPos.setX(layer.translation.x);
            } else {
                newPos.setY(layer.translation.y);
            }
            updateScene({
                type: 'updateLayer',
                layer: layer.id,
                props: {translation: newPos},
                historyBatchToken: 'drag:position',
            });
        },
        dragEnd: () => updateScene({type: 'history:finishBatch'}),
    };

    return HandleAdapter(callbacks, UseHandle, {
        href: '#moveHorizHandle',
        rotate: axis*-90,
    });
};


function MoveHandles(props) {
    const handleComponents = [];
    handleComponents.push(e(MoveCenterHandle, {
        ...props,
        key: 'center',
        origin: new Vec2(0, 0),
    }));
    for (let i=0; i<4; ++i) {
        handleComponents.push(e(MoveAxisHandle, {
            ...props,
            key: `axis${i}`,
            axis: i,
        }));
    }
    return handleComponents;
}


function ScaleHandle(props) {
    const {axis, layer, updateScene, viewportRect} = props;
    const [vw, vh] = [viewportRect.width, viewportRect.height];
    const aspect = vw / vh;
    const origin = (new Vec2(vw < vh ? 0.5 : 0.5 / aspect, 0))
        .rotateAround(new Vec2(0, 0), Math.PI * 0.25 * axis);
    origin.setY(origin.y*aspect);

    let start = null;
    let scale = null;

    const callbacks = {
        ...props,
        origin: origin,
        dragStart: (point) => {
            start = point.clone();
            scale = layer.scale.clone().multiplyScalar(1/point.length());
        },
        dragMove: (point) => {
            const newScale = scale.clone().multiplyScalar(
                point.length() * (start.dot(point) >= 0 ? 1 : -1)
            );
            if (axis == 0) {
                newScale.setY(layer.scale.y);
            } else if (axis == 2) {
                newScale.setX(layer.scale.x);
            }
            updateScene({
                type: 'updateLayer',
                layer: layer.id,
                props: {scale: newScale},
                historyBatchToken: 'drag:scale',
            });
        },
        dragEnd: () => updateScene({type: 'history:finishBatch'}),
    };

    return HandleAdapter(callbacks, UseHandle, {
        href: '#scaleHorizHandle',
        rotate: axis*-45,
    });
};


function ScaleHandles(props) {
    const {matrix} = props;

    const handleComponents = [
        e(UseHandle, {
            key: 'center',
            href: '#blankHandle',
            pos: new Vec2(0, 0).applyMatrix3(matrix),
        }),
    ];
    for (let i=0; i<3; ++i) {
        handleComponents.push(e(ScaleHandle, {
            ...props,
            key: `axis${i}`,
            axis: i,
        }));
    }
    return handleComponents;
}


function RotateHandle(props) {
    // Show and calculate rotations in element space
    const {
        layer, matrix, invMatrix, viewportRect,
        updateScene,
    } = props;
    const [vw, vh] = [viewportRect.width, viewportRect.height];
    const aspect = vw / vh;
    const center = new Vec2(0, 0).applyMatrix3(matrix);
    const origin = new Vec2(0, vh < vw ? -0.5 : -0.5 * aspect)
        .applyMatrix3(matrix)
        .rotateAround(center, -layer.rotation);

    let start = null;

    const callbacks = {
        ...props,
        matrix: null,
        invMatrix: null,
        origin: origin,
        dragMove: (point) => {
            point.sub(center);
            if (!(point.x || point.y)) return;
            updateScene({
                type: 'updateLayer',
                layer: layer.id,
                props: {rotation: (-point.angle() + Math.PI*0.5) % (Math.PI*2)},
                historyBatchToken: 'drag:rotate',
            });
        },
        dragEnd: () => updateScene({type: 'history:finishBatch'}),
    };

    const BlankHandle = (props)  => {
        const {pos} = props;
        return e('use',
            {
                ...props,
                href: '#blankHandle',
                className: 'handle',
                transform: `translate(${pos.x} ${pos.y}) scale(3 3)`,
            }
        );
    };

    return [
        e(UseHandle, {
            key: 'center',
            href: '#blankHandle',
            pos: new Vec2(0, 0).applyMatrix3(matrix),
        }),
        HandleAdapter(callbacks, UseHandle, {
            key: 'handle',
            href: '#rotateHandle',
        }),
    ];
};


function Projector(props) {
    const {
        rect, projection, scene,
        setProjection, updateLayer, updateScene,
    } = props;
    const canvas = scene.canvas;
    const canvasSize = canvas.size;

    // matrix maps a point from gl coordinates to the viewport.
    const matrix = new Mat3().set(
        rect.width*0.5, 0, rect.width*0.5,
        0, -rect.height*0.5, rect.height*0.5,
        0, 0, 1,
    );
    const invMatrix = matrix.clone().invert();

    // projectorMatrix maps a point from gl coordinates to
    // the projector.
    const handles = projection.handles.map((handle) => handle.clone());
    const projectorMatrix3 = new Mat3();
    const projectorMatrix4 = new Mat4();
    const w2 = canvasSize.x * 0.5;
    const h2 = canvasSize.y * 0.5;
    getPerspectiveModelMatrix(projectorMatrix3, projectorMatrix4,
        new Vec2(-w2,  h2),
        new Vec2( w2,  h2),
        new Vec2( w2, -h2),
        new Vec2(-w2, -h2),
        ...handles,
    );
    const invProjectorMatrix3 = projectorMatrix3.clone().invert();

    // Add the editing handles.
    const handleComponents = [];
    if (canvas.selected) {
        const childProps = {
            viewportRect: rect,
            handles: handles,
            projection: projection,
            setProjection: setProjection,
            matrix: matrix,
            invMatrix: invMatrix,
        };
        handleComponents.splice(0, 0, ...ProjectorHandles(childProps));
    }
    const canvas2camera = matrix.clone().multiply(projectorMatrix3);
    const camera2canvas = canvas2camera.invert();
    const mode = scene.editMode;
    for (const layer of scene.layers) {
        if (layer.selected) {
            const handleProps = {
                canvasSize: canvasSize,
                viewportRect: rect,
                layer: layer,
                updateScene: updateScene,
                matrix: matrix, // gl -> element
                invMatrix: invMatrix, // element -> gl
                canvasMatrix: projectorMatrix3, // canvas -> gl
                invCanvasMatrix: invProjectorMatrix3, // gl -> canvas
                element2canvas: camera2canvas, // element -> canvas
            };
            if (mode == 'move') {
                handleComponents.push(e(MoveHandles, handleProps));
            } else if (mode == 'scale') {
                handleComponents.push(e(ScaleHandles, handleProps));
            } else if (mode == 'rotate') {
                handleComponents.push(e(RotateHandle, handleProps));
            }
        }
    }

    // 3D rendering.
    const render = useRef(null);
    const [glScene, glSceneDispatch] = useReducer(glReducer, {});

    useEffect(() => {
        glSceneDispatch({type: 'create', el: render.current});
    }, []);

    useEffect(() => {
        glSceneDispatch({
            type: 'render',
            canvas: canvas,
            layers: scene.layers,
            matrix: projectorMatrix4,
            rect: rect,
        });
    });

    return e('div', {className: 'overlay'},
        e('div', {ref: render, className: 'render'}),
        e('svg', {className: 'handles'},
            ...handleComponents,
        ),
    );
}


function Composer(props) {
    const {
        projection, scene,
        setProjection, updateScene,
    } = props;

    const [rect, setRect] = useState({top: 0, left: 0, width: 1, height: 1});
    const mountRef = useRef();

    const resize = () => {
        const newRect = mountRef.current.getBoundingClientRect();
        if (newRect.top !== rect.top ||
                newRect.left !== rect.left ||
                newRect.width !== rect.width ||
                newRect.height !== rect.height) {
            setRect(newRect);
        }
    }

    const ro = new ResizeObserver(entries => {
        resize();
    });

    useEffect(() => {
        ro.observe(mountRef.current);
    }, []);

    return e('div',
        {
            ref: mountRef,
            className: 'composer',
            onContextMenu: (event) => {
                event.preventDefault();
                return false;
            },
        },
        e(Projector,
            {
                rect: rect,
                projection: projection,
                scene: scene,
                setProjection: setProjection,
                updateScene: updateScene,
            },
        ),
    );
}


function sceneReducer(scene, action) {
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


export function Editor(props) {
    const [history, updateScene] = useUndoReducer(
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
    const scene = history.present;

    const o = .95;
    const [projection, setProjection] = useState({
        handles: [
            new THREE.Vector2(-o, o),
            new THREE.Vector2( o, o),
            new THREE.Vector2( o, -o),
            new THREE.Vector2(-o, -o),
        ],
    });

    const layers = [scene.canvas, ...scene.layers];

    const reorderLayers = (layers) => {
        updateScene({type: 'reorderLayers', layers: layers});
    };

    const updateLayer = (layer, props, kwargs) => {
        updateScene({type: 'updateLayer', layer: layer, props: props, ...kwargs});
    };

    const addLayerBySourceURL = async (url) => {
        const {dataUrl, width, height} = await readImageFromUrl(url);
        updateScene({
            type: 'addLayerByDataURL',
            dataUrl: dataUrl,
            width: width,
            height: height,
        });
    };

    // Load the canvas images.
    useEffect(() => {
        const projectorBg = document
            .querySelector('#projectorBg')
            .getAttribute('src');
        readImageFromUrl(projectorBg).then((image) => {
            updateScene({type: 'updateCanvas', props: {image: image.dataUrl}});
        });

        if (new URLSearchParams(window.location.search).has('example')) {
            addLayerBySourceURL('../assets/test-1024x512.svg');
        }
    }, []);

    // Set up image paste handling.
    const onPaste = (event) => {
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

    useEffect(() => {
        document.addEventListener('paste', onPaste);
        return () => {
            document.removeEventListener('paste', onPaste);
        };
    });

    // Set up image drop handling.
    const onDragOver = (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    };

    const onDrop = (event) => {
        event.preventDefault();
    };

    return e('div',
        {
            className: 'editor',
            onDragOver: onDragOver,
            onDrop: onDrop,
        },
        e(Toolbar, Object.assign({}, props, {
            history: history,
            updateScene: updateScene,
        })),
        e(LayerList, Object.assign({}, props, {
            scene: scene,
            updateScene: updateScene,
        })),
        e(Composer, Object.assign({}, props, {
            projection: projection,
            scene: scene,
            setProjection: setProjection,
            updateScene: updateScene,
        })),
    );
}
