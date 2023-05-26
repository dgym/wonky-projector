import App from '/src/app.svelte';


async function main() {
    document.addEventListener('dragstart', (event) => {
        event.preventDefault();
        return false;
    });

    new App({
        target: document.querySelector('#root'),
        hydrate: true,
    });

    window.setTimeout(() => window.scrollTo(0, 1), 0);
}


if (document.readyState === 'complete') {
    main();
} else {
    window.addEventListener('load', main);
}
