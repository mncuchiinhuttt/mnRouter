export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

export function compressImage(file: File, maxDim = 320): Promise<string> {
	const { promise, resolve, reject } = Promise.withResolvers<string>();
	const reader = new FileReader();
	reader.onload = (e) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement("canvas");
			let { width, height } = img;
			if (width > height) {
				if (width > maxDim) {
					height = Math.round((height * maxDim) / width);
					width = maxDim;
				}
			} else if (height > maxDim) {
				width = Math.round((width * maxDim) / height);
				height = maxDim;
			}
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext("2d");
			if (!ctx) return resolve(e.target?.result as string);
			ctx.drawImage(img, 0, 0, width, height);
			resolve(canvas.toDataURL("image/webp", 0.82));
		};
		img.onerror = reject;
		img.src = e.target?.result as string;
	};
	reader.onerror = reject;
	reader.readAsDataURL(file);
	return promise;
}
