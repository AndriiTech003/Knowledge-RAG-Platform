export interface UploadUrlResponse {
    expires_in: number;
    headers?: {
        [key: string]: string;
    };
    method?: string;
    storage_key: string;
    upload_url: string;
}
