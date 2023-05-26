import { Renderer, Camera, Transform, Plane, Program, Mesh, Texture } from 'ogl';

import { Vec2, Vec3, Mat3, Mat4, clamp, getPerspectiveModelMatrix } from './maths.mjs';


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

        this.programs = {black};
    }

    render(props) {
        const {canvas, layers, matrix, rect} = props;

        // Resize the viewport.
        const {camera, renderer, gl, scene, root, programs} = this;
        renderer.setSize(rect.width, rect.height);

        // Clear the previous render.
        root.children = [];

        // Set up the transformation matrix.
        root.matrix.copy(matrix);

        // Add the canvas layer.
        {
            if (canvas.image && !programs[canvas.id]) {
                const texture = loadTexture(gl, canvas.image, () => this.render(props));
                const material = new TextureProgram(gl, texture, {
                    depthTest: false,
                    depthWrite: false,
                });
                programs[canvas.id] = material;
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
            const program = (canvas.selected && programs[canvas.id]) ?
                programs[canvas.id] :
                programs.black;
            const plane = new Mesh(gl, {geometry, program});
            root.addChild(plane);
        }

        // Add the layers
        for (const layer of layers) {
            if (!programs[layer.id]) {
                const texture = loadTexture(gl, layer.image, () => this.render(props));
                const material = new TextureProgram(gl, texture, {
                    depthTest: false,
                    depthWrite: false,
                });
                programs[layer.id] = material;
            }
            const geometry = new Plane(gl, {
                width: layer.size.x,
                height: layer.size.y,
            });
            const program = programs[layer.id];
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
    }
}
