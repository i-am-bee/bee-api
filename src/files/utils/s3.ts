export const isS3Error = (e: any) => 'code' in e && 'message' in e && 'time' in e;
