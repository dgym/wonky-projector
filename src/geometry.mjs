import { Plane } from 'ogl';
import { Vec2, Vec3 } from './maths.mjs';


export class PlaneZ extends Plane {
    // A Plane with Vec3 uv coordinates in attribute uvz.
    // The third component is used for perspective correction.
    constructor(gl, {width, height, uvMatrix=null}) {
        const uvzs = [
            new Vec3(0, 0, 1),
            new Vec3(1, 0, 1),
            new Vec3(0, 1, 1),
            new Vec3(1, 1, 1),
        ];

        if (uvMatrix) {
            for (const uvz of uvzs) {
                uvz.applyMatrix3(uvMatrix);
            }
        }

        super(
            gl,
            {
                width, height,
                attributes: {
                    uvz: {
                        size: 3,
                        data: new Float32Array(
                            Array.prototype.concat(...uvzs),
                        ),
                    },
                },
            },
        );
    }
}


export function stretchPlane({imageSize, viewportSize}) {
    // Returns the width and height to use for a plane to stretch is over a viewport.
    const [iw, ih] = imageSize;
    const [vw, vh] = viewportSize;

    let uw = 2;
    let uh = uw * ih / iw * vw / vh;
    if (uh > 2) {
        uw *= 2/uh;
        uh = 2;
    }

    return new Vec2(uw, uh);
}
