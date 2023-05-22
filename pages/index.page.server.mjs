import fs from 'fs';
import {dangerouslySkipEscape} from "vite-plugin-ssr/server";
import showdown from 'showdown';

export {render};

function render() {
    const index = fs.readFileSync('index.html', {encoding: 'utf8', flag: 'r'});
    const readmeSrc = fs.readFileSync('README.md', {encoding: 'utf8', flag: 'r'});

    const converter = new showdown.Converter();
    const readme = converter.makeHtml(readmeSrc);

    return dangerouslySkipEscape(index.replace('<!--readme-->', readme));
}
