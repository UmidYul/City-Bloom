import { put } from '@vercel/blob';

export async function uploadToBlob(file, filename) {
    try {
        const blob = await put(filename, file.buffer, {
            access: 'public',
            contentType: file.mimetype
        });

        return blob.url;
    } catch (error) {
        console.error('Blob upload error:', error);
        throw new Error('File upload failed');
    }
}

export async function uploadVideos(beforeVideo, afterVideo) {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).slice(2, 8);

    const beforeExt = beforeVideo.originalname.split('.').pop();
    const afterExt = afterVideo.originalname.split('.').pop();

    const beforeFilename = `submissions/${timestamp}-before-${randomStr}.${beforeExt}`;
    const afterFilename = `submissions/${timestamp}-after-${randomStr}.${afterExt}`;

    const [beforeUrl, afterUrl] = await Promise.all([
        uploadToBlob(beforeVideo, beforeFilename),
        uploadToBlob(afterVideo, afterFilename)
    ]);

    return { beforeUrl, afterUrl };
}

export async function uploadProductIcon(iconFile) {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).slice(2, 8);
    const ext = iconFile.originalname.split('.').pop();
    const filename = `products/${timestamp}-${randomStr}.${ext}`;

    return await uploadToBlob(iconFile, filename);
}
