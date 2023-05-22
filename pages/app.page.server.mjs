import fs from 'fs';
import {dangerouslySkipEscape} from "vite-plugin-ssr/server";

export {render};

function render() {
    const content = fs.readFileSync('app.html', {encoding: 'utf8', flag: 'r'});
    return dangerouslySkipEscape(content);
}
