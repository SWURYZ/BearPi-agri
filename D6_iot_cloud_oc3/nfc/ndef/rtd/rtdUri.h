#include "NT3H.h"

#ifndef RTDURI_H_
#define RTDURI_H_

typedef enum {
    freeForm,   //0x00     No prepending is done ... the entire URI is contained in the URI Field
    httpWWW,    //0x01     http://www.
    httpsWWW,   //0x02     https://www.
    http,       //0x03     http://
    https,      //0x04     https://
    tel,        //0x05     tel:
    mailto,     //0x06     mailto:
    ftpAnonymous,//0x07     ftp://anonymous:anonymous@
    ftpFtp,     //0x08     ftp://ftp.
    ftps,       //0x09     ftps://
    sftp,       //0x0A     sftp://
    smb,        //0x0B     smb://
    nfs,        //0x0C     nfs://
    ftp,        //0x0D     ftp://
    dav,        //0x0E     dav://
    news,       //0x0F     news:
    telnet,     //0x10     telnet://
    imap,       //0x11     imap:
    rtps,       //0x12     rtsp://
    urn,        //0x13     urn:
    /*
        0x14     pop:
        0x15     sip:
        0x16     sips:
        0x17     tftp:
        0x18     btspp://
        0x19     btl2cap://
        0x1A     btgoep://
        0x1B     tcpobex://
        0x1C     irdaobex://
        0x1D     file://
        0x1E     urn:epc:id:
        0x1F     urn:epc:tag:
        0x20     urn:epc:pat:
        0x21     urn:epc:raw:
        0x22     urn:epc:
        0x23     urn:nfc:
     */
}UriTypeE;

typedef struct {
    char     *body;
    uint8_t  bodyLength;
    void     *extraData; // herre should be stored specific URI msgs
}RtdUriUserPayload;

typedef struct {
    UriTypeE            type;
    RtdUriUserPayload   userPayload; // here should be stored specific URI msgs
}RTDUriTypeStr;

uint8_t addRtdUriRecord(const NDEFDataStr *ndef, RTDUriTypeStr *typeStr);

void prepareUrihttp(NDEFDataStr *data, RecordPosEnu position, uint8_t *text);

#endif /* RTDURI_H_ */
