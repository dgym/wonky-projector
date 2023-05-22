import { createElement } from 'react';

const e = createElement;

function LayerListItem(props) {
    const { image_url, selected } = props;

    return e('span',
        {
            className: `layer-list-item ${selected ? 'selected' : ''}`,
            onClick: props.onClick,
        },
        e('img', {
            className: 'thumbnail',
            src: image_url,
            onMouseDown: (event) => {
                event.preventDefault();
                return false;
            },
        }),
    );
}


export function LayerList(props) {
    const { scene, updateScene } = props;

    const setSelection = (item) => updateScene({
        type: 'selectLayer',
        layer: item && item.selected ? null : item,
    });

    const items = [scene.canvas, ...scene.layers];

    return e('div', {
        className: 'layer-list',
        onClick: () => setSelection(null),
    }, items.map((item, idx) => {
        return e(LayerListItem, {
            key: idx,
            image_url: item.thumbnailImage,
            selected: item.selected,
            onClick: (event) => {
                event.stopPropagation();
                setSelection(item);
            }
        });
    }));
}
