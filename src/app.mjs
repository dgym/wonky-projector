import { useState, createElement, useRef, useEffect, useReducer, useId } from 'react';
import { Vec2 as Vec2Base, Vec3, Mat3, Mat4 } from 'ogl';
import { Renderer, Camera, Transform, Plane, Program, Mesh, Texture } from 'ogl';

import { readImageFromFile, readImageFromUrl } from './image_utils.mjs';
import { LayerList } from './layer_list.mjs';
import { Toolbar } from './toolbar.mjs';
import { useUndoReducer } from './use_undo_reducer.mjs';


const e = createElement;


function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}


const getPerspectiveModelMatrix = (mat3, mat4, sa, sb, sc, sd, da, db, dc, dd) => {
    const basisToPoints = (p1, p2, p3, p4) => {
        const m = new Mat3(
            p1.x, p1.y, 1,
            p2.x, p2.y, 1,
            p3.x, p3.y, 1,
        );
        const v = new Vec3(p4.x, p4.y, 1).applyMatrix3(new Mat3(...m).inverse());
        const t = new Mat3(
            v.x, 0, 0,
            0, v.y, 0,
            0, 0, v.z,
        );
        return m.multiply(t);
    };

    const s = basisToPoints(sa, sb, sc, sd);
    const d = basisToPoints(da, db, dc, dd);
    d.multiply(s.inverse());
    for (let v=1/d[8], i=0; i<9; ++i)
        d[i] *= v;

    mat3.copy(d);

    // Convert to a Mat4.
    mat4.set(
        d[0], d[1], 0, d[2],
        d[3], d[4], 0, d[5],
        0   , 0   , 1, 0   ,
        d[6], d[7], 0, d[8]
    );
}


class Vec2 extends Vec2Base {
    rotateAround(center, angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        this.sub(center);
        const {x, y} = this;
        this.x = x*c - y*s;
        this.y = x*s + y*c;
        this.add(center);
        return this;
    }

    setX(x) {
        this.x = x;
        return this;
    }

    setY(y) {
        this.y = y;
        return this;
    }

    angle() {
        return Math.atan2(-this.y, -this.x) + Math.PI;
    }
}


class TextureProgram extends Program {
    constructor(gl, texture, options={}) {
        super(gl, {
            vertex: `
                attribute vec2 uv;
                attribute vec3 position;

                uniform mat4 modelViewMatrix;
                uniform mat4 projectionMatrix;

                varying vec2 vUv;

                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragment: `
                precision highp float;

                uniform sampler2D tMap;
                uniform float opacity;

                varying vec2 vUv;

                void main() {
                    vec3 tex = texture2D(tMap, vUv).rgb;
                    gl_FragColor = vec4(tex, opacity);
                }
            `,
            uniforms: {
                tMap: {value: texture},
                opacity: {value: 1.0},
            },
            transparent: true,
            ...options,
        });
    }
}


function loadTexture(gl, src, onload, options={}) {
    const texture = new Texture(gl, options);
    const img = new Image();
    img.src = src;
    img.onload = () => {
        texture.image = img;
        onload();
    };
    return texture;
}


// Creates and renders a 3D scene.
const glReducer = (state, action) => {
    const actions = {};

    actions.create = () => {
        const renderer = new Renderer();
        const gl = renderer.gl;
        action.el.appendChild(renderer.gl.canvas);

        const scene = new Transform();

        const camera = new Camera(gl);
        camera.orthographic(-1, 1, 1, -1, 1, 100);
        camera.position.z = 5;

        const root = new Transform();
        root.matrixAutoUpdate = false;
        root.setParent(scene);

        const black = new Program(renderer.gl, {
            vertex: `
                attribute vec3 position;

                uniform mat4 modelViewMatrix;
                uniform mat4 projectionMatrix;

                void main() {
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragment: `
                void main() {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                }
            `,
            depthTest: false,
            depthWrite: false,
        });

        return {
            scene: scene,
            root: root,
            camera: camera,
            renderer: renderer,
            programs: {
                black: black,
            },
        };
    };

    actions.render = () => {
        const {canvas, layers, matrix, rect} = action;

        // Resize the viewport.
        const {camera, renderer, scene, root} = state;
        const {gl} = renderer;
        renderer.setSize(rect.width, rect.height);

        // Clear the previous render.
        root.children = [];

        // Set up the transformation matrix.
        root.matrix.copy(matrix);

        // Add the canvas layer.
        {
            if (canvas.image && !state.programs[canvas.id]) {
                const texture = loadTexture(gl, canvas.image, actions.render);
                const material = new TextureProgram(gl, texture, {
                    depthTest: false,
                    depthWrite: false,
                });
                state.programs[canvas.id] = material;
            }
            const geometry = new Plane(gl, {
                width: canvas.size.x,
                height: canvas.size.y,
            });
            const ux = canvas.size.x > canvas.size.y ? 0.5 : (canvas.size.x / canvas.size.y * 0.5);
            const uy = canvas.size.y > canvas.size.x ? 0.5 : (canvas.size.y / canvas.size.x * 0.5);
            const uvs = new Float32Array([
                0.5-ux, 0.5+uy,
                0.5+ux, 0.5+uy,
                0.5-ux, 0.5-uy,
                0.5+ux, 0.5-uy,
            ]);
            geometry.attributes.uv.data = uvs;
            geometry.attributes.uv.needsUpdate = true;

            // Use black if the canvas is not selected (or not loaded).
            const program = (canvas.selected && state.programs[canvas.id]) ?
                state.programs[canvas.id] :
                state.programs.black;
            const plane = new Mesh(gl, {geometry, program});
            root.addChild(plane);
        }

        // Add the layers
        for (const layer of layers) {
            if (!state.programs[layer.id]) {
                const texture = loadTexture(gl, layer.image, actions.render);
                const material = new TextureProgram(gl, texture, {
                    depthTest: false,
                    depthWrite: false,
                });
                state.programs[layer.id] = material;
            }
            const geometry = new Plane(gl, {
                width: layer.size.x,
                height: layer.size.y,
            });
            const program = state.programs[layer.id];
            const plane = new Mesh(gl, {geometry, program});
            plane.scale.x = layer.scale.x;
            plane.scale.y = layer.scale.y;
            plane.rotation.z = layer.rotation;
            plane.position.x = layer.translation.x;
            plane.position.y = layer.translation.y;
            program.uniforms.opacity.value = Math.min(
                canvas.selected ? 0.4 : 1.0,
                layer.opacity,
            );
            root.addChild(plane);
        }

        requestAnimationFrame(() => {
            gl.clearColor(0.25, 0.25, 0.25, 1.0);
            renderer.render({scene, camera, sort: false});
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

    const getMouse = (event) => {
        const mouse = new Vec3(event.clientX, event.clientY, 1);
        if (viewportRect) {
            mouse.x -= viewportRect.left;
            mouse.y -= viewportRect.top;
        }
        if (invMatrix) {
            mouse.applyMatrix3(invMatrix);
        }
        mouse.multiply(1/mouse.z);
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
                newPos.x = layer.translation.x;
            } else {
                newPos.y = layer.translation.y;
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
            scale = layer.scale.clone().multiply(1/point.len());
        },
        dragMove: (point) => {
            const newScale = scale.clone().multiply(
                point.len() * (start.dot(point) >= 0 ? 1 : -1)
            );
            if (axis == 0) {
                newScale.y = layer.scale.y;
            } else if (axis == 2) {
                newScale.x = layer.scale.x;
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
    const matrix = new Mat3(
        rect.width*0.5, 0, 0,
        0, -rect.height*0.5, 0,
        rect.width*0.5, rect.height*0.5, 1,
    );
    const invMatrix = new Mat3(...matrix).inverse();

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
    const invProjectorMatrix3 = new Mat3(...projectorMatrix3).inverse();

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
    const canvas2camera = new Mat3(...matrix).multiply(projectorMatrix3);
    const camera2canvas = new Mat3(...canvas2camera).inverse();
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
            new Vec2(-o, o),
            new Vec2( o, o),
            new Vec2( o, -o),
            new Vec2(-o, -o),
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
