/**
 * @typedef {import('decap-cms-core').MediaLibrary} MediaLibrary
 * @typedef {import('decap-cms-core').MediaFile} MediaFile
 * @typedef {import('decap-cms-core').MediaLibraryConfig} MediaLibraryConfig
 */

/**
 * @typedef {object} S3MediaLibraryConfig
 * @property {object} config
 * @property {string} config.apiUrl - バックエンドAPIのURL
 * @augments MediaLibraryConfig
 */

/**
 * @param {S3MediaLibraryConfig} options
 * @returns {MediaLibrary}
 */
export default function createS3MediaLibrary(options) {
  const apiUrl = options.config.apiUrl;

  return {
    name: 's3_signed',
    config: options.config,

    /**
     * ファイルのアップロード処理
     * @param {File} file
     * @returns {Promise<MediaFile>}
     */
    async upload(file) {
      console.log('Starting upload for:', file.name);

      // 1. バックエンドにリクエストを送り、署名付きURLを取得
      const presignResponse = await fetch(
        `${apiUrl}?action=upload&fileName=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(file.type)}`
      );
      if (!presignResponse.ok) {
        throw new Error(`Failed to get pre-signed URL: ${await presignResponse.text()}`);
      }
      const { signedUrl, key, publicUrl } = await presignResponse.json();
      console.log('Got pre-signed URL:', signedUrl);

      // 2. 取得した署名付きURLを使って、ファイルをS3に直接PUTリクエストでアップロード
      await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      console.log('File uploaded to S3.');

      // 3. Decap CMSに必要な形式でファイル情報を返す
      return {
        id: key,       // S3のキーをIDとして使う
        name: file.name,
        url: publicUrl, // 公開URL
        size: file.size,
        // 'file'プロパティはDecap CMSの内部で使われる場合があるため残しておきます
        file: file,
      };
    },

    /**
     * ファイルの削除処理
     * @param {Pick<MediaFile, 'id'>} mediaFile
     */
    async delete(mediaFile) {
        if (!mediaFile.id) {
            throw new Error("File ID is missing.");
        }
        console.log('Deleting file with key:', mediaFile.id);
        const deleteResponse = await fetch(`${apiUrl}?action=delete&key=${encodeURIComponent(mediaFile.id)}`);

        if (!deleteResponse.ok) {
            throw new Error(`Failed to delete file: ${await deleteResponse.text()}`);
        }
        console.log('File deleted successfully.');
    },

    /**
     * ファイル一覧の取得処理（今回は実装を省略）
     */
    async list() {
        console.warn("The 'list' method is not implemented in this S3 media library.");
        return { files: [], cursor: '', page: 1 };
    },

    /**
     * getMediaの実装
     */
    async getMedia() {
        return [];
    },
    // ...
  };
}