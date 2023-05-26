import { Vec2, clamp } from './maths.mjs';
import { HandleInst } from './handle.svelte';


export class ProjectionHandle extends HandleInst {
    getPos() {
        this.pos = this.projection.handles[this.idx];
        return super.getPos();
    }

    clampPoint(point) {
        point.x = clamp(point.x, -1, 1);
        point.y = clamp(point.y, -1, 1);
    }

    dragMove(point) {
        const handles = [...this.projection.handles];
        handles[this.idx] = point;
        this.updateProjection({
            ...this.projection,
            handles: handles,
        });
    }
}


export class MoveCenterHandle extends HandleInst {
    dragStart(point) {
        this.start = point.clone().sub(this.layer.translation);
    }

    dragMove(point) {
        const newPos = point.clone().sub(this.start);
        this.updateScene({
            type: 'updateLayer',
            layer: this.layer.id,
            props: {translation: newPos},
            historyBatchToken: 'drag:position',
        });
    }

    dragEnd() {
        this.updateScene({type: 'history:finishBatch'});
    }
}


export class MoveAxisHandle extends MoveCenterHandle {
    getPos() {
        const [vw, vh] = [this.viewportRect.width, this.viewportRect.height];
        const aspect = vw / vh;
        this.pos = (new Vec2(vw < vh ? 0.5 : 0.5 / aspect, 0))
            .rotateAround(new Vec2(0, 0), Math.PI * 0.5 * this.axis);
        this.pos.y *= aspect;
        return super.getPos();
    }

    dragMove(point) {
        const clamped = point.clone();
        if (this.axis & 1) {
            clamped.x = this.layer.translation.x + this.start.x;
        } else {
            clamped.y = this.layer.translation.y + this.start.y;
        }
        super.dragMove(clamped);
    }
}


export class ScaleHandle extends HandleInst {
    getPos() {
        const [vw, vh] = [this.viewportRect.width, this.viewportRect.height];
        const aspect = vw / vh;
        this.pos = (new Vec2(vw < vh ? 0.5 : 0.5 / aspect, 0))
            .rotateAround(new Vec2(0, 0), Math.PI * 0.25 * this.axis);
        this.pos.y *= aspect;
        return super.getPos();
    }

    dragStart(point) {
        this.start = point.clone();
        this.scale = this.layer.scale.clone().multiply(1/point.len());
    }

    dragMove(point) {
        const newScale = this.scale.clone().multiply(
            point.len() * (this.start.dot(point) >= 0 ? 1 : -1)
        );
        if (this.axis == 0) {
            newScale.y = this.layer.scale.y;
        } else if (this.axis == 2) {
            newScale.x = this.layer.scale.x;
        }
        this.updateScene({
            type: 'updateLayer',
            layer: this.layer.id,
            props: {scale: newScale},
            historyBatchToken: 'drag:scale',
        });
    }

    dragEnd() {
        this.updateScene({type: 'history:finishBatch'});
    }
}


export class RotateHandle extends HandleInst {
    getPos() {
        const [vw, vh] = [this.viewportRect.width, this.viewportRect.height];
        const aspect = vw / vh;
        this.center = new Vec2(0, 0).applyMatrix3(this.matrix);
        this.pos = new Vec2(0, vh < vw ? -0.5 : -0.5 * aspect)
            .applyMatrix3(this.matrix)
            .rotateAround(this.center, -this.layer.rotation)
            .applyMatrix3(this.invMatrix);
        return super.getPos();
    }

    dragMove(point) {
        point.applyMatrix3(this.matrix).sub(this.center);
        if (!(point.x || point.y)) return;
        this.updateScene({
            type: 'updateLayer',
            layer: this.layer.id,
            props: {rotation: (-point.angle() + Math.PI*0.5) % (Math.PI*2)},
            historyBatchToken: 'drag:rotate',
        });
    }

    dragEnd() {
        this.updateScene({type: 'history:finishBatch'});
    }
}
