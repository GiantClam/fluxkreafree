import { Readable } from 'stream';

// Cloudflare R2 类型定义
type R2Bucket = any;
type R2PutOptions = any;
type R2ObjectBody = any;
type R2Objects = any;

export interface R2PutItemOptions {
  path?: string;
  contentType?: string;
  acl?: 'public-read' | 'private';
}

export interface R2Serialization {
  path: string;
  pathWithFilename: string;
  filename: string;
  completedUrl: string;
  baseUrl: string;
  mime: string;
  bucket?: string;
  type?: string;
}

export class R2Service {
  private r2: R2Bucket;
  private bucket: string;
  private url: string;

  constructor(r2: R2Bucket, bucket: string, url: string) {
    this.r2 = r2;
    this.bucket = bucket;
    this.url = url;
  }

  async putItemInBucket(
    filename: string,
    content: string | Uint8Array | Buffer | Readable | ReadableStream | Blob,
    options?: R2PutItemOptions,
  ): Promise<R2Serialization> {
    let path = options?.path ? options.path : '';
    const acl = options?.acl ? options.acl : 'public-read';

    if (path) {
      path = path.startsWith('/') ? path.replace('/', '') : `${path}`;
    }

    const mime: string = filename
      .substring(filename.lastIndexOf('.') + 1, filename.length)
      .toLowerCase();
    const key: string = path ? `${path}/${filename}` : filename;

    const putOptions: R2PutOptions = {
      httpMetadata: {
        contentType: options?.contentType || this.getMimeType(mime),
      },
    };

    if (acl === 'public-read') {
      putOptions.customMetadata = {
        'x-amz-acl': 'public-read',
      };
    }

    // 转换内容为 Uint8Array
    let contentBuffer: Uint8Array;
    if (typeof content === 'string') {
      contentBuffer = new TextEncoder().encode(content);
    } else if (content instanceof Uint8Array) {
      contentBuffer = content;
    } else if (content instanceof Buffer) {
      contentBuffer = new Uint8Array(content);
    } else if (content instanceof Blob) {
      contentBuffer = new Uint8Array(await content.arrayBuffer());
    } else if (content instanceof ReadableStream) {
      const reader = content.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      contentBuffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        contentBuffer.set(chunk, offset);
        offset += chunk.length;
      }
    } else {
      throw new Error('Unsupported content type');
    }

    await this.r2.put(key, contentBuffer, putOptions);

    return {
      path,
      pathWithFilename: key,
      filename: filename,
      completedUrl: `${this.url}/${key}`,
      baseUrl: this.url,
      mime,
      bucket: this.bucket,
      type: 'r2',
    };
  }

  async deleteItemInBucket(filename: string): Promise<void> {
    await this.r2.delete(filename);
  }

  async deleteItemsInBucket(filenames: string[]): Promise<void> {
    const objects = filenames.map(key => ({ key }));
    await this.r2.delete(objects);
  }

  async deleteFolder(dir: string): Promise<void> {
    const objects = await this.r2.list({ prefix: dir });
    if (objects.objects.length > 0) {
      const keys = objects.objects.map(obj => ({ key: obj.key }));
      await this.r2.delete(keys);
    }
  }

  async getSignedUrl(key: string, expiresIn = 7200): Promise<string> {
    const url = await this.r2.createMultipartUpload(key);
    return url;
  }

  async getObject(key: string): Promise<R2ObjectBody | null> {
    return await this.r2.get(key);
  }

  async listObjects(prefix?: string, maxKeys = 1000): Promise<R2Objects> {
    return await this.r2.list({ prefix, limit: maxKeys });
  }

  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'json': 'application/json',
      'js': 'application/javascript',
      'css': 'text/css',
      'html': 'text/html',
      'xml': 'application/xml',
      'zip': 'application/zip',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }
}

// 创建 R2 服务实例
export function createR2Service(r2: R2Bucket, bucket: string, url: string): R2Service {
  return new R2Service(r2, bucket, url);
} 