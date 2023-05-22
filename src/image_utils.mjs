export function readImageFromUrl(src) {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.onload = () => {
            let canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;

            let ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            let dataUrl = canvas.toDataURL('image/png');

            return resolve({
                src: src,
                img: img,
                dataUrl: dataUrl,
                width: img.width,
                height: img.height,
            })
        };
        img.onerror = reject;
        img.src = src;
    });
}


export function readImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const results = {};

        const img = new Image();
        img.onload = () => {
            results.width = img.width;
            results.height = img.height;
            resolve(results);
        };

        const reader = new FileReader();
        reader.onload = (event) => {
            img.src = results.dataUrl = event.target.result;  
        };
        reader.readAsDataURL(file);
    });
}



