import path from 'path';

/** Where uploaded product images are stored on disk (outside the build, so uploads survive redeploys). */
export const uploadDir = () => process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
