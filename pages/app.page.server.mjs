import fs from 'fs';
import { dangerouslySkipEscape } from "vite-plugin-ssr/server";

import App from '/src/app.svelte';

export { render };


function readFileSync(path) {
    return fs.readFileSync(
        path,
        {encoding: 'utf8', flag: 'r'},
    );
}


function makeSvgImg(svg, id) {
    const enc = encodeURIComponent(svg);
    const idAttr = id ? `id='${id}' ` : '';
    return `<img ${idAttr}src="data:image/svg+xml,${enc}"></img>`;
}


function render() {
    const content = readFileSync('app.html');
    const templateSvg = readFileSync('assets/templates.svg');
    const projectorThumbSvg = readFileSync('assets/projector_thumb.svg');
    const projectorThumbImg = makeSvgImg(projectorThumbSvg, 'projectorThumb');
    const projectorBgSvg = readFileSync('assets/projector_bg.svg');
    const projectorBgImg = makeSvgImg(projectorBgSvg, 'projectorBg');

    const { head, html, css } = App.render({});

    return dangerouslySkipEscape(content
        .replace('<!--root-->', html)
        .replace('<!--templates-->',
            templateSvg +
            projectorThumbImg +
            projectorBgImg,
        )
    );
}
