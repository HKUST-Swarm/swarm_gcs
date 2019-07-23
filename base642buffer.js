Base64toBuffer = function (b64string) {
    buf = Buffer.from(b64string, 'base64');
    return buf;
} 