import { Renderer, Camera, Transform, Program, Mesh, Texture } from 'ogl';

import { Vec2, Vec3, Mat3, Mat4, clamp, getPerspectiveModelMatrix } from './maths.mjs';
import { PlaneZ } from './geometry.mjs';


export class TextureZProgram extends Program {
    constructor(gl, texture, options={}) {
        super(gl, {
            vertex: `
                attribute vec3 position;
                attribute vec3 uvz;

                uniform mat4 modelViewMatrix;
                uniform mat4 projectionMatrix;

                varying vec3 vUvz;

                void main() {
                    vUvz = uvz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragment: `
                precision highp float;

                uniform sampler2D tMap;
                uniform float opacity;

                varying vec3 vUvz;

                void main() {
                    vec3 tex = texture2D(tMap, vUvz.xy/vUvz.z).rgb;
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




export function loadTexture(gl, src, onload, options={}) {
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
export class ProjectorRenderer {
    constructor(el) {
        this.renderer = new Renderer({depth: false});
        this.gl = this.renderer.gl;
        el.appendChild(this.renderer.gl.canvas);

        this.scene = new Transform();

        this.camera = new Camera(this.gl);
        this.camera.orthographic(-1, 1, 1, -1, 1, 100);
        this.camera.position.z = 5;

        this.root = new Transform();
        this.root.matrixAutoUpdate = false;
        this.root.setParent(this.scene);

        const black = new Program(this.gl, {
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

        const textureZ = new TextureZProgram(this.gl, null, {
            depthTest: false,
            depthWrite: false,
        });

        this.programs = { black, textureZ };
        this.textures = {};

        this.frameCallback = null;
        this.removed = false;
    }

    remove() {
        const {gl} = this;

        this.removed = true;

        for (const program of Object.values(this.programs)) {
            program.remove();
        }

        for (const texture of Object.values(this.textures)) {
            gl.deleteTexture(texture.texture);
        }
    }

    render(props) {
        if (this.removed) {
            return;
        }

        const {canvas, layers, matrix, rect} = props;

        // Resize the viewport.
        const {camera, renderer, gl, scene, root, programs, textures} = this;
        renderer.setSize(rect.width, rect.height);

        // Clear the previous render.
        root.children = [];

        // Set up the transformation matrix.
        root.matrix.copy(matrix);

        // Add the canvas layer.
        {
            if (canvas.image && !textures[canvas.id]) {
                const texture = loadTexture(
                    gl, canvas.image,
                    () => this.render(props),
                    {flipY: false},
                );
                textures[canvas.id] = texture;
            }
            const sx = canvas.size.x > canvas.size.y ? 1 : (canvas.size.x / canvas.size.y);
            const sy = canvas.size.y > canvas.size.x ? 1 : (canvas.size.y / canvas.size.x);
            const geometry = new PlaneZ(gl, {
                width: canvas.size.x,
                height: canvas.size.y,
                uvMatrix: new Mat3(
                    sx, 0, 0,
                    0, sy, 0,
                    (1-sx)/2, (1-sy)/2, 1,
                ),
            });

            // Use black if the canvas is not selected (or not loaded).
            const program = (canvas.selected && textures[canvas.id]) ?
                programs.textureZ : programs.black;

            const plane = new Mesh(gl, {geometry, program});
            if (program === programs.textureZ) {
                plane.texture = textures[canvas.id];
                plane.onBeforeRender(({mesh}) => {
                    mesh.program.uniforms.tMap.value = mesh.texture;
                    mesh.program.uniforms.opacity.value = 1.0;
                });
            }

            root.addChild(plane);
        }

        // Add the layers
        for (const layer of layers) {
            if (!textures[layer.id]) {
                const texture = loadTexture(
                    gl, layer.image,
                    () => this.render(props),
                    {flipY: false},
                );
                textures[layer.id] = texture;
            }
            const geometry = new PlaneZ(gl, {
                width: layer.size.x,
                height: layer.size.y,
                uvMatrix: layer.uvMatrix,
            });
            const program = programs.textureZ;
            const plane = new Mesh(gl, {geometry, program});
            plane.scale.x = layer.scale.x;
            plane.scale.y = layer.scale.y;
            plane.rotation.z = layer.rotation;
            plane.position.x = layer.translation.x;
            plane.position.y = layer.translation.y;
            plane.texture = textures[layer.id];
            plane.opacity = Math.min(
                canvas.selected ? 0.4 : 1.0,
                layer.opacity,
            );
            plane.onBeforeRender(({mesh}) => {
                mesh.program.uniforms.tMap.value = mesh.texture;
                mesh.program.uniforms.opacity.value = mesh.opacity;
            });
            root.addChild(plane);
        }

        if (!this.frameCallback) {
            requestAnimationFrame(() => {
                if (this.removed) {
                    return;
                }
                this.frameCallback();
                this.frameCallback = null;
            });
        }
        this.frameCallback = () => {
            if (this.removed) {
                return;
            }
            gl.clearColor(0.25, 0.25, 0.25, 1.0);
            renderer.render({scene, camera, sort: false});
        };
    }
}
