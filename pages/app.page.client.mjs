import {createElement} from 'react';
import {createRoot} from 'react-dom/client';

import {Editor} from '/src/app.mjs';


async function main() {
    document.addEventListener('dragstart', () => false);

    const req = await fetch('../assets/template.svg');
    const body = await req.text();
    document.querySelector('#templates').innerHTML = body;

    const root = createRoot(document.querySelector('#root'));
    root.render(createElement(Editor, {}));

    window.setTimeout(() => window.scrollTo(0, 1), 0);
}


if (document.readyState === 'complete') {
    main();
} else {
    window.addEventListener('load', main);
}
