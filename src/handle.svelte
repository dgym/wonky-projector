<script context='module'>
    import { Vec2, Vec3 } from './maths.mjs';

    export class HandleInst {
        constructor(props) {
            Object.assign(this, props);
        }

        update(props) {
            Object.assign(this, props);
            return this;
        }

        getPos() {
            const pos = this.pos.clone();
            if (this.matrix) pos.applyMatrix3(this.matrix);
            return pos;
        }

        getMouse(event) {
            const mouse = new Vec3(event.clientX, event.clientY, 1);
            if (this.viewportRect) {
                mouse.x -= this.viewportRect.left;
                mouse.y -= this.viewportRect.top;
            }
            if (this.invMatrix) {
                mouse.applyMatrix3(this.invMatrix);
            }
            mouse.multiply(1/mouse.z);
            return new Vec2(mouse.x, mouse.y);
        }
    }
</script>


<script>
    export let href;
    export let inst;
    export let scale = 1;
    export let rotate = 0;

    function pointerDown(event) {
        event.preventDefault();
        window.addEventListener("pointermove", pointerMove, false);
        window.addEventListener("pointerup", pointerUp, false);
        window.addEventListener("pointercancel", pointerUp, false);
        if (inst.dragStart) {
            const point = inst.getMouse(event);
            inst.dragStart(point);
        }
        return false;
    }

    function pointerMove(event) {
        event.preventDefault();
        const point = inst.getMouse(event);
        if (inst.dragMove) {
            if (inst.clampPoint) {
                inst.clampPoint(point);
            }
            inst.dragMove(point);
        }
        return false;
    };

    function pointerUp(event) {
        event.preventDefault();
        window.removeEventListener("pointermove", pointerMove, false);
        window.removeEventListener("pointerup", pointerUp, false);
        window.removeEventListener("pointercancel", pointerUp, false);
        if (inst.dragEnd) {
            inst.dragEnd();
        }
        return false;
    };

    $: elPos = inst.getPos();
</script>


<use class='handle'
        href='{href}'
        transform='translate({elPos.x} {elPos.y}) rotate({rotate}) scale({scale} {scale})'
        on:pointerdown={pointerDown} />
