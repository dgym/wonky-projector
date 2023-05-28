import { Vec2 as Vec2Base, Vec3, Mat3, Mat4 } from 'ogl';

export { Vec2, Vec3, Mat3, Mat4, clamp, getPerspectiveModelMatrix };


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
    if (mat4) {
        mat4.set(
            d[0], d[1], 0, d[2],
            d[3], d[4], 0, d[5],
            0   , 0   , 1, 0   ,
            d[6], d[7], 0, d[8]
        );
    }
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
